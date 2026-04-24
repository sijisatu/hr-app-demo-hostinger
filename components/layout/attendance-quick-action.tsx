"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import clsx from "clsx";
import { getAttendanceToday } from "@/lib/api";
import { useAttendanceModal } from "@/components/providers/attendance-modal-provider";
import { useSession } from "@/components/providers/session-provider";

function hasOpenAttendance(records: Awaited<ReturnType<typeof getAttendanceToday>>, employeeId: string | undefined) {
  if (!employeeId) {
    return false;
  }
  return records.some((record) => record.userId === employeeId && record.checkOut === null);
}

export function AttendanceQuickAction({
  className,
  compact = false,
  label
}: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const { openModal, isOpen } = useAttendanceModal();
  const { currentUser } = useSession();
  const attendanceTodayQuery = useQuery({
    queryKey: ["attendance-today"],
    queryFn: getAttendanceToday,
    enabled: Boolean(currentUser?.id),
    staleTime: 15_000
  });

  const actionLabel = useMemo(() => {
    if (label) {
      return label;
    }
    return hasOpenAttendance(attendanceTodayQuery.data ?? [], currentUser?.id) ? "Clock Out" : "Clock In";
  }, [attendanceTodayQuery.data, currentUser?.id, label]);

  return (
    <button
      type="button"
      onClick={openModal}
      disabled={isOpen}
      className={clsx(
        compact ? "primary-button min-w-[140px]" : "primary-button",
        "relative z-[2] pointer-events-auto disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      <Clock3 className="h-4 w-4" />
      <span className="attendance-action-label">{actionLabel}</span>
    </button>
  );
}
