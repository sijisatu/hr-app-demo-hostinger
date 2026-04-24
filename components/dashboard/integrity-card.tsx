import { ShieldCheck } from "lucide-react";

export function IntegrityCard() {
  return (
    <div className="page-card bg-[var(--primary)] p-6 text-white">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/70">System Integrity</p>
      <div className="mt-6 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-[12px] bg-white/12">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[18px] font-semibold">Biometric Scanners</p>
          <p className="mt-1 text-[14px] leading-5 text-white/75">All active nodes synchronized with local attendance storage.</p>
        </div>
      </div>
    </div>
  );
}

