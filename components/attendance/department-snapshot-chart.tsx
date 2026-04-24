"use client";

import { useMemo, useState } from "react";
import { ChartColumnBig, Users } from "lucide-react";

type DepartmentSnapshotItem = {
  department: string;
  records: number;
  onTimeRate: number;
  checkedInEmployees: number;
};

type TooltipState = {
  item: DepartmentSnapshotItem;
  x: number;
  y: number;
};

const chartHeight = 280;
const chartWidth = 720;
const chartPadding = { top: 20, right: 28, bottom: 44, left: 42 };
const chartPalette = {
  bars: "rgba(20, 43, 87, 0.24)",
  barAccent: "var(--primary)",
  line: "#f59e0b",
  points: "#f59e0b",
  grid: "rgba(20, 43, 87, 0.12)",
  axis: "#667085"
};

function clampLabel(value: string, max = 16) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}

export function DepartmentSnapshotChart({ items }: { items: DepartmentSnapshotItem[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const chartItems = useMemo(
    () => items.length > 0
      ? items
      : [{ department: "No attendance data", records: 0, onTimeRate: 0, checkedInEmployees: 0 }],
    [items]
  );

  const maxRecords = Math.max(...chartItems.map((item) => item.records), 1);
  const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const columnWidth = usableWidth / Math.max(chartItems.length, 1);
  const barWidth = Math.min(78, Math.max(40, columnWidth * 0.42));

  const linePoints = chartItems
    .map((item, index) => {
      const centerX = chartPadding.left + columnWidth * index + columnWidth / 2;
      const y = chartPadding.top + usableHeight - (item.onTimeRate / 100) * usableHeight;
      return `${centerX},${y}`;
    })
    .join(" ");

  return (
    <div className="page-card overflow-hidden p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Department Snapshot</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <div className="relative min-w-[620px]" onMouseLeave={() => setTooltip(null)}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] font-semibold text-[var(--text)]">Department Attendance Coverage</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[var(--text)]">
              <span className="inline-flex items-center gap-2"><span className="h-4 w-10 rounded bg-[var(--primary)]/25" />Attendance Records</span>
              <span className="inline-flex items-center gap-2"><span className="h-1 w-10 rounded bg-[#f59e0b]" />On-Time Rate</span>
            </div>
          </div>

          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mt-5 w-full">
            {[0, 25, 50, 75, 100].map((value) => {
              const y = chartPadding.top + usableHeight - (value / 100) * usableHeight;
              return (
                <g key={value}>
                  <line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke={chartPalette.grid} strokeWidth="1" />
                  <text x={chartPadding.left - 26} y={y + 4} fontSize="10" fill={chartPalette.axis}>{value}</text>
                </g>
              );
            })}

            {chartItems.map((item, index) => {
              const centerX = chartPadding.left + columnWidth * index + columnWidth / 2;
              const barHeight = (item.records / maxRecords) * usableHeight;
              const barY = chartPadding.top + usableHeight - barHeight;
              const barX = centerX - barWidth / 2;
              return (
                <g key={item.department}>
                  <rect x={barX} y={barY} width={barWidth} height={Math.max(barHeight, 0)} rx="10" fill={chartPalette.bars} />
                  <rect x={barX} y={Math.max(barY + 10, chartPadding.top)} width={barWidth} height={Math.max(barHeight - 10, 0)} rx="8" fill={chartPalette.barAccent} opacity={item.records > 0 ? 0.18 : 0.08} />
                  <text x={centerX} y={chartHeight - 18} textAnchor="middle" fontSize="10" fill={chartPalette.axis}>{clampLabel(item.department)}</text>
                </g>
              );
            })}

            <polyline fill="none" stroke={chartPalette.line} strokeWidth="3" points={linePoints} />

            {chartItems.map((item, index) => {
              const centerX = chartPadding.left + columnWidth * index + columnWidth / 2;
              const pointY = chartPadding.top + usableHeight - (item.onTimeRate / 100) * usableHeight;
              const zoneX = chartPadding.left + columnWidth * index;
              return (
                <g key={`${item.department}-point`}>
                  <circle cx={centerX} cy={pointY} r="5.5" fill={chartPalette.points} />
                  <circle cx={centerX} cy={pointY} r="2.5" fill="white" />
                  <rect
                    x={zoneX}
                    y={chartPadding.top}
                    width={columnWidth}
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
                      setTooltip({
                        item,
                        x: Math.min(localX + 14, rect.width - 196),
                        y: Math.max(localY - 108, 10)
                      });
                    }}
                  />
                </g>
              );
            })}

            <text x={chartPadding.left} y={14} fontSize="10" fill={chartPalette.axis}>Coverage scale</text>
          </svg>

          {tooltip ? (
            <div
              className="pointer-events-none absolute z-10 min-w-[196px] rounded-[14px] bg-[rgba(17,24,39,0.94)] px-3 py-2.5 text-white shadow-2xl"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <p className="text-[13px] font-semibold leading-5">{tooltip.item.department}</p>
              <div className="mt-2 space-y-1.5 text-[12px] leading-5 text-white/92">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-[3px] bg-[var(--primary)]" />
                  <span>Attendance Records: {tooltip.item.records}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-[3px] bg-[#f59e0b]" />
                  <span>On-Time Rate: {tooltip.item.onTimeRate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-[3px] bg-[var(--success)]" />
                  <span>Checked-In Employees: {tooltip.item.checkedInEmployees}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {chartItems.map((item) => (
          <div key={`${item.department}-summary`} className="panel-muted p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[14px] font-semibold text-[var(--text)]">{item.department}</p>
              <ChartColumnBig className="h-4 w-4 shrink-0 text-[var(--primary)]" />
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[28px] font-semibold leading-none text-[var(--primary)]">{item.records}</p>
                <p className="mt-2 text-[12px] text-[var(--text-muted)]">attendance records</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-semibold text-[var(--text)]">{item.onTimeRate}%</p>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">on-time rate</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
