import clsx from "clsx";

const toneMap = {
  active: "bg-[var(--success-soft)] text-[var(--success)]",
  inactive: "bg-[#eef2f7] text-[#667085]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  neutral: "bg-[#eef2f7] text-[var(--text-muted)]",
  live: "bg-[var(--success-soft)] text-[var(--success)]",
  alert: "bg-[var(--danger-soft)] text-[var(--danger)]"
} as const;

export function StatusPill({
  tone,
  children
}: {
  tone: keyof typeof toneMap;
  children: React.ReactNode;
}) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold", toneMap[tone])}>
      {children}
    </span>
  );
}

