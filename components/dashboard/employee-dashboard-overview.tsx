"use client";

import { useMemo, useState } from "react";
import { ChartColumnBig, PieChart } from "lucide-react";
import type { AttendanceRecord, LeaveRecord } from "@/lib/api";
import { isOnDutyLeaveType, isSickLeaveType, isHalfDayLeaveType } from "@/lib/api";

type EmployeeDashboardOverviewProps = {
  logs: AttendanceRecord[];
  leaves: LeaveRecord[];
};

type ChartPoint = {
  label: string;
  fullDate: string;
  workingHours: number;
  checkInHour: number;
  checkOutHour: number;
};

type PieTooltipState = {
  label: string;
  value: number;
  x: number;
  y: number;
  color: string;
};

type ChartTooltipState = {
  point: ChartPoint;
  x: number;
  y: number;
};

const chartHeight = 272;
const chartWidth = 680;
const chartPadding = { top: 18, right: 36, bottom: 26, left: 40 };
const workingHoursMax = 9;
const timeScaleMax = 24;

const chartPalette = {
  attendance: "var(--primary)",
  attendanceFill: "rgba(20, 43, 87, 0.42)",
  leave: "var(--success)",
  sick: "var(--warning)",
  grid: "rgba(20, 43, 87, 0.12)",
  axis: "#667085"
};

function parseClockToHour(value: string | null) {
  if (!value) {
    return 0;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s?(AM|PM))?$/i);
  if (!match) {
    return 0;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hour < 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  return hour + minute / 60;
}

