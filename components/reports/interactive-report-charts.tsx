"use client";

import { useMemo, useState } from "react";
import { Activity, UsersRound } from "lucide-react";

type AttendancePoint = {
  label: string;
  records: number;
  uniqueEmployees: number;
};

type EmployeeCountPoint = {
  label: string;
  totalEmployees: number;
  newEmployees: number;
};

type InteractiveReportChartsProps = {
  attendance: AttendancePoint[];
  employeeCount: EmployeeCountPoint[];
};

export function InteractiveReportCharts({ attendance, employeeCount }: InteractiveReportChartsProps) {
  const [attendanceHover, setAttendanceHover] = useState<number | null>(null);
  const [employeeHover, setEmployeeHover] = useState<number | null>(null);

  const attendanceMax = Math.max(...attendance.map((item) => item.records), 1);
  const employeeMax = Math.max(...employeeCount.map((item) => item.totalEmployees), 1);
  const hiresMax = Math.max(...employeeCount.map((item) => item.newEmployees), 1);

  const attendanceSummary = useMemo(() => {
    const totalRecords = attendance.reduce((sum, item) => sum + item.records, 0);
    const averageDaily = attendance.length ? Math.round(totalRecords / attendance.length) : 0;
    const peak = attendance.reduce((top, item) => (item.records > top.records ? item : top), attendance[0] ?? { label: "-", records: 0, uniqueEmployees: 0 });
    return { totalRecords, averageDaily, peak };
  }, [attendance]);

  const employeeSummary = useMemo(() => {
    const latest = employeeCount[employeeCount.length - 1] ?? { totalEmployees: 0, newEmployees: 0 };
    const growth = latest.totalEmployees - (employeeCount[0]?.totalEmployees ?? latest.totalEmployees);
    const newHires = employeeCount.reduce((sum, item) => sum + item.newEmployees, 0);
    return { latest, growth, newHires };
  }, [employeeCount]);

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <article className="page-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-title text-[26px] font-semibold text-[var(--primary)]">Attendance Trends</p>
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">Daily attendance volume and unique employee activity.</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
            <Activity className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-6 grid h-[280px] grid-cols-7 items-end gap-3">
          {attendance.map((point, index) => {
            const barHeight = `${Math.max((point.records / attendanceMax) * 100, 8)}%`;
            const isActive = attendanceHover === index;
            return (
              <div key={point.label} className="relative flex h-full flex-col items-center justify-end gap-2">
                {isActive ? (
                  <div className="absolute -top-2 z-10 w-[136px] rounded-[12px] bg-[var(--primary)] px-3 py-2 text-[12px] text-white shadow-xl">
                    <p className="font-semibold">{point.label}</p>
                    <p className="mt-1">Records: {point.records}</p>
                    <p>Employees: {point.uniqueEmployees}</p>
                  </div>
                ) : null}
                <div className="flex h-full w-full items-end rounded-[12px] bg-[var(--surface-muted)] px-2">
                  <button
                    type="button"
                    aria-label={`${point.label} attendance`}
                    className="w-full rounded-t-[10px] bg-[var(--primary)]"
                    style={{ height: barHeight, opacity: isActive ? 1 : 0.78 }}
                    onMouseEnter={() => setAttendanceHover(index)}
                    onFocus={() => setAttendanceHover(index)}
                    onMouseLeave={() => setAttendanceHover(null)}
                    onBlur={() => setAttendanceHover(null)}
                  />
                </div>
                <span className="text-[12px] font-medium text-[var(--text-muted)]">{point.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryTile label="Total Records" value={String(attendanceSummary.totalRecords)} note="This week" />
          <SummaryTile label="Average / Day" value={String(attendanceSummary.averageDaily)} note="Attendance volume" />
          <SummaryTile label="Peak Day" value={attendanceSummary.peak.label} note={`${attendanceSummary.peak.records} records`} />
        </div>
      </article>

      <article className="page-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-title text-[26px] font-semibold text-[var(--primary)]">Headcount Trends</p>
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">Monthly total headcount and new hire movement.</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
            <UsersRound className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-6 grid h-[280px] grid-cols-6 items-end gap-3">
          {employeeCount.map((point, index) => {
            const totalHeight = `${Math.max((point.totalEmployees / employeeMax) * 100, 16)}%`;
            const hiresHeight = `${Math.max((point.newEmployees / hiresMax) * 100, point.newEmployees > 0 ? 12 : 0)}%`;
            const isActive = employeeHover === index;

            return (
              <div key={point.label} className="relative flex h-full flex-col items-center justify-end gap-2">
                {isActive ? (
                  <div className="absolute -top-2 z-10 w-[150px] rounded-[12px] bg-[var(--primary)] px-3 py-2 text-[12px] text-white shadow-xl">
                    <p className="font-semibold">{point.label}</p>
                    <p className="mt-1">Total: {point.totalEmployees}</p>
                    <p>New: {point.newEmployees}</p>
                  </div>
                ) : null}
                <div className="flex h-full w-full items-end justify-center gap-2 rounded-[12px] bg-[var(--surface-muted)] px-2 py-2">
                  <button
                    type="button"
                    aria-label={`${point.label} total employee`}
                    className="w-1/2 rounded-t-[10px] bg-[var(--success)]"
                    style={{ height: totalHeight, opacity: isActive ? 1 : 0.78 }}
                    onMouseEnter={() => setEmployeeHover(index)}
                    onFocus={() => setEmployeeHover(index)}
                    onMouseLeave={() => setEmployeeHover(null)}
                    onBlur={() => setEmployeeHover(null)}
                  />
                  <button
                    type="button"
                    aria-label={`${point.label} new employee`}
                    className="w-1/2 rounded-t-[10px] bg-[var(--primary)]"
                    style={{ height: hiresHeight, opacity: isActive ? 1 : 0.74 }}
                    onMouseEnter={() => setEmployeeHover(index)}
                    onFocus={() => setEmployeeHover(index)}
                    onMouseLeave={() => setEmployeeHover(null)}
                    onBlur={() => setEmployeeHover(null)}
                  />
                </div>
                <span className="text-[12px] font-medium text-[var(--text-muted)]">{point.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryTile label="Current Headcount" value={String(employeeSummary.latest.totalEmployees)} note="Active and inactive employees" />
          <SummaryTile label="Growth" value={`${employeeSummary.growth >= 0 ? "+" : ""}${employeeSummary.growth}`} note="Compared with 6 months ago" />
          <SummaryTile label="New Joiners" value={String(employeeSummary.newHires)} note="Last 6 months" />
        </div>
      </article>
    </section>
  );
}

function SummaryTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel-muted p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-[24px] font-semibold text-[var(--primary)]">{value}</p>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">{note}</p>
    </div>
  );
}
