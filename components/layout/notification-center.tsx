"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarClock, ClipboardList, LoaderCircle, ReceiptText } from "lucide-react";
import {
  formatLeaveType,
  formatReimbursementStatus,
  getAttendanceOvertime,
  getEmployees,
  getLeaveHistory,
  getReimbursementRequests,
  type EmployeeRecord
} from "@/lib/api";
import { useSession } from "@/components/providers/session-provider";

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  kind: "leave" | "overtime" | "reimbursement";
};

function matchesManagerScope(employee: EmployeeRecord | undefined, currentUserName: string, currentDepartment: string) {
  if (!employee) {
    return false;
  }
  return (
    employee.department.trim().toLowerCase() === currentDepartment.trim().toLowerCase() &&
    employee.managerName.trim().toLowerCase() === currentUserName.trim().toLowerCase()
  );
}

function iconFor(kind: NotificationItem["kind"]) {
  switch (kind) {
    case "leave":
      return CalendarClock;
    case "overtime":
      return ClipboardList;
    case "reimbursement":
      return ReceiptText;
    default:
      return Bell;
  }
}

export function NotificationCenter() {
  const { currentUser } = useSession();
  const [open, setOpen] = useState(false);
  const canSeeNotifications = currentUser?.role === "hr" || currentUser?.role === "manager" || currentUser?.role === "admin";

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    enabled: canSeeNotifications,
    staleTime: 30_000,
    refetchInterval: 45_000
  });
  const leaveQuery = useQuery({
    queryKey: ["leave-history"],
    queryFn: getLeaveHistory,
    enabled: canSeeNotifications,
    staleTime: 30_000,
    refetchInterval: 45_000
  });
  const overtimeQuery = useQuery({
    queryKey: ["attendance-overtime"],
    queryFn: getAttendanceOvertime,
    enabled: currentUser?.role === "manager" || currentUser?.role === "admin",
    staleTime: 30_000,
    refetchInterval: 45_000
  });
  const reimbursementQuery = useQuery({
    queryKey: ["reimbursement-requests"],
    queryFn: getReimbursementRequests,
    enabled: canSeeNotifications,
    staleTime: 30_000,
    refetchInterval: 45_000
  });

  const notifications = useMemo(() => {
    if (!currentUser || !canSeeNotifications) {
      return [] as NotificationItem[];
    }

    const employees = employeesQuery.data ?? [];
    const employeeById = new Map(employees.map((item) => [item.id, item]));
    const items: NotificationItem[] = [];

    if (currentUser.role === "manager") {
      const leaveItems = (leaveQuery.data ?? [])
        .filter((item) => item.status === "pending-manager" && matchesManagerScope(employeeById.get(item.userId), currentUser.name, currentUser.department))
        .map((item) => ({
          id: `leave-${item.id}`,
          title: `${item.employeeName} needs leave approval`,
          detail: `${formatLeaveType(item.type)} · ${item.startDate === item.endDate ? item.startDate : `${item.startDate} to ${item.endDate}`}`,
          href: "/attendance/leave-request",
          kind: "leave"
        } satisfies NotificationItem));
      const overtimeItems = (overtimeQuery.data ?? [])
        .filter((item) => item.status === "pending" && matchesManagerScope(employeeById.get(item.userId), currentUser.name, currentUser.department))
        .map((item) => ({
          id: `overtime-${item.id}`,
          title: `${item.employeeName} submitted overtime`,
          detail: `${item.date} · ${item.minutes} minutes`,
          href: "/attendance/submit-overtime",
          kind: "overtime"
        } satisfies NotificationItem));
      const reimbursementItems = (reimbursementQuery.data ?? [])
        .filter((item) => item.status === "pending-manager" && matchesManagerScope(employeeById.get(item.userId), currentUser.name, currentUser.department))
        .map((item) => ({
          id: `reimbursement-${item.id}`,
          title: `${item.employeeName} needs reimbursement approval`,
          detail: `${item.claimType} · ${formatReimbursementStatus(item.status)}`,
          href: "/reimbursement",
          kind: "reimbursement"
        } satisfies NotificationItem));

      return [...leaveItems, ...overtimeItems, ...reimbursementItems].slice(0, 12);
    }

    const leaveItems = (leaveQuery.data ?? [])
      .filter((item) => item.status === "awaiting-hr")
      .map((item) => ({
        id: `leave-${item.id}`,
        title: `${item.employeeName} is waiting for HR leave review`,
        detail: `${formatLeaveType(item.type)} · ${item.startDate === item.endDate ? item.startDate : `${item.startDate} to ${item.endDate}`}`,
        href: "/attendance/leave-report",
        kind: "leave"
      } satisfies NotificationItem));
    const reimbursementItems = (reimbursementQuery.data ?? [])
      .filter((item) => item.status === "awaiting-hr" || item.status === "approved")
      .map((item) => ({
        id: `reimbursement-${item.id}`,
        title: `${item.employeeName} needs HR reimbursement action`,
        detail: `${item.claimType} · ${formatReimbursementStatus(item.status)}`,
        href: "/reimbursement",
        kind: "reimbursement"
      } satisfies NotificationItem));

    return [...leaveItems, ...reimbursementItems].slice(0, 12);
  }, [canSeeNotifications, currentUser, employeesQuery.data, leaveQuery.data, overtimeQuery.data, reimbursementQuery.data]);

  const pendingCount = notifications.length;
  const loading = canSeeNotifications && (
    employeesQuery.isLoading ||
    leaveQuery.isLoading ||
    reimbursementQuery.isLoading ||
    (currentUser?.role === "manager" || currentUser?.role === "admin" ? overtimeQuery.isLoading : false)
  );

  if (!canSeeNotifications) {
    return null;
  }

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        className="secondary-button !relative !min-h-10 !w-10 !rounded-full !p-0"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open notifications"
      >
        <Bell className="h-4 w-4" />
        {pendingCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-semibold text-white">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-40 w-[min(92vw,360px)] rounded-[20px] border border-[var(--border)] bg-white p-3 shadow-[0_22px_48px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div>
              <p className="text-[15px] font-semibold text-[var(--primary)]">Pending Approvals</p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                {pendingCount > 0 ? `${pendingCount} approval items need attention.` : "No approval items are waiting right now."}
              </p>
            </div>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-muted)]" /> : null}
          </div>

          <div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto px-1 pb-1">
            {notifications.length > 0 ? (
              notifications.map((item) => {
                const Icon = iconFor(item.kind);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-start gap-3 rounded-[16px] border border-transparent bg-[var(--surface-muted)] px-3 py-3 transition hover:border-[var(--primary)]/14 hover:bg-white"
                    onClick={() => setOpen(false)}
                  >
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--primary)] shadow-[0_8px_18px_rgba(15,46,102,0.12)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-5 text-[var(--text)]">{item.title}</span>
                      <span className="mt-1 block text-[12px] leading-5 text-[var(--text-muted)]">{item.detail}</span>
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-[16px] bg-[var(--surface-muted)] px-4 py-4 text-[13px] text-[var(--text-muted)]">
                Everything is clear. New approval reminders will show up here automatically.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
