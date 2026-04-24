"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, X } from "lucide-react";
import { approveOvertimeRequest, formatOvertimeStatus, getAttendanceOvertime } from "@/lib/api";
import { useSession } from "@/components/providers/session-provider";
import { StatusPill } from "@/components/ui/status-pill";

export function OvertimeApprovalBoard() {
  const queryClient = useQueryClient();
  const { currentUser } = useSession();
  const overtimeQuery = useQuery({ queryKey: ["attendance-overtime"], queryFn: getAttendanceOvertime });
  const canApprove = currentUser?.role === "manager" || currentUser?.role === "admin";

  const overtimeItems = overtimeQuery.data ?? [];

  const approveMutation = useMutation({
    mutationFn: async (payload: { overtimeId: string; status: "approved" | "rejected"; actor: string }) =>
      approveOvertimeRequest(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["attendance-overtime"] });
    }
  });

  return (
    <section className="page-card p-6">
      <div className="mb-5">
        <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Overtime Approval Queue</p>
      </div>

      <div className="space-y-4">
        {overtimeItems.map((item) => {
          const needsDecision = item.status === "pending";
          return (
            <div key={item.id} className="panel-muted p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.department} | {item.date}</p>
                </div>
                <StatusPill tone={item.status === "approved" || item.status === "paid" ? "success" : item.status === "rejected" ? "danger" : "warning"}>
                  {formatOvertimeStatus(item.status)}
                </StatusPill>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-[13px] text-[var(--text-muted)]">
                <div><p className="font-medium text-[var(--text)]">Duration</p><p className="mt-1">{item.minutes} minutes</p></div>
                <div><p className="font-medium text-[var(--text)]">Reason</p><p className="mt-1">{item.reason}</p></div>
              </div>

              {canApprove && needsDecision ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-[10px] bg-white px-4 py-3 text-[14px] font-semibold text-[var(--danger)]"
                    onClick={() => approveMutation.mutate({ overtimeId: item.id, status: "rejected", actor: "Manager/Leader" })}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--primary)] px-4 py-3 text-[14px] font-semibold text-white"
                    onClick={() => approveMutation.mutate({ overtimeId: item.id, status: "approved", actor: "Manager/Leader" })}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {overtimeItems.length === 0 ? (
          <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">No overtime requests are waiting in this queue.</div>
        ) : null}
      </div>
    </section>
  );
}
