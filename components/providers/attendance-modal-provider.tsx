"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, LoaderCircle, MapPinned, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createCheckIn,
  createCheckOut,
  getAttendanceToday,
  getEmployees,
  type AttendanceRecord
} from "@/lib/api";
import { useSession } from "@/components/providers/session-provider";

type AttendanceModalContextValue = {
  openModal: () => void;
  closeModal: () => void;
  isOpen: boolean;
};

const AttendanceModalContext = createContext<AttendanceModalContextValue | null>(null);

function detectLocationName(latitude: number, longitude: number) {
  const anchors = [
    { name: "Jakarta HQ", latitude: -6.2, longitude: 106.816666 },
    { name: "Bandung Hub", latitude: -6.917464, longitude: 107.619123 },
    { name: "Surabaya Office", latitude: -7.257472, longitude: 112.752088 },
    { name: "Remote - Yogyakarta", latitude: -7.797068, longitude: 110.370529 }
  ];

  let best = anchors[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const distance = Math.hypot(anchor.latitude - latitude, anchor.longitude - longitude);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = anchor;
    }
  }
  return best.name;
}

function findOpenRecord(records: AttendanceRecord[], employeeId: string) {
  return records.find((record) => record.userId === employeeId && record.checkOut === null) ?? null;
}

function AttendanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentUser } = useSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mounted, setMounted] = useState(false);
  const [locationName, setLocationName] = useState("Jakarta HQ");
  const [latitude, setLatitude] = useState("-6.200000");
  const [longitude, setLongitude] = useState("106.816666");
  const [photo, setPhoto] = useState<File | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState("Use current location or keep the worksite default.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError("Camera access is not available. Please allow browser camera permission.");
      setCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!open || !mounted) {
      stopCamera();
      return;
    }
    if (typeof navigator.mediaDevices?.getUserMedia === "function") {
      void startCamera();
    } else {
      setCameraError("This browser does not support live camera capture.");
    }
    return () => stopCamera();
  }, [mounted, open, startCamera, stopCamera]);

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees, enabled: open });
  const todayQuery = useQuery({ queryKey: ["attendance-today"], queryFn: getAttendanceToday, enabled: open });

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const todayRecords = todayQuery.data ?? [];
  const selectedEmployee = useMemo(() => {
    const matchedEmployee = employees.find((employee) => employee.id === currentUser?.id);
    if (matchedEmployee) {
      return matchedEmployee;
    }
    if (!currentUser) {
      return null;
    }
    return {
      id: currentUser.id,
      name: currentUser.name,
      department: currentUser.department,
      position: currentUser.position,
      workLocation: locationName
    };
  }, [currentUser, employees, locationName]);

  useEffect(() => {
    const matchedEmployee = employees.find((employee) => employee.id === currentUser?.id);
    if (!matchedEmployee?.workLocation) {
      return;
    }
    setLocationName((current) => (current === matchedEmployee.workLocation ? current : matchedEmployee.workLocation));
  }, [currentUser?.id, employees]);

  const openRecord = selectedEmployee ? findOpenRecord(todayRecords, selectedEmployee.id) : null;

  const closeAndRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] }),
      queryClient.invalidateQueries({ queryKey: ["employees"] })
    ]);
    router.refresh();
    onClose();
  }, [onClose, queryClient, router]);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) {
        throw new Error("The logged-in account is not linked to an active employee record.");
      }
      const captured = await capturePhoto();
      const selfieFile = captured ?? photo;
      if (!selfieFile) {
        throw new Error("Camera is not ready for automatic selfie capture.");
      }
      const numericLat = Number.parseFloat(latitude);
      const numericLng = Number.parseFloat(longitude);
      if (Number.isNaN(numericLat) || Number.isNaN(numericLng)) {
        throw new Error("Location coordinates are not valid yet.");
      }
      return createCheckIn({
        userId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        department: selectedEmployee.department,
        location: locationName,
        latitude: numericLat,
        longitude: numericLng,
        photo: selfieFile
      });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      setPhoto(null);
      await closeAndRefresh();
    },
    onError: (error: Error) => setErrorMessage(error.message)
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!openRecord) {
        throw new Error("There is no open attendance session for this employee.");
      }
      return createCheckOut({ attendanceId: openRecord.id });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await closeAndRefresh();
    },
    onError: (error: Error) => setErrorMessage(error.message)
  });

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Camera canvas is not ready yet.");
      return null;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      setCameraError("Failed to capture photo from the live camera.");
      return null;
    }
    const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
    setPhoto(file);
    return file;
  }, []);

  const handleUseCurrentLocation = async () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("This browser does not support geolocation.");
      return;
    }
    setGeoStatus("Getting current device location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude.toFixed(6);
        const nextLng = position.coords.longitude.toFixed(6);
        setLatitude(nextLat);
        setLongitude(nextLng);
        setLocationName(detectLocationName(position.coords.latitude, position.coords.longitude));
        setGeoStatus("Current device location is ready to use.");
      },
      () => setGeoStatus("Location access was denied. Using the default worksite for now."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const busy = checkInMutation.isPending || checkOutMutation.isPending;

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/55 p-3 sm:p-5">
      <div className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Attendance Capture</p>
            <h2 className="mt-1.5 section-title text-[26px] font-semibold text-[var(--primary)] sm:text-[28px]">Check-in / Check-out</h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted">Confirm your worksite and submit your attendance.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-[var(--panel-alt)] p-3 text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6 sm:py-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_0.62fr]">
            <div className="space-y-3">
              <div className="rounded-[22px] bg-[var(--primary)] p-4 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-white/60">{openRecord ? "Ready to check out" : "Ready to check in"}</p>
                <p className="mt-2 text-xl font-semibold sm:text-2xl">{selectedEmployee?.name ?? "Loading..."}</p>
                <p className="mt-2 text-sm text-white/75">{selectedEmployee ? `${selectedEmployee.department} | ${selectedEmployee.position}` : "Loading employee profile"}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-2 text-sm font-medium text-[var(--primary)]">
                  Worksite
                  <input value={locationName} onChange={(event) => setLocationName(event.target.value)} className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700" />
                </label>
                <button type="button" onClick={handleUseCurrentLocation} className="mt-7 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--panel-alt)] px-4 py-3 text-sm font-semibold text-[var(--primary)]">
                  <MapPinned className="h-4 w-4" />
                  Use current location
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-[var(--panel-alt)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Latitude</p>
                  <p className="mt-2 text-sm font-medium text-[var(--primary)]">{latitude}</p>
                </div>
                <div className="rounded-2xl border border-border bg-[var(--panel-alt)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Longitude</p>
                  <p className="mt-2 text-sm font-medium text-[var(--primary)]">{longitude}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-[var(--panel-alt)] px-4 py-3 text-sm text-muted">
                {openRecord ? `Open session started at ${openRecord.checkIn} in ${openRecord.location}.` : geoStatus}
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Attendance selfies are stored as validation evidence with limited retention and can only be accessed by HR, the record owner, or managers within the approval scope.
              </div>
            </div>

            <div className="space-y-3 lg:max-w-[320px] lg:justify-self-center lg:w-full">
              <div className="overflow-hidden rounded-[22px] border border-border bg-slate-950 shadow-soft">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {cameraReady ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                    Live Selfie Camera
                  </div>
                  {photo ? <span className="text-xs uppercase tracking-[0.18em] text-emerald-300">Captured</span> : null}
                </div>
                <div className="relative flex h-[200px] items-center justify-center bg-slate-950 sm:h-[220px]">
                  <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain object-center" />
                  {!cameraReady ? <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/70">{cameraError ?? "Starting camera..."}</div> : null}
                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              <div className="rounded-[24px] border border-border bg-[var(--panel-alt)] px-4 py-3 text-sm text-muted">
                {photo ? "Selfie captured and ready to send." : "A selfie will be captured automatically when you submit check-in."}
              </div>

              {cameraError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{cameraError}</div> : null}
              {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
              <button
              type="button"
              onClick={() => checkInMutation.mutate()}
              disabled={busy || !selectedEmployee || Boolean(openRecord) || todayQuery.isLoading}
              className="rounded-2xl bg-[var(--primary)] px-4 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkInMutation.isPending ? <span className="flex items-center justify-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Saving check-in...</span> : "Submit Check-in"}
            </button>
              <button
              type="button"
              onClick={() => checkOutMutation.mutate()}
              disabled={busy || !openRecord || todayQuery.isLoading}
              className="rounded-2xl border border-[var(--primary)]/15 bg-[var(--panel-alt)] px-4 py-4 text-sm font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkOutMutation.isPending ? <span className="flex items-center justify-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Closing session...</span> : "Submit Check-out"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AttendanceModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <AttendanceModalContext.Provider value={{ openModal, closeModal, isOpen }}>
      {children}
      <AttendanceModal open={isOpen} onClose={closeModal} />
    </AttendanceModalContext.Provider>
  );
}

export function useAttendanceModal() {
  const context = useContext(AttendanceModalContext);
  if (!context) {
    throw new Error("useAttendanceModal must be used within AttendanceModalProvider");
  }
  return context;
}



