"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, Check, Clock3, Eye, FileText, LoaderCircle, MapPinned, NotebookPen, Paperclip, PlusCircle, Stethoscope, X } from "lucide-react";
import {
  approveLeaveRequest,
  approveOvertimeRequest,
  createLeaveRequest,
  findLeaveAllocation,
  createOvertimeRequest,
  formatLeaveStatus,
  formatLeaveType,
  formatOvertimeStatus,
  getLeaveAllocationAvailable,
  getAttendanceHistory,
  getEmployees,
  getAttendanceOvertime,
  getLeaveHistory,
  isHalfDayLeaveType,
  isOnDutyLeaveType,
  isSickLeaveType
} from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";
import { useSession } from "@/components/providers/session-provider";
import { resolveAssetUrl } from "@/lib/asset-url";

export type ActionKey = "on-duty" | "sick" | "leave" | "half-day" | "overtime";

type EmployeeAttendanceWorkspaceProps = {
  fixedAction?: ActionKey;
  showActionCards?: boolean;
  backHref?: string;
};

type SummaryItem = {
  label: string;
  value: string;
  note: string;
  tone?: "primary";
};

export const actionCards: {
  key: ActionKey;
  label: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}[] = [
  { key: "on-duty", label: "On Duty Request", description: "Submit field work or business assignment requests.", icon: BriefcaseBusiness },
  { key: "sick", label: "Sick Submission", description: "Log sick leave requests and supporting details.", icon: Stethoscope },
  { key: "leave", label: "Leave Request", description: "Submit standard leave requests from a dedicated page.", icon: NotebookPen },
  { key: "half-day", label: "Half Day Leave", description: "Submit short leave requests in half-day increments.", icon: Clock3 },
  { key: "overtime", label: "Submit Overtime", description: "Log overtime for supervisor review.", icon: PlusCircle }
];

const actionHrefMap: Record<ActionKey, string> = {
  "on-duty": "/attendance/on-duty-request",
  sick: "/attendance/sick-submission",
  leave: "/attendance/leave-request",
  "half-day": "/attendance/half-day-request",
  overtime: "/attendance/submit-overtime"
};

export function getEmployeeActionHref(action: ActionKey) {
  return actionHrefMap[action];
}

const statusTone = {
  "on-time": "success",
  late: "danger",
  absent: "warning",
  "early-leave": "neutral"
} as const;

const statusLabel = {
  "on-time": "On Time",
  late: "Late",
  absent: "Absent",
  "early-leave": "Early Leave"
} as const;

const leaveTone = {
  "Awaiting HR": "warning",
  "Pending Manager": "warning",
  Approved: "success",
  Rejected: "danger"
} as const;

function leaveTypeForAction(action: Exclude<ActionKey, "overtime">) {
  switch (action) {
    case "on-duty":
      return "On Duty Request" as const;
    case "sick":
      return "Sick Submission" as const;
    case "half-day":
      return "Half Day Leave" as const;
    case "leave":
    default:
      return "Annual Leave" as const;
  }
}

function leaveTypesForAction(action: Exclude<ActionKey, "overtime">) {
  switch (action) {
    case "on-duty":
      return ["On Duty Request", "Remote Work"] as const;
    case "sick":
      return ["Sick Submission", "Sick Leave"] as const;
    case "half-day":
      return ["Half Day Leave", "Permission"] as const;
    case "leave":
    default:
      return [] as const;
  }
}

