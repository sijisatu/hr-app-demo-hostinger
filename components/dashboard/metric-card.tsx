import clsx from "clsx";

const iconTone = {
  neutral: "bg-[var(--primary-soft)] text-[var(--primary)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]"
} as const;

export function MetricCard({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone: keyof typeof iconTone;
}) {
  return (
    <div className="page-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
          <p className="mt-3 text-[32px] font-semibold leading-none text-[var(--primary)]">{value}</p>
          <p className="mt-3 text-[14px] leading-5 text-[var(--text-muted)]">{note}</p>
        </div>
        <div className={clsx("h-10 w-10 rounded-[12px]", iconTone[tone])} />
      </div>
    </div>
  );
}