function buildLastThreeWeeks(logs: AttendanceRecord[]): ChartPoint[] {
  const today = new Date();
  const endDate = logs.length > 0
    ? new Date(Math.max(...logs.map((item) => new Date(item.timestamp).getTime()), today.getTime()))
    : today;
  const keyed = new Map<string, AttendanceRecord>();

  for (const log of logs) {
    keyed.set(log.timestamp.slice(0, 10), log);
  }

  const points: ChartPoint[] = [];
  for (let offset = 20; offset >= 0; offset -= 1) {
    const date = new Date(endDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const dateKey = date.toISOString().slice(0, 10);
    const log = keyed.get(dateKey);
    const checkInHour = parseClockToHour(log?.checkIn ?? null);
    const checkOutHour = parseClockToHour(log?.checkOut ?? null);
    const workingHours = checkInHour > 0 && checkOutHour > 0 ? Math.max(0, checkOutHour - checkInHour) : 0;

    points.push({
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullDate: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      workingHours,
      checkInHour,
      checkOutHour
    });
  }

  return points;
}

function safeInitials(name: string | null | undefined) {
  return (name ?? "")
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "NA";
}

function formatHours(value: number) {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatClockHour(value: number) {
  if (value <= 0) {
    return "-";
  }

  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  const safeHours = minutes === 60 ? hours + 1 : hours;
  const safeMinutes = minutes === 60 ? 0 : minutes;
  return `${String(safeHours).padStart(2, "0")}:${String(safeMinutes).padStart(2, "0")}`;
}

function getWeekSummaries(points: ChartPoint[]) {
  return [0, 1, 2].map((index) => {
    const slice = points.slice(index * 7, index * 7 + 7);
    const total = slice.reduce((sum, item) => sum + item.workingHours, 0);
    return {
      label: `Week ${index + 1}`,
      value: total,
      percentage: Math.min(100, (total / (7 * 8)) * 100)
    };
  });
}

function getLinePoints(points: ChartPoint[], valueKey: "checkInHour" | "checkOutHour") {
  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  return points
    .map((point, index) => {
      const x = chartPadding.left + (usableWidth / Math.max(points.length - 1, 1)) * index;
      const y = chartPadding.top + usableHeight - (point[valueKey] / timeScaleMax) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");
}

function SummaryBlock({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="panel-muted p-3.5 sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 break-words text-[clamp(24px,3vw,34px)] font-semibold leading-[1.02] text-[var(--text)]">{value}</p>
      {note ? <p className="mt-2 text-[clamp(13px,1.15vw,15px)] leading-6 text-[var(--text)]">{note}</p> : null}
    </div>
  );
}

export function EmployeeDashboardOverview({ logs, leaves }: EmployeeDashboardOverviewProps) {
  const [pieTooltip, setPieTooltip] = useState<PieTooltipState | null>(null);
  const [chartTooltip, setChartTooltip] = useState<ChartTooltipState | null>(null);

  const attendanceCount = logs.length;
  const onTimeCount = logs.filter((item) => item.status === "on-time").length;
  const lateCount = logs.filter((item) => item.status === "late").length;
  const approvedLeaveDays = leaves
    .filter((item) => item.status === "approved" && !isOnDutyLeaveType(item.type) && !isSickLeaveType(item.type) && !isHalfDayLeaveType(item.type))
    .reduce((sum, item) => sum + item.daysRequested, 0);
  const approvedSickLeaveCount = leaves.filter((item) => item.status === "approved" && isSickLeaveType(item.type)).length;
  const pieTotal = Math.max(attendanceCount + approvedLeaveDays + approvedSickLeaveCount, 1);
  const attendanceShare = (attendanceCount / pieTotal) * 360;
  const annualShare = (approvedLeaveDays / pieTotal) * 360;
  const sickShare = Math.max(0, 360 - attendanceShare - annualShare);
  const pieStyle = {
    background: `conic-gradient(${chartPalette.attendance} 0deg ${attendanceShare}deg, ${chartPalette.leave} ${attendanceShare}deg ${attendanceShare + annualShare}deg, ${chartPalette.sick} ${attendanceShare + annualShare}deg ${attendanceShare + annualShare + sickShare}deg)`
  };

  const pieSlices = useMemo(() => {
    const slices = [
      { label: "Attendance", value: attendanceCount, color: chartPalette.attendance, start: 0, end: attendanceShare },
      { label: "On Leave", value: approvedLeaveDays, color: chartPalette.leave, start: attendanceShare, end: attendanceShare + annualShare },
      { label: "Sick Leave", value: approvedSickLeaveCount, color: chartPalette.sick, start: attendanceShare + annualShare, end: attendanceShare + annualShare + sickShare }
    ];

    return slices.filter((slice) => slice.value > 0);
  }, [attendanceCount, approvedLeaveDays, approvedSickLeaveCount, attendanceShare, annualShare, sickShare]);

  const points = buildLastThreeWeeks(logs);
  const weekSummaries = getWeekSummaries(points);
  const totalHours = points.reduce((sum, item) => sum + item.workingHours, 0);
  const averageHours = points.filter((item) => item.workingHours > 0).length > 0
    ? totalHours / points.filter((item) => item.workingHours > 0).length
    : 0;
  const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const barWidth = usableWidth / Math.max(points.length, 1) - 10;
  const checkInPoints = getLinePoints(points, "checkInHour");
  const checkOutPoints = getLinePoints(points, "checkOutHour");
  const pointStep = usableWidth / Math.max(points.length - 1, 1);

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(400px,0.9fr)_minmax(500px,1.1fr)]">
        <div className="page-card overflow-hidden p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <PieChart className="mt-1 h-7 w-7 shrink-0 text-[var(--text)]" />
            <div className="min-w-0">
              <p className="section-title text-[clamp(22px,2.2vw,32px)] font-semibold leading-[1.08] text-[var(--text)]">Attendance Demography</p>
              <p className="mt-1.5 max-w-[28rem] text-[clamp(13px,1.1vw,15px)] leading-6 text-[var(--text-muted)]">A quick snapshot of attendance, approved leave, and sick submissions.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0">
              <div className="relative mx-auto aspect-square w-full max-w-[220px]" onMouseLeave={() => setPieTooltip(null)}>
                <div
                  className="aspect-square w-full rounded-full border-[5px] border-white shadow-soft"
                  style={pieStyle}
                  onMouseMove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const localX = event.clientX - rect.left;
                    const localY = event.clientY - rect.top;
                    const center = rect.width / 2;
                    const dx = localX - center;
                    const dy = localY - center;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance > center) {
                      setPieTooltip(null);
                      return;
                    }

                    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
                    if (angle < 0) {
                      angle += 360;
                    }

                    const activeSlice = pieSlices.find((slice) => angle >= slice.start && angle < slice.end) ?? pieSlices[pieSlices.length - 1] ?? null;
                    if (!activeSlice) {
                      setPieTooltip(null);
                      return;
                    }

                    setPieTooltip({
                      label: activeSlice.label,
                      value: activeSlice.value,
                      color: activeSlice.color,
                      x: Math.min(localX + 12, rect.width - 170),
                      y: Math.min(localY + 12, rect.height - 88)
                    });
                  }}
                />

                {pieTooltip ? (
                  <div
                    className="pointer-events-none absolute z-10 min-w-[148px] rounded-[14px] bg-[rgba(17,24,39,0.92)] px-3 py-2.5 text-white shadow-2xl"
                    style={{ left: pieTooltip.x, top: pieTooltip.y }}
                  >
                    <p className="text-[13px] font-semibold leading-5">{pieTooltip.label}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[12px] leading-5 text-white/90">
                      <span className="h-3.5 w-3.5 rounded-[3px] border border-white/70" style={{ backgroundColor: pieTooltip.color }} />
                      <span>Value: {pieTooltip.value}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-[var(--text)]">
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[var(--primary)]" />Attendance</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[var(--success)]" />On Leave</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-[var(--warning)]" />Sick Leave</span>
              </div>
            </div>

            <div className="grid min-w-0 gap-3.5 sm:gap-4">
              <SummaryBlock label="Attendance" value={String(attendanceCount)} note={`On Time: ${onTimeCount} | Late: ${lateCount} | FO Scan In/Scan Out: 0`} />
              <SummaryBlock label="On Leave" value={String(approvedLeaveDays)} note="Approved leave days across allocated leave types." />
              <SummaryBlock label="Sick Leave" value={String(approvedSickLeaveCount)} note="Displayed as approved sick submissions, not remaining balance." />
            </div>
          </div>
        </div>

        <div className="page-card overflow-hidden p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ChartColumnBig className="mt-1 h-7 w-7 shrink-0 text-[var(--text)]" />
            <div className="min-w-0">
              <p className="section-title text-[clamp(22px,2.2vw,32px)] font-semibold leading-[1.08] text-[var(--text)]">Attendance Info</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="relative min-w-[560px] sm:min-w-[640px]" onMouseLeave={() => setChartTooltip(null)}>
              <p className="text-center text-[13px] font-semibold text-[var(--text)]">Attendance Overview (Last 3 Weeks)</p>
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[12px] text-[var(--text)]">
                <span className="inline-flex items-center gap-2"><span className="h-4 w-12 rounded bg-[var(--success)]" />Clock In (HH.MM)</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-12 rounded bg-[var(--warning)]" />Clock Out (HH.MM)</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-12 rounded bg-[var(--primary)]" />Working Hour</span>
              </div>

              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mt-5 w-full">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => {
                  const y = chartPadding.top + usableHeight - (value / workingHoursMax) * usableHeight;
                  return (
                    <g key={value}>
                      <line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke={chartPalette.grid} strokeWidth="1" />
                      <text x={chartPadding.left - 18} y={y + 4} fontSize="10" fill={chartPalette.axis}>{value}</text>
                    </g>
                  );
                })}

                {points.map((point, index) => {
                  const x = chartPadding.left + (usableWidth / points.length) * index + 6;
                  const barHeight = (point.workingHours / workingHoursMax) * usableHeight;
                  const barY = chartPadding.top + usableHeight - barHeight;
                  return (
                    <g key={point.label}>
                      <rect x={x} y={barY} width={barWidth} height={Math.max(barHeight, 0)} rx="4" fill={chartPalette.attendanceFill} />
                      <text x={x + barWidth / 2} y={chartHeight - 6} textAnchor="middle" fontSize="9" fill={chartPalette.axis}>{index % 3 === 0 ? point.label : ""}</text>
                    </g>
                  );
                })}

                <polyline fill="none" stroke={chartPalette.leave} strokeWidth="2.5" points={checkInPoints} />
                <polyline fill="none" stroke={chartPalette.sick} strokeWidth="2.5" points={checkOutPoints} />

                {points.map((point, index) => {
                  const x = chartPadding.left + pointStep * index;
                  const checkInY = chartPadding.top + usableHeight - (point.checkInHour / timeScaleMax) * usableHeight;
                  const checkOutY = chartPadding.top + usableHeight - (point.checkOutHour / timeScaleMax) * usableHeight;
                  const zoneX = index === 0 ? chartPadding.left : x - pointStep / 2;
                  const zoneWidth = index === 0 || index === points.length - 1 ? pointStep / 2 : pointStep;
                  return (
                    <g key={`${point.label}-markers`}>
                      <circle cx={x} cy={checkInY} r="3.5" fill={chartPalette.leave} />
                      <circle cx={x} cy={checkOutY} r="3.5" fill={chartPalette.sick} />
                      <rect
                        x={zoneX}
                        y={chartPadding.top}
                        width={zoneWidth}
                        height={usableHeight}
                        fill="transparent"
                        style={{ cursor: "pointer" }}
                        onMouseMove={(event) => {
                          const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                          if (!rect) {
                            return;
                          }

                          const localX = event.clientX - rect.left;
                          const localY = event.clientY - rect.top;
                          setChartTooltip({
                            point,
                            x: Math.min(localX + 14, rect.width - 176),
                            y: Math.max(localY - 86, 12)
                          });
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {chartTooltip ? (
                <div
                  className="pointer-events-none absolute z-10 min-w-[176px] rounded-[14px] bg-[rgba(17,24,39,0.94)] px-3 py-2.5 text-white shadow-2xl"
                  style={{ left: chartTooltip.x, top: chartTooltip.y }}
                >
                  <p className="text-[13px] font-semibold leading-5">{chartTooltip.point.fullDate}</p>
                  <div className="mt-2 space-y-1.5 text-[12px] leading-5 text-white/92">
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-[3px]" style={{ backgroundColor: chartPalette.leave }} />
                      <span>Clock In: {formatClockHour(chartTooltip.point.checkInHour)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-[3px]" style={{ backgroundColor: chartPalette.sick }} />
                      <span>Clock Out: {formatClockHour(chartTooltip.point.checkOutHour)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-[3px]" style={{ backgroundColor: chartPalette.attendance }} />
                      <span>Working Hour: {formatHours(chartTooltip.point.workingHours)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 space-y-4 text-[14px] text-[var(--text)]">
            <p>Total: <span className="font-semibold">{formatHours(totalHours)}</span> | Average: <span className="font-semibold">{formatHours(averageHours)}</span></p>
            <div>
              <p className="font-semibold">Working Hour - Last 3 Weeks</p>
              <div className="mt-3 space-y-3">
                {weekSummaries.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <p>{item.label}</p>
                      <p className="font-semibold">{formatHours(item.value)}</p>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(item.percentage, 8)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
