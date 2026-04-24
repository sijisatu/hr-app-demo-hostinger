"use client";

import Link from "next/link";
import { ArrowRight, ChartNoAxesColumn, WalletCards } from "lucide-react";
import { actionCards, getEmployeeActionHref } from "@/components/attendance/employee-attendance-workspace";

export function EmployeeAttendanceHub({ showAttendanceReport = false }: { showAttendanceReport?: boolean }) {
  const cards = [
    ...actionCards.map((item) => ({ ...item, href: getEmployeeActionHref(item.key) })),
    {
      key: "leave-balance",
      label: "Leave Balance",
      description: "Review balances by leave type, including carry over and pending usage.",
      icon: WalletCards,
      href: "/attendance/leave-balance"
    },
    ...(showAttendanceReport
      ? [
        {
          key: "attendance-report",
          label: "Attendance Report",
          description: "View attendance coverage and request activity across the organization.",
          icon: ChartNoAxesColumn,
          href: "/attendance/team-report"
        },
        {
          key: "leave-report",
          label: "Leave Report",
          description: "Review leave history, statuses, and supporting documents across the organization.",
          icon: WalletCards,
          href: "/attendance/leave-report"
        }
      ]
      : [])
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/68">Employee Attendance</p>
        <h2 className="mt-4 text-[28px] font-semibold leading-tight">Choose the attendance workflow you want to manage.</h2>
        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-white/78">
          Each request type has its own focused page for submission, review, and history.
        </p>
      </section>

      <section className="page-card p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {cards.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className="group rounded-[16px] border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5 text-left text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-white"
              >
                <Icon className="h-5 w-5" />
                <p className="mt-4 text-[15px] font-semibold">{item.label}</p>
                <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">{item.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--primary)]">
                  Open page
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
