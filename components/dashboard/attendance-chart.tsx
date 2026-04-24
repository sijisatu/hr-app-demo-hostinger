import type { AttendanceSeriesItem } from "@/lib/api";

export function AttendanceChart({ series }: { series: AttendanceSeriesItem[] }) {
  const maxValue = Math.max(...series.map((item) => item.present + item.absent), 1);

  return (
    <div className="page-card p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="section-title text-[28px] font-semibold text-[var(--primary)]">Attendance Performance</p>
          <p className="mt-2 text-[14px] text-[var(--text-muted)]">Weekly aggregate of check-in efficiency</p>
        </div>
        <div className="panel-muted px-4 py-2 text-[13px] font-medium text-[var(--text)]">Last 7 Days</div>
      </div>

      <div className="grid h-[320px] grid-cols-7 items-end gap-4">
        {series.map((item) => {
          const total = item.present + item.absent;
          const height = (total / maxValue) * 100;
          return (
            <div key={item.label} className="flex h-full flex-col items-center justify-end gap-3">
              <div className="flex h-full w-full items-end rounded-[12px] bg-[var(--surface-muted)] px-2">
                <div className="w-full rounded-t-[10px] bg-[var(--primary)]" style={{ height: `${Math.max(height, 12)}%` }} />
              </div>
              <span className="text-[12px] font-medium text-[var(--text-muted)]">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

