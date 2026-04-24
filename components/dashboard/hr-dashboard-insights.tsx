"use client";

import { useMemo, useState } from "react";
import { ChartColumnBig, UsersRound } from "lucide-react";
import type { AttendanceRecord } from "@/lib/api";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type Point = {
  label: string;
  attendance: number;
  employees: number;
};

type TooltipState = {
  point: Point;
  x: number;
  y: number;
} | null;

export function HrDashboardInsights({ logs, totalEmployees }: { logs: AttendanceRecord[]; totalEmployees: number }) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const points = useMemo(() => {
    const attendanceBucket = weekdayLabels.map((label) => ({ label, attendance: 0, employeesSet: new Set<string>() }));
    for (const log of logs) {
      const day = (new Date(log.timestamp).getUTCDay() + 6) % 7;
      attendanceBucket[day].attendance += 1;
      attendanceBucket[day].employeesSet.add(log.userId);
    }
    return attendanceBucket.map((item) => ({
      label: item.label,
      attendance: item.attendance,
      employees: item.employeesSet.size
    }));
  }, [logs]);

  const maxAttendance = Math.max(...points.map((item) => item.attendance), 1);
  const maxEmployees = Math.max(...points.map((item) => item.employees), totalEmployees, 1);

  const chartWidth = 760;
  const chartHeight = 310;
  const chartPadding = { top: 20, right: 28, bottom: 48, left: 44 };
  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const columnWidth = usableWidth / points.length;
  const barWidth = Math.max(20, columnWidth * 0.45);

  const employeeLinePoints = points
    .map((point, index) => {
      const x = chartPadding.left + columnWidth * index + columnWidth / 2;
      const y = chartPadding.top + usableHeight - (point.employees / maxEmployees) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const totalAttendance = points.reduce((sum, item) => sum + item.attendance, 0);
  const totalEmployeeCheckIns = points.reduce((sum, item) => sum + item.employees, 0);
  const avgDailyAttendance = Number((totalAttendance / points.length).toFixed(1));
  const avgDailyEmployees = Number((totalEmployeeCheckIns / points.length).toFixed(1));
  const peakDay = points.reduce((top, item) => (item.attendance > top.attendance ? item : top), points[0] ?? { label: "-", attendance: 0, employees: 0 });
  const avgCoverage = totalEmployees > 0 ? Number(((avgDailyEmployees / totalEmployees) * 100).toFixed(1)) : 0;

  return (
    <section className="page-card min-w-0 p-5 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-title text-[24px] font-semibold text-[var(--primary)] sm:text-[28px]">HR Attendance Insights</p>
          <p className="mt-2 text-[14px] text-[var(--text-muted)]">Interactive attendance volume and employee check-in trends by day.</p>
        </div>
        <div className="rounded-[12px] bg-[var(--panel-alt)] px-4 py-2 text-[13px] font-medium text-[var(--text)]">Last 7 Days</div>
      </div>

      <div className="mobile-scroll-shadow relative mt-6 overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[560px] w-full sm:min-w-[720px]">
          {[0, 25, 50, 75, 100].map((value) => {
            const y = chartPadding.top + usableHeight - (value / 100) * usableHeight;
            return (
              <g key={`grid-${value}`}>
                <line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
                <text x={chartPadding.left - 26} y={y + 4} fontSize="10" fill="rgba(71,85,105,0.7)">{value}</text>
              </g>
            );
          })}

          {points.map((point, index) => {
            const centerX = chartPadding.left + columnWidth * index + columnWidth / 2;
            const barHeight = (point.attendance / maxAttendance) * usableHeight;
            const barY = chartPadding.top + usableHeight - barHeight;
            const zoneX = chartPadding.left + columnWidth * index;
            const employeeY = chartPadding.top + usableHeight - (point.employees / maxEmployees) * usableHeight;
            return (
              <g key={point.label}>
                <rect x={centerX - barWidth / 2} y={barY} width={barWidth} height={Math.max(barHeight, 0)} rx="10" fill="rgba(30,64,175,0.9)" />
                <text x={centerX} y={chartHeight - 16} textAnchor="middle" fontSize="10" fill="rgba(71,85,105,0.8)">{point.label}</text>
                <circle cx={centerX} cy={employeeY} r="5" fill="rgba(22,163,74,0.95)" />
                <rect
                  x={zoneX}
                  y={chartPadding.top}
                  width={columnWidth}
                  height={usableHeight}
                  fill="transparent"
                  onMouseEnter={() => setTooltip({ point, x: centerX, y: Math.min(barY, employeeY) })}
                  onMouseLeave={() => setTooltip(null)}
                />
              </g>
            );
          })}

          <polyline fill="none" stroke="rgba(22,163,74,0.95)" strokeWidth="3" points={employeeLinePoints} />
        </svg>

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-10 w-[220px] rounded-[14px] bg-slate-900/95 p-3 text-white shadow-xl"
            style={{ left: tooltip.x, top: tooltip.y - 10, transform: "translate(-50%, -100%)" }}
          >
            <p className="text-[13px] font-semibold">{tooltip.point.label}</p>
            <div className="mt-2 space-y-1 text-[12px] text-white/85">
              <p className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-300" /> Attendance: {tooltip.point.attendance}</p>
              <p className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /> Employees Check-in: {tooltip.point.employees}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel-muted p-4">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Total Attendance</p>
          <p className="mt-3 text-[28px] font-semibold text-[var(--primary)]">{totalAttendance}</p>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">Rolling total for the last 7 days.</p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Avg Attendance / Day</p>
          <p className="mt-3 text-[28px] font-semibold text-[var(--primary)]">{avgDailyAttendance}</p>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">Average daily check-ins.</p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Peak Attendance Day</p>
          <p className="mt-3 text-[28px] font-semibold text-[var(--primary)]">{peakDay.label}</p>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">{peakDay.attendance} attendance records.</p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Employee Coverage</p>
          <p className="mt-3 text-[28px] font-semibold text-[var(--primary)]">{avgCoverage}%</p>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">{avgDailyEmployees} of {totalEmployees} employee/day.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-5 text-[13px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2"><ChartColumnBig className="h-4 w-4 text-[var(--primary)]" /> Bars: Attendance records</span>
        <span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4 text-emerald-600" /> Line: Employees check-in</span>
      </div>
    </section>
  );
}