export function EmployeeAttendanceWorkspace({ fixedAction, showActionCards, backHref = "/attendance" }: EmployeeAttendanceWorkspaceProps) {
  const queryClient = useQueryClient();
  const { currentUser } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [activeAction, setActiveAction] = useState<ActionKey>(fixedAction ?? "on-duty");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveCategory, setLeaveCategory] = useState("Annual Leave");
  const [halfDaySlot, setHalfDaySlot] = useState<"Morning" | "Afternoon">("Morning");
  const [overtimeDate, setOvertimeDate] = useState(today);
  const [overtimeMinutes, setOvertimeMinutes] = useState("120");
  const [overtimeReason, setOvertimeReason] = useState("");
  const [leaveSearch, setLeaveSearch] = useState("");
  const [leaveDateFrom, setLeaveDateFrom] = useState("");
  const [leaveDateTo, setLeaveDateTo] = useState("");
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const shouldShowActionCards = showActionCards ?? !fixedAction;
  const canApprove = currentUser?.role === "manager";

  useEffect(() => {
    if (fixedAction) {
      setActiveAction(fixedAction);
    }
  }, [fixedAction]);

  const attendanceQuery = useQuery({ queryKey: ["attendance-history"], queryFn: getAttendanceHistory });
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees });
  const leaveQuery = useQuery({ queryKey: ["leave-history"], queryFn: getLeaveHistory });
  const overtimeQuery = useQuery({ queryKey: ["attendance-overtime"], queryFn: getAttendanceOvertime });

  const allLeaveRequests = useMemo(() => leaveQuery.data ?? [], [leaveQuery.data]);
  const allOvertimeItems = useMemo(() => overtimeQuery.data ?? [], [overtimeQuery.data]);
  const currentEmployee = useMemo(
    () => (employeesQuery.data ?? []).find((item) => item.id === currentUser?.id) ?? null,
    [currentUser?.id, employeesQuery.data]
  );

  const customLeaveTypes = useMemo(
    () => currentEmployee?.leaveBalances.allocations ?? [],
    [currentEmployee]
  );

  useEffect(() => {
    if (activeAction !== "leave") {
      return;
    }
    const firstLeaveType = customLeaveTypes[0]?.label;
    if (firstLeaveType && !customLeaveTypes.some((item) => item.label === leaveCategory)) {
      setLeaveCategory(firstLeaveType);
    }
  }, [activeAction, customLeaveTypes, leaveCategory]);

  const attendanceLogs = useMemo(
    () => (attendanceQuery.data ?? []).filter((item) => item.userId === currentUser?.id),
    [attendanceQuery.data, currentUser?.id]
  );
  const leaveRequests = useMemo(
    () => allLeaveRequests.filter((item) => item.userId === currentUser?.id),
    [allLeaveRequests, currentUser?.id]
  );
  const employeeById = useMemo(
    () => new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee])),
    [employeesQuery.data]
  );
  const overtimeItems = useMemo(
    () => allOvertimeItems.filter((item) => item.userId === currentUser?.id),
    [allOvertimeItems, currentUser?.id]
  );

  const onDutyRequests = useMemo(
    () => leaveRequests.filter((item) => isOnDutyLeaveType(item.type)),
    [leaveRequests]
  );
  const sickRequests = useMemo(
    () => leaveRequests.filter((item) => isSickLeaveType(item.type)),
    [leaveRequests]
  );
  const standardLeaveRequests = useMemo(
    () => leaveRequests.filter((item) => !isOnDutyLeaveType(item.type) && !isSickLeaveType(item.type) && !isHalfDayLeaveType(item.type)),
    [leaveRequests]
  );
  const halfDayRequests = useMemo(
    () => leaveRequests.filter((item) => isHalfDayLeaveType(item.type)),
    [leaveRequests]
  );
  const annualLeaveAvailable = useMemo(() => {
    const annualAllocation = currentEmployee ? findLeaveAllocation(currentEmployee.leaveBalances, "Annual Leave") : null;
    return getLeaveAllocationAvailable(annualAllocation ?? { code: "", label: "", days: 0, carryOver: 0, carryOverExpiresAt: null });
  }, [currentEmployee]);

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        throw new Error("No active employee session was found.");
      }
      if (!leaveReason.trim()) {
        throw new Error(activeAction === "on-duty" ? "Description is required." : "Reason is required.");
      }
      if (activeAction === "leave") {
        if (customLeaveTypes.length === 0) {
          throw new Error("No leave types have been allocated for this employee yet.");
        }
      }
      const type = activeAction === "leave" ? leaveCategory : leaveTypeForAction(activeAction as Exclude<ActionKey, "overtime">);
      const normalizedReason = activeAction === "half-day" ? `[${halfDaySlot}] ${leaveReason.trim()}` : leaveReason.trim();

      return createLeaveRequest({
        userId: currentUser.id,
        employeeName: currentUser.name,
        type,
        startDate,
        endDate: activeAction === "half-day" ? startDate : endDate,
        reason: normalizedReason,
        supportingDocument: activeAction === "sick" || activeAction === "leave" ? supportingDocument : null
      });
    },
    onSuccess: async (result) => {
      setLeaveReason("");
      setSupportingDocument(null);
      setMessage(`${formatLeaveType(result.type)} submitted successfully.`);
      await queryClient.invalidateQueries({ queryKey: ["leave-history"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const overtimeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        throw new Error("No active employee session was found.");
      }
      if (!overtimeReason.trim()) {
        throw new Error("Reason is required.");
      }
      const minutes = Number(overtimeMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error("Overtime duration must be greater than 0 minutes.");
      }
      return createOvertimeRequest({
        userId: currentUser.id,
        employeeName: currentUser.name,
        department: currentUser.department,
        date: overtimeDate,
        minutes,
        reason: overtimeReason.trim()
      });
    },
    onSuccess: async () => {
      setOvertimeReason("");
      setMessage("Overtime request submitted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["attendance-overtime"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const approveLeaveMutation = useMutation({
    mutationFn: async (payload: { leaveId: string; status: "approved" | "rejected" }) =>
      approveLeaveRequest({ ...payload, actor: currentUser?.name ?? "Manager/Leader" }),
    onSuccess: async () => {
      setMessage("Leave request updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["leave-history"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const approveOvertimeMutation = useMutation({
    mutationFn: async (payload: { overtimeId: string; status: "approved" | "rejected" }) =>
      approveOvertimeRequest({ ...payload, actor: currentUser?.name ?? "Manager/Leader" }),
    onSuccess: async () => {
      setMessage("Overtime request updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["attendance-overtime"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const summaryCards = useMemo<SummaryItem[]>(() => {
    if (activeAction === "on-duty") {
      return [
        { label: "Attendance Records", value: String(attendanceLogs.length), note: "Total attendance history for this account." },
        { label: "On Time", value: String(attendanceLogs.filter((item) => item.status === "on-time").length), note: "On-time attendance records." },
        { label: "Late Records", value: String(attendanceLogs.filter((item) => item.status === "late").length), note: "Late attendance history." },
        { label: "On Duty Requests", value: String(onDutyRequests.length), note: "Total on-duty requests submitted.", tone: "primary" }
      ];
    }

    if (activeAction === "sick") {
      const approved = sickRequests.filter((item) => item.status === "approved").length;
      const pending = sickRequests.filter((item) => item.status !== "approved" && item.status !== "rejected").length;
      const days = sickRequests.reduce((sum, item) => sum + item.daysRequested, 0);
      return [
        { label: "Sick Submissions", value: String(sickRequests.length), note: "Total sick leave submissions." },
        { label: "Approved", value: String(approved), note: "Approved requests." },
        { label: "Pending", value: String(pending), note: "Awaiting manager review." },
        { label: "Requested Days", value: String(days), note: "Total requested days.", tone: "primary" }
      ];
    }

    if (activeAction === "leave") {
      const approved = standardLeaveRequests.filter((item) => item.status === "approved").length;
      const pending = standardLeaveRequests.filter((item) => item.status !== "approved" && item.status !== "rejected").length;
      const days = standardLeaveRequests.reduce((sum, item) => sum + item.daysRequested, 0);
      return [
        { label: "Leave Requests", value: String(standardLeaveRequests.length), note: "Total leave requests." },
        { label: "Approved", value: String(approved), note: "Approved requests." },
        { label: "Pending", value: String(pending), note: "Awaiting manager review." },
        { label: "Requested Days", value: String(days), note: "Total requested days.", tone: "primary" }
      ];
    }

    if (activeAction === "half-day") {
      const approved = halfDayRequests.filter((item) => item.status === "approved").length;
      const pending = halfDayRequests.filter((item) => item.status !== "approved" && item.status !== "rejected").length;
      const totalDays = Number(halfDayRequests.reduce((sum, item) => sum + item.daysRequested, 0).toFixed(1));
      return [
        { label: "Half Day Requests", value: String(halfDayRequests.length), note: "Total half-day requests." },
        { label: "Approved", value: String(approved), note: "Approved requests." },
        { label: "Pending", value: String(pending), note: "Awaiting manager review." },
        { label: "Annual Balance", value: `${annualLeaveAvailable}`, note: "Half-day leave deducts 0.5 day.", tone: "primary" },
        { label: "Half Day Used", value: `${totalDays}`, note: "Total half-day leave used." }
      ];
    }

    const approvedOrPaid = overtimeItems.filter((item) => item.status === "approved" || item.status === "paid").length;
    const pending = overtimeItems.filter((item) => item.status === "pending").length;
    const totalHours = Number((overtimeItems.reduce((sum, item) => sum + item.minutes, 0) / 60).toFixed(1));
    return [
      { label: "Overtime Submissions", value: String(overtimeItems.length), note: "Total overtime entries." },
      { label: "Approved/Paid", value: String(approvedOrPaid), note: "Approved or paid entries." },
      { label: "Pending", value: String(pending), note: "Awaiting manager review." },
      { label: "Overtime Hours", value: String(totalHours), note: "Total overtime hours.", tone: "primary" }
    ];
  }, [activeAction, annualLeaveAvailable, attendanceLogs, halfDayRequests, onDutyRequests, overtimeItems, sickRequests, standardLeaveRequests]);

  const leaveRecordsForAction = useMemo(() => {
    switch (activeAction) {
      case "on-duty":
        return onDutyRequests;
      case "sick":
        return sickRequests;
      case "leave":
        return standardLeaveRequests;
      case "half-day":
        return halfDayRequests;
      default:
        return [];
    }
  }, [activeAction, halfDayRequests, onDutyRequests, sickRequests, standardLeaveRequests]);

  const leaveApprovalQueue = useMemo(() => {
    if (activeAction === "overtime" || !canApprove || !currentUser) {
      return [];
    }
    return allLeaveRequests.filter((item) => {
      const matchesAction =
        activeAction === "leave"
          ? !isOnDutyLeaveType(item.type) && !isSickLeaveType(item.type) && !isHalfDayLeaveType(item.type)
          : leaveTypesForAction(activeAction as Exclude<ActionKey, "overtime">).includes(item.type as never);
      if (!matchesAction || item.status !== "pending-manager") {
        return false;
      }
      const employee = employeeById.get(item.userId);
      if (!employee) {
        return false;
      }
      return (
        employee.department.trim().toLowerCase() === currentUser.department.trim().toLowerCase() &&
        employee.managerName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );
    });
  }, [activeAction, allLeaveRequests, canApprove, currentUser, employeeById]);

  const overtimeApprovalQueue = useMemo(
    () => {
      if (!canApprove || !currentUser) {
        return [];
      }
      return allOvertimeItems.filter((item) => {
        if (item.status !== "pending") {
          return false;
        }
        const employee = employeeById.get(item.userId);
        if (!employee) {
          return false;
        }
        return (
          employee.department.trim().toLowerCase() === currentUser.department.trim().toLowerCase() &&
          employee.managerName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
        );
      });
    },
    [allOvertimeItems, canApprove, currentUser, employeeById]
  );

  const leaveCategoryOptions = useMemo(() => {
    return customLeaveTypes.map((allocation) => ({
      value: allocation.label,
      label: `${allocation.label} (${getLeaveAllocationAvailable(allocation)} days)`
    }));
  }, [customLeaveTypes]);

  const filteredLeaveRecords = useMemo(() => {
    if (activeAction !== "leave") {
      return leaveRecordsForAction;
    }
    const search = leaveSearch.trim().toLowerCase();
    return leaveRecordsForAction.filter((record) => {
      const formattedType = formatLeaveType(record.type).toLowerCase();
      const reason = record.reason.toLowerCase();
      const matchesSearch = search.length === 0 || formattedType.includes(search) || reason.includes(search);
      const matchesFrom = leaveDateFrom.length === 0 || record.endDate >= leaveDateFrom;
      const matchesTo = leaveDateTo.length === 0 || record.startDate <= leaveDateTo;
      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [activeAction, leaveDateFrom, leaveDateTo, leaveRecordsForAction, leaveSearch]);

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] bg-[var(--primary)] px-5 py-5 text-white sm:px-6 lg:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/68">Employee Attendance</p>
        <h2 className="mt-4 text-[24px] font-semibold leading-tight sm:text-[28px]">Manage every attendance request from one focused workspace.</h2>
        <p className="mt-3 max-w-3xl text-[13px] leading-6 text-white/78 sm:text-[14px]">
          Submit requests, review related history, and keep approvals organized by workflow.
        </p>
      </section>

      {shouldShowActionCards ? (
        <section className="page-card p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {actionCards.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={getEmployeeActionHref(item.key)}
                  className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5 text-left text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-white"
                >
                  <Icon className="h-5 w-5" />
                  <p className="mt-4 text-[15px] font-semibold">{item.label}</p>
                  <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">{item.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="page-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {fixedAction ? (
              <Link href={backHref} className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--primary)]">
                <ArrowLeft className="h-4 w-4" />
                Back to request menu
              </Link>
            ) : null}
            <p className="section-title mt-2 text-[22px] font-semibold text-[var(--primary)] sm:text-[24px]">{actionCards.find((item) => item.key === activeAction)?.label}</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
              {activeAction === "overtime" ? "Submit overtime details for supervisor review." : "Complete the form for the selected attendance workflow."}
            </p>
          </div>
          {message ? <div className="rounded-[12px] border border-[var(--border)] bg-[var(--panel-alt)] px-4 py-3 text-[13px] text-[var(--text-muted)]">{message}</div> : null}
        </div>

        {activeAction === "overtime" ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)_auto]">
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Date</span>
              <input type="date" value={overtimeDate} onChange={(event) => setOvertimeDate(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Minutes</span>
              <input type="number" min="1" value={overtimeMinutes} onChange={(event) => setOvertimeMinutes(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Employee</p>
              <p className="mt-2 text-[15px] font-semibold text-[var(--primary)]">{currentUser?.name}</p>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">{currentUser?.department}</p>
            </div>
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Reason</span>
              <input value={overtimeReason} onChange={(event) => setOvertimeReason(event.target.value)} placeholder="Describe the overtime request" className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <button type="button" onClick={() => overtimeMutation.mutate()} disabled={overtimeMutation.isPending} className="primary-button w-full sm:w-auto lg:self-end">
              {overtimeMutation.isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Sending...</> : "Submit"}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1.3fr)_auto]">
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>{activeAction === "half-day" ? "Date" : "Start Date"}</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            {activeAction === "half-day" ? (
              <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
                <span>Slot</span>
                <select value={halfDaySlot} onChange={(event) => setHalfDaySlot(event.target.value as "Morning" | "Afternoon")} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]">
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                </select>
              </label>
            ) : (
              <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
                <span>End Date</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
              </label>
            )}
            {activeAction === "leave" ? (
              <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
                <span>Leave Type</span>
                {leaveCategoryOptions.length > 0 ? (
                  <select value={leaveCategory} onChange={(event) => setLeaveCategory(event.target.value)} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]">
                    {leaveCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                ) : (
                  <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
                    HR has not allocated any leave types for this employee yet.
                  </div>
                )}
              </label>
            ) : null}
            {activeAction === "half-day" ? (
              <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Annual Leave Balance</p>
                <p className="mt-2 text-[16px] font-semibold text-[var(--primary)]">{annualLeaveAvailable} days</p>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">Each half-day request deducts 0.5 day from annual leave.</p>
              </div>
            ) : null}
            {activeAction === "sick" || activeAction === "leave" ? (
              <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
                <span>{activeAction === "sick" ? "Doctor Letter" : "Supporting Document"}</span>
                <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => setSupportingDocument(event.target.files?.[0] ?? null)}
                    className="block w-full text-[13px] text-[var(--text-muted)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-white"
                  />
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                    {activeAction === "sick"
                      ? "Upload JPG, PNG, WEBP, or PDF if a medical note is available."
                      : "Upload JPG, PNG, WEBP, or PDF for any supporting leave document."}
                  </p>
                </div>
              </label>
            ) : null}
            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>{activeAction === "on-duty" ? "Description" : "Reason"}</span>
              <input value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} placeholder={activeAction === "on-duty" ? "Describe the on-duty activity" : "Describe the request reason"} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
            <button type="button" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} className="primary-button w-full sm:w-auto lg:self-end">
              {leaveMutation.isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Sending...</> : "Submit"}
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <div key={item.label} className={item.tone === "primary" ? "page-card bg-[var(--primary)] p-5 text-white" : "page-card p-5"}>
            <p className={item.tone === "primary" ? "text-[12px] font-medium uppercase tracking-[0.08em] text-white/72" : "text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"}>{item.label}</p>
            <p className={item.tone === "primary" ? "mt-3 text-[30px] font-semibold leading-none" : "mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]"}>{item.value}</p>
            <p className={item.tone === "primary" ? "mt-3 text-[14px] text-white/74" : "mt-3 text-[14px] text-[var(--text-muted)]"}>{item.note}</p>
          </div>
        ))}
      </section>

      {activeAction === "on-duty" ? (
        <section className="page-card overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div>
              <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Attendance & On-Duty Records</p>
            </div>
            <div className="rounded-[12px] bg-[var(--panel-alt)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
              {attendanceQuery.isLoading ? "Loading attendance history..." : `${attendanceLogs.length} attendance logs and ${onDutyRequests.length} on-duty requests loaded`}
            </div>
          </div>

          <div className="border-b border-[var(--border)] px-5 py-5 lg:px-6">
            <p className="text-[16px] font-semibold text-[var(--primary)]">Submitted On-Duty Requests</p>
          </div>

          <div className="mobile-scroll-shadow overflow-x-auto px-4 py-4 lg:px-6">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <th className="px-4 pb-2">Request Type</th>
                  <th className="px-4 pb-2">Date Range</th>
                  <th className="px-4 pb-2">Reason</th>
                  <th className="px-4 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {onDutyRequests.map((request) => {
                  const label = formatLeaveStatus(request.status);
                  return (
                    <tr key={request.id} className="bg-[var(--surface-muted)]">
                      <td className="rounded-l-[12px] px-4 py-4 align-top">
                        <p className="text-[14px] font-semibold text-[var(--text)]">{formatLeaveType(request.type)}</p>
                        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                          Submitted {new Date(request.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">
                        {request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`}
                      </td>
                      <td className="px-4 py-4 align-top text-[14px] text-[var(--text-muted)]">{request.reason}</td>
                      <td className="rounded-r-[12px] px-4 py-4 align-top">
                        <StatusPill tone={leaveTone[label as keyof typeof leaveTone]}>{label}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {onDutyRequests.length === 0 ? (
              <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
                No on-duty requests have been submitted yet.
              </div>
            ) : null}
          </div>

          <div className="border-b border-t border-[var(--border)] px-5 py-5 lg:px-6">
            <p className="text-[16px] font-semibold text-[var(--primary)]">Generated Attendance Logs</p>
          </div>

          <div className="mobile-scroll-shadow overflow-x-auto px-4 py-4 lg:px-6">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <th className="px-4 pb-2">Date</th>
                  <th className="px-4 pb-2">Description</th>
                  <th className="px-4 pb-2">Check In / Out</th>
                  <th className="px-4 pb-2">Location</th>
                  <th className="px-4 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs.map((log) => (
                  <tr key={log.id} className="bg-[var(--surface-muted)]">
                    <td className="rounded-l-[12px] px-4 py-4 align-top">
                      <p className="text-[14px] font-semibold text-[var(--text)]">{new Date(log.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.department}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-[14px] font-semibold text-[var(--text)]">{log.description}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.location}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">
                      <p>{log.checkIn} - {log.checkOut ?? "Open"}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.overtimeMinutes > 0 ? `${log.overtimeMinutes} overtime minutes` : "No overtime"}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">
                      <div className="flex items-center gap-2"><MapPinned className="h-4 w-4" />{log.location}</div>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.gpsValidated ? "GPS validated" : "GPS flagged"}</p>
                    </td>
                    <td className="rounded-r-[12px] px-4 py-4 align-top"><StatusPill tone={statusTone[log.status]}>{statusLabel[log.status]}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {attendanceLogs.length === 0 ? (
              <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
                No attendance logs have been generated for this account yet.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeAction !== "on-duty" && activeAction !== "overtime" ? (
        <section className="page-card p-5 sm:p-6">
          <p className="section-title text-[22px] font-semibold text-[var(--primary)] sm:text-[24px]">{actionCards.find((item) => item.key === activeAction)?.label} Records</p>
          {activeAction === "leave" ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <label className="space-y-2 text-[13px] font-medium text-[var(--primary)]">
                  <span>Search</span>
                  <input
                    value={leaveSearch}
                    onChange={(event) => setLeaveSearch(event.target.value)}
                    placeholder="Search type or reason..."
                    className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]"
                  />
                </label>
                <label className="space-y-2 text-[13px] font-medium text-[var(--primary)]">
                  <span>Date From</span>
                  <input
                    type="date"
                    value={leaveDateFrom}
                    onChange={(event) => setLeaveDateFrom(event.target.value)}
                    className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]"
                  />
                </label>
                <label className="space-y-2 text-[13px] font-medium text-[var(--primary)]">
                  <span>Date To</span>
                  <input
                    type="date"
                    value={leaveDateTo}
                    onChange={(event) => setLeaveDateTo(event.target.value)}
                    className="w-full rounded-[10px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]"
                  />
                </label>
              </div>
              <div className="mobile-scroll-shadow overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    <th className="px-4 pb-2">Leave Type</th>
                    <th className="px-4 pb-2">Date Range</th>
                    <th className="px-4 pb-2">Days</th>
                    <th className="px-4 pb-2">Reason</th>
                    <th className="px-4 pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaveRecords.map((request) => {
                    const label = formatLeaveStatus(request.status);
                    return (
                      <tr key={request.id} className="bg-[var(--surface-muted)]">
                        <td className="rounded-l-[12px] px-4 py-4 align-top">
                          <p className="text-[14px] font-semibold text-[var(--text)]">{formatLeaveType(request.type)}</p>
                          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{new Date(request.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">{request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`}</td>
                        <td className="px-4 py-4 align-top text-[14px] text-[var(--text)]">{request.daysRequested}</td>
                        <td className="px-4 py-4 align-top text-[14px] text-[var(--text-muted)]">
                          <p>{request.reason}</p>
                          {request.supportingDocumentUrl ? (
                            <a
                              href={resolveAssetUrl(request.supportingDocumentUrl) ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--primary)]"
                            >
                              <Paperclip className="h-4 w-4" />
                              Open document
                            </a>
                          ) : null}
                        </td>
                        <td className="rounded-r-[12px] px-4 py-4 align-top"><StatusPill tone={leaveTone[label as keyof typeof leaveTone]}>{label}</StatusPill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredLeaveRecords.length === 0 ? (
                <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">No records match the current filters.</div>
              ) : null}
            </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {leaveRecordsForAction.map((request) => {
                const label = formatLeaveStatus(request.status);
                return (
                  <div key={request.id} className="panel-muted p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[var(--text)]">{formatLeaveType(request.type)}</p>
                        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`}</p>
                      </div>
                      <StatusPill tone={leaveTone[label as keyof typeof leaveTone]}>{label}</StatusPill>
                    </div>
                    <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{request.reason}</p>
                    {request.supportingDocumentUrl ? (
                      <a
                        href={resolveAssetUrl(request.supportingDocumentUrl) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--primary)]"
                      >
                        <FileText className="h-4 w-4" />
                        View doctor letter
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {activeAction === "overtime" ? (
        <section className="page-card p-5 sm:p-6">
          <p className="section-title text-[22px] font-semibold text-[var(--primary)] sm:text-[24px]">Overtime Records</p>
          <div className="mobile-scroll-shadow mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <th className="px-4 pb-2">Date</th><th className="px-4 pb-2">Minutes</th><th className="px-4 pb-2">Reason</th><th className="px-4 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {overtimeItems.map((item) => (
                  <tr key={item.id} className="bg-[var(--surface-muted)]">
                    <td className="rounded-l-[12px] px-4 py-4 text-[14px] text-[var(--text)]">{item.date}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{item.minutes}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{item.reason}</td>
                    <td className="rounded-r-[12px] px-4 py-4"><StatusPill tone={item.status === "pending" ? "warning" : item.status === "rejected" ? "danger" : "success"}>{formatOvertimeStatus(item.status)}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canApprove && activeAction !== "overtime" ? (
        <section className="page-card p-5 sm:p-6">
          <p className="section-title text-[22px] font-semibold text-[var(--primary)] sm:text-[24px]">Approval Queue</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {leaveApprovalQueue.map((request) => (
              <div key={request.id} className="panel-muted p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text)]">{request.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{formatLeaveType(request.type)} | {request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`}</p>
                  </div>
                  <StatusPill tone="warning">Pending Manager</StatusPill>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{request.reason}</p>
                {request.supportingDocumentUrl ? (
                  <a
                    href={resolveAssetUrl(request.supportingDocumentUrl) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--primary)]"
                  >
                    <Eye className="h-4 w-4" />
                    Open supporting document
                  </a>
                ) : null}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button className="secondary-button !px-3 !py-2" onClick={() => approveLeaveMutation.mutate({ leaveId: request.id, status: "rejected" })} disabled={approveLeaveMutation.isPending}><X className="h-4 w-4" /> Reject</button>
                  <button className="primary-button !px-3 !py-2" onClick={() => approveLeaveMutation.mutate({ leaveId: request.id, status: "approved" })} disabled={approveLeaveMutation.isPending}><Check className="h-4 w-4" /> Approve</button>
                </div>
              </div>
            ))}
            {leaveApprovalQueue.length === 0 ? <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">No requests are waiting for approval in this queue.</div> : null}
          </div>
        </section>
      ) : null}

      {canApprove && activeAction === "overtime" ? (
        <section className="page-card p-5 sm:p-6">
          <p className="section-title text-[22px] font-semibold text-[var(--primary)] sm:text-[24px]">Approval Queue</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {overtimeApprovalQueue.map((item) => (
              <div key={item.id} className="panel-muted p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.date} | {item.minutes} minutes</p>
                  </div>
                  <StatusPill tone="warning">Pending Manager</StatusPill>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{item.reason}</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button className="secondary-button !px-3 !py-2" onClick={() => approveOvertimeMutation.mutate({ overtimeId: item.id, status: "rejected" })} disabled={approveOvertimeMutation.isPending}><X className="h-4 w-4" /> Reject</button>
                  <button className="primary-button !px-3 !py-2" onClick={() => approveOvertimeMutation.mutate({ overtimeId: item.id, status: "approved" })} disabled={approveOvertimeMutation.isPending}><Check className="h-4 w-4" /> Approve</button>
                </div>
              </div>
            ))}
            {overtimeApprovalQueue.length === 0 ? <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">No overtime requests are waiting for approval.</div> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}







