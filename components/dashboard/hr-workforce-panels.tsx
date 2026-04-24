"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, CalendarRange } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { EmployeeRecord, LeaveRecord } from "@/lib/api";

const departmentBarPalette = [
  "bg-[var(--primary)]",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-rose-500",
  "bg-slate-400"
];

function initials(name: string | null | undefined) {
  return (name ?? "")
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "NA";
}

function formatJoinDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short"
  });
}

function formatLeaveDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate || !endDate) {
    return "-";
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }
  const startLabel = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return startDate === endDate ? startLabel : `${startLabel} - ${endLabel}`;
}

function leaveTone(status: LeaveRecord["status"]) {
  if (status === "approved") {
    return "success" as const;
  }
  if (status === "pending-manager" || status === "awaiting-hr") {
    return "warning" as const;
  }
  return "neutral" as const;
}

function leaveStatusLabel(status: LeaveRecord["status"]) {
  if (status === "approved") {
    return "Approved";
  }
  if (status === "pending-manager" || status === "awaiting-hr") {
    return "Review";
  }
  return "Scheduled";
}

function employeeStatusTone(status: EmployeeRecord["status"]) {
  return status === "active" ? "success" : "neutral";
}

function employeeStatusLabel(status: EmployeeRecord["status"]) {
  return status === "active" ? "Active" : "Inactive";
}

export function HrWorkforcePanels({ employees, leaves }: { employees: EmployeeRecord[]; leaves: LeaveRecord[] }) {
  const recentEmployees = useMemo(
    () => [...employees].sort((a, b) => b.joinDate.localeCompare(a.joinDate)).slice(0, 5),
    [employees]
  );

  const departmentHeadcount = useMemo(() => {
    const bucket = new Map<string, number>();
    for (const employee of employees) {
      bucket.set(employee.department, (bucket.get(employee.department) ?? 0) + 1);
    }

    const rows = [...bucket.entries()]
      .map(([department, total]) => ({ department, total }))
      .sort((a, b) => b.total - a.total);

    const peak = Math.max(...rows.map((item) => item.total), 1);
    return rows.map((item, index) => ({
      ...item,
      width: `${(item.total / peak) * 100}%`,
      colorClass: departmentBarPalette[index % departmentBarPalette.length]
    }));
  }, [employees]);

  const activeLeaveRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return leaves
      .filter((leave) => leave.status !== "rejected" && typeof leave.endDate === "string" && leave.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 4);
  }, [leaves]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
      <section className="page-card overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">People</p>
            <p className="section-title mt-2 text-[24px] font-semibold text-[var(--primary)]">Latest Employees</p>
          </div>
          <Link href="/employees" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--primary)] hover:opacity-80">
            View all
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mobile-scroll-shadow overflow-x-auto px-4 py-4 sm:px-6">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 pb-2">Name</th>
                <th className="px-3 pb-2">Department</th>
                <th className="px-3 pb-2">Status</th>
                <th className="px-3 pb-2 text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentEmployees.map((employee) => (
                <tr key={employee.id} className="bg-[var(--surface-muted)]">
                  <td className="rounded-l-[14px] px-3 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--primary-soft)] text-[12px] font-semibold text-[var(--primary)]">
                        {initials(employee.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-[var(--text)]">{employee.name}</p>
                        <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">{employee.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-[13px] text-[var(--text-muted)]">
                    <span className="inline-flex rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text)]">{employee.department}</span>
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill tone={employeeStatusTone(employee.status)}>{employeeStatusLabel(employee.status)}</StatusPill>
                  </td>
                  <td className="rounded-r-[14px] px-3 py-4 text-right text-[13px] font-medium text-[var(--text-muted)]">{formatJoinDate(employee.joinDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="space-y-6">
        <section className="page-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Headcount</p>
              <p className="section-title mt-2 text-[24px] font-semibold text-[var(--primary)]">By Department</p>
            </div>
            <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
              <Building2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {departmentHeadcount.map((item) => (
              <div key={item.department} className="grid grid-cols-[minmax(0,92px)_minmax(0,1fr)_28px] items-center gap-3 sm:grid-cols-[minmax(0,118px)_minmax(0,1fr)_32px]">
                <p className="truncate text-[14px] text-[var(--text)]">{item.department}</p>
                <div className="h-2.5 rounded-full bg-[var(--surface-soft)]">
                  <div className={`h-2.5 rounded-full ${item.colorClass}`} style={{ width: item.width }} />
                </div>
                <p className="text-right text-[13px] font-medium text-[var(--text-muted)]">{item.total}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="page-card overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Time Off</p>
              <p className="section-title mt-2 text-[24px] font-semibold text-[var(--primary)]">Active Leave</p>
            </div>
            <Link href="/leave" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--primary)] hover:opacity-80">
              Manage
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="px-5 py-2 sm:px-6">
            {activeLeaveRows.length === 0 ? (
              <div className="flex items-center gap-3 py-5 text-[14px] text-[var(--text-muted)]">
                <CalendarRange className="h-4 w-4" />
                No active leave records right now.
              </div>
            ) : (
              activeLeaveRows.map((leave) => (
                <div key={leave.id} className="flex flex-col gap-3 border-b border-[var(--border)] py-4 last:border-b-0 sm:flex-row sm:items-center">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--primary-soft)] text-[12px] font-semibold text-[var(--primary)]">
                    {initials(leave.employeeName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--text)]">{leave.employeeName}</p>
                    <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">{leave.type} | {leave.balanceLabel}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] text-[var(--text-muted)]">{formatLeaveDateRange(leave.startDate, leave.endDate)}</p>
                    <div className="mt-2 flex justify-end">
                      <StatusPill tone={leaveTone(leave.status)}>{leaveStatusLabel(leave.status)}</StatusPill>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
