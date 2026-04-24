"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FolderPen, LoaderCircle, Pencil, Plus, ReceiptText, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import {
  createReimbursementClaimType,
  createReimbursementRequest,
  deleteReimbursementClaimType,
  formatReimbursementCategory,
  formatReimbursementStatus,
  getEmployees,
  getReimbursementClaimTypes,
  getReimbursementRequests,
  hrProcessReimbursement,
  managerApproveReimbursement,
  type EmployeeRecord,
  type ReimbursementCategory,
  type ReimbursementClaimTypeRecord,
  type ReimbursementRequestRecord,
  updateReimbursementClaimType,
  updateReimbursementRequest
} from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";
import { useSession } from "@/components/providers/session-provider";

type Props = {
  role: "admin" | "hr" | "manager" | "employee";
  userId: string;
  initialEmployees: EmployeeRecord[];
  initialClaimTypes: ReimbursementClaimTypeRecord[];
  initialRequests: ReimbursementRequestRecord[];
};

type ClaimForm = {
  reimbursementId: string | null;
  claimTypeId: string;
  receiptDate: string;
  currency: string;
  amount: string;
  remarks: string;
  receipt: File | null;
};

type AllocationForm = {
  id: string | null;
  employeeId: string;
  category: ReimbursementCategory;
  claimType: string;
  subType: string;
  currency: string;
  annualLimit: string;
  remainingBalance: string;
  active: boolean;
  notes: string;
};

const presets = [
  { category: "medical" as const, claimType: "Medical", subType: "Outpatient", annualLimit: 3500000, notes: "Doctor consultation, outpatient visits, and prescribed medicine." },
  { category: "medical" as const, claimType: "Medical", subType: "Dental", annualLimit: 2500000, notes: "Scaling, fillings, and basic dental treatment." },
  { category: "glasses" as const, claimType: "Glasses", subType: "Self", annualLimit: 1000000, notes: "Personal eyeglass frames and lenses." },
  { category: "maternity" as const, claimType: "Maternity", subType: "Normal Delivery", annualLimit: 12000000, notes: "Normal delivery reimbursement within the approved benefit cap." },
  { category: "maternity" as const, claimType: "Maternity", subType: "Caesarean", annualLimit: 18000000, notes: "Cesarean delivery benefit allocation." },
  { category: "transport" as const, claimType: "Transport", subType: "Business Trip", annualLimit: 6000000, notes: "Taxi, parking, toll, and business travel transport." },
  { category: "communication" as const, claimType: "Communication", subType: "Mobile & Internet", annualLimit: 2400000, notes: "Business mobile data, airtime, and internet allowance." }
];

const emptyClaim = (): ClaimForm => ({ reimbursementId: null, claimTypeId: "", receiptDate: new Date().toISOString().slice(0, 10), currency: "IDR", amount: "", remarks: "", receipt: null });
const emptyAllocation = (employeeId = ""): AllocationForm => ({ id: null, employeeId, category: "medical", claimType: "", subType: "", currency: "IDR", annualLimit: "", remainingBalance: "", active: true, notes: "" });
const money = (value: number, currencyCode = "IDR") => new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(value);
const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const formatDateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const formatNumberInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return new Intl.NumberFormat("id-ID").format(Number(digits));
};
const numberValue = (value: string) => {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const statusTone = (status: ReimbursementRequestRecord["status"]) => status === "rejected" ? "danger" : status === "draft" ? "neutral" : status === "approved" || status === "processed" ? "success" : "warning";

export function ReimbursementWorkspace({ role, userId, initialEmployees, initialClaimTypes, initialRequests }: Props) {
  const queryClient = useQueryClient();
  const { currentUser } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const [panel, setPanel] = useState<"history" | "entitlements" | "drafts">("history");
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [claimForm, setClaimForm] = useState<ClaimForm>(emptyClaim());
  const [allocationForm, setAllocationForm] = useState<AllocationForm>(emptyAllocation());
  const [receiptName, setReceiptName] = useState("");
  const [hrSearch, setHrSearch] = useState("");
  const [allocationSearch, setAllocationSearch] = useState("");

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(() => setMessage(null), 4200);
    return () => clearTimeout(timer);
  }, [message]);

  const isHr = role === "hr" || role === "admin";
  const isManager = role === "manager";
  const isEmployeeSurface = role === "employee" || role === "manager";
  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    initialData: initialEmployees,
    enabled: isHr
  });
  const claimTypesQuery = useQuery({ queryKey: ["reimbursement-claim-types"], queryFn: getReimbursementClaimTypes, initialData: initialClaimTypes });
  const requestsQuery = useQuery({ queryKey: ["reimbursement-requests"], queryFn: getReimbursementRequests, initialData: initialRequests });

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const claimTypes = useMemo(() => claimTypesQuery.data ?? [], [claimTypesQuery.data]);
  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const currentEmployee = employees.find((item) => item.id === userId) ?? null;
  const myClaimTypes = claimTypes.filter((item) => item.employeeId === userId && item.active);
  const myRequests = requests.filter((item) => item.userId === userId);
  const myDrafts = myRequests.filter((item) => item.status === "draft");
  const myHistory = myRequests.filter((item) => item.status !== "draft");
  const selectedClaimType = myClaimTypes.find((item) => item.id === claimForm.claimTypeId) ?? null;
  const managerQueue = requests.filter((item) => item.status === "pending-manager" && item.userId !== userId);
  const hrRows = useMemo(() => {
    const keyword = hrSearch.trim().toLowerCase();
    return requests.filter((item) => keyword.length === 0 || `${item.employeeName} ${item.claimType} ${item.subType} ${item.department}`.toLowerCase().includes(keyword));
  }, [hrSearch, requests]);
  const allocationRows = useMemo(() => {
    const keyword = allocationSearch.trim().toLowerCase();
    return claimTypes.filter((item) => keyword.length === 0 || `${item.employeeName} ${item.claimType} ${item.subType} ${item.department}`.toLowerCase().includes(keyword));
  }, [allocationSearch, claimTypes]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reimbursement-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["reimbursement-claim-types"] }),
      queryClient.invalidateQueries({ queryKey: ["employees"] })
    ]);
  };

  const claimMutation = useMutation({
    mutationFn: async (submit: boolean) => {
      if (!claimForm.claimTypeId) throw new Error("Please select a claim type first.");
      if (submit && !claimForm.receipt && !receiptName) {
        throw new Error("Please upload a receipt before submitting the reimbursement.");
      }
      const payload = { claimTypeId: claimForm.claimTypeId, currency: claimForm.currency, amount: numberValue(claimForm.amount), receiptDate: claimForm.receiptDate, remarks: claimForm.remarks, submit, receipt: claimForm.receipt };
      if (claimForm.reimbursementId) return updateReimbursementRequest({ reimbursementId: claimForm.reimbursementId, ...payload });
      return createReimbursementRequest({
        userId,
        employeeName: currentEmployee?.name ?? currentUser?.name ?? "Unknown Employee",
        department: currentEmployee?.department ?? currentUser?.department ?? "General Operations",
        designation: currentEmployee?.position ?? currentUser?.position ?? "Staff",
        ...payload
      });
    },
    onSuccess: async (_, submit) => {
      setMessage(submit ? "Reimbursement submitted successfully." : "Reimbursement draft saved successfully.");
      setClaimModalOpen(false);
      setClaimForm(emptyClaim());
      setReceiptName("");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const allocationMutation = useMutation({
    mutationFn: async () => {
      const employee = employees.find((item) => item.id === allocationForm.employeeId);
      if (!employee) throw new Error("Please select an employee first.");
      const payload = { employeeId: employee.id, employeeName: employee.name, department: employee.department, designation: employee.position, category: allocationForm.category, claimType: allocationForm.claimType, subType: allocationForm.subType, currency: allocationForm.currency, annualLimit: numberValue(allocationForm.annualLimit), remainingBalance: numberValue(allocationForm.remainingBalance || allocationForm.annualLimit), active: allocationForm.active, notes: allocationForm.notes };
      if (allocationForm.id) return updateReimbursementClaimType(allocationForm.id, payload);
      return createReimbursementClaimType(payload);
    },
    onSuccess: async () => {
      setMessage("Reimbursement claim type saved successfully.");
      setAllocationModalOpen(false);
      setAllocationForm(emptyAllocation());
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const deleteAllocationMutation = useMutation({ mutationFn: deleteReimbursementClaimType, onSuccess: async () => { setMessage("Reimbursement claim type deleted successfully."); await refresh(); }, onError: (error: Error) => setMessage(error.message) });
  const managerMutation = useMutation({ mutationFn: (payload: { reimbursementId: string; status: "approved" | "rejected" }) => managerApproveReimbursement({ ...payload, actor: "Manager/Leader" }), onSuccess: async () => { setMessage("Manager approval updated successfully."); await refresh(); }, onError: (error: Error) => setMessage(error.message) });
  const hrMutation = useMutation({ mutationFn: (payload: { reimbursementId: string; status: "approved" | "rejected" | "processed" }) => hrProcessReimbursement({ ...payload, actor: "HR" }), onSuccess: async () => { setMessage("HR reimbursement processing updated successfully."); await refresh(); }, onError: (error: Error) => setMessage(error.message) });

  const openDraft = (draft: ReimbursementRequestRecord) => {
    setClaimForm({ reimbursementId: draft.id, claimTypeId: draft.claimTypeId, receiptDate: draft.receiptDate, currency: draft.currency, amount: formatNumberInput(String(draft.amount)), remarks: draft.remarks, receipt: null });
    setReceiptName(draft.receiptFileName ?? "");
    setClaimModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
        <div className="flex items-center gap-3 text-white/72"><ReceiptText className="h-5 w-5" /><p className="text-[12px] font-semibold uppercase tracking-[0.22em]">Reimbursement Hub</p></div>
        <h2 className="mt-5 max-w-3xl text-[26px] font-semibold leading-tight sm:text-[32px]">Claims, approvals, and HR allocation live in one streamlined workspace.</h2>
        <p className="mt-3 max-w-4xl text-[14px] leading-6 text-white/80">Submit receipts, route approvals, and manage employee entitlements without switching modules.</p>
      </section>

      {message ? (
        <div className="fixed right-4 top-4 z-[80] w-full max-w-[520px] rounded-[14px] border border-[var(--border)] bg-white px-4 py-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] text-[var(--text)]">{message}</p>
            <button type="button" className="secondary-button !min-h-8 !w-8 !rounded-full !p-0" onClick={() => setMessage(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {isEmployeeSurface ? (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            {[{ key: "history", label: "My Claim Applications", value: myHistory.length, note: "Submitted reimbursement history." }, { key: "entitlements", label: "My Claim Entitlements", value: myClaimTypes.length, note: "Active claim types assigned by HR." }, { key: "drafts", label: "My Draft Claim", value: myDrafts.length, note: "Drafts that have not been submitted." }].map((item) => (
              <button key={item.key} type="button" onClick={() => setPanel(item.key as typeof panel)} className={`rounded-[20px] border px-5 py-5 text-left transition ${panel === item.key ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--primary)] hover:bg-white"}`}>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.label}</p>
                <p className="mt-3 text-[32px] font-semibold text-[var(--primary)]">{item.value}</p>
                <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">{item.note}</p>
              </button>
            ))}
          </section>

          <section className="page-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">New Reimbursement</p>
              </div>
              <button className="primary-button" onClick={() => setClaimModalOpen(true)} disabled={myClaimTypes.length === 0}><Plus className="h-4 w-4" />Add Claim</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="panel-muted p-4"><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Designation</p><p className="mt-2 text-[15px] font-semibold text-[var(--primary)]">{currentEmployee?.position ?? currentUser?.position ?? "-"}</p><p className="mt-1 text-[13px] text-[var(--text-muted)]">{currentEmployee?.department ?? currentUser?.department ?? "-"}</p></div>
              <div className="panel-muted p-4"><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Claim Types</p><p className="mt-2 text-[15px] font-semibold text-[var(--primary)]">{myClaimTypes.length}</p><p className="mt-1 text-[13px] text-[var(--text-muted)]">Assigned by HR for this account.</p></div>
              <div className="panel-muted p-4"><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Receipt</p><p className="mt-2 text-[15px] font-semibold text-[var(--primary)]">Required on submit</p><p className="mt-1 text-[13px] text-[var(--text-muted)]">Drafts can be saved without a file.</p></div>
            </div>
          </section>
        </>
      ) : null}

      {panel === "history" && isEmployeeSurface ? <RequestTable title="My Claim Applications" rows={myHistory} /> : null}
      {panel === "entitlements" && isEmployeeSurface ? <EntitlementList rows={myClaimTypes} /> : null}
      {panel === "drafts" && isEmployeeSurface ? <DraftList rows={myDrafts} onEdit={openDraft} /> : null}
      {isManager ? <ApprovalQueue rows={managerQueue} pending={managerMutation.isPending} onApprove={(reimbursementId, status) => managerMutation.mutate({ reimbursementId, status })} /> : null}

      {isHr ? (
        <>
          <section className="page-card overflow-hidden p-0">
            <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="section-title text-[24px] font-semibold text-[var(--primary)]">All Employee Reimbursements</p></div>
              <label className="topbar-control w-full lg:max-w-sm"><Search className="h-4 w-4 text-[var(--text-muted)]" /><input value={hrSearch} onChange={(event) => setHrSearch(event.target.value)} className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" placeholder="Search employee, claim type, or department..." /></label>
            </div>
            <div className="overflow-x-auto px-4 py-4 lg:px-6">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead><tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-4 pb-2">Employee</th><th className="px-4 pb-2">Claim</th><th className="px-4 pb-2">Amount</th><th className="px-4 pb-2">Dates</th><th className="px-4 pb-2">Status</th><th className="px-4 pb-2 text-right">Action</th></tr></thead>
                <tbody>
                  {hrRows.map((item) => (
                    <tr key={item.id} className="bg-[var(--surface-muted)]">
                      <td className="rounded-l-[12px] px-4 py-4 align-top"><p className="text-[14px] font-semibold text-[var(--text)]">{item.employeeName}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.designation} | {item.department}</p></td>
                      <td className="px-4 py-4 align-top"><p className="text-[14px] font-semibold text-[var(--text)]">{item.claimType}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.subType}</p></td>
                      <td className="px-4 py-4 text-[14px] text-[var(--text)]">{money(item.amount, item.currency)}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1 text-[12px] text-[var(--text-muted)]">
                          <p><span className="font-semibold text-[var(--text)]">Submitted:</span> {formatDateTime(item.submittedAt ?? item.createdAt)}</p>
                          <p><span className="font-semibold text-[var(--text)]">Receipt:</span> {formatDate(item.receiptDate)}</p>
                          {item.processedAt ? <p><span className="font-semibold text-[var(--text)]">Processed:</span> {formatDateTime(item.processedAt)}</p> : item.approvedAt ? <p><span className="font-semibold text-[var(--text)]">Approved:</span> {formatDateTime(item.approvedAt)}</p> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4"><StatusPill tone={statusTone(item.status)}>{formatReimbursementStatus(item.status)}</StatusPill></td>
                      <td className="rounded-r-[12px] px-4 py-4 text-right"><div className="flex flex-wrap justify-end gap-2">{item.status === "awaiting-hr" ? <button className="secondary-button !px-3 !py-2" onClick={() => hrMutation.mutate({ reimbursementId: item.id, status: "approved" })} disabled={hrMutation.isPending}>Approve</button> : null}{(item.status === "awaiting-hr" || item.status === "approved") ? <button className="primary-button !px-3 !py-2" onClick={() => hrMutation.mutate({ reimbursementId: item.id, status: "processed" })} disabled={hrMutation.isPending}>Process</button> : null}{(item.status === "awaiting-hr" || item.status === "approved") ? <button className="secondary-button !px-3 !py-2" onClick={() => hrMutation.mutate({ reimbursementId: item.id, status: "rejected" })} disabled={hrMutation.isPending}>Reject</button> : null}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="page-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div><p className="section-title text-[24px] font-semibold text-[var(--primary)]">Claim Type Allocation</p></div>
              <button className="primary-button" onClick={() => { setAllocationForm(emptyAllocation(employees.find((item) => item.status === "active")?.id ?? "")); setAllocationModalOpen(true); }}><Plus className="h-4 w-4" />Add Claim Type</button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">{presets.map((preset) => <button key={`${preset.category}-${preset.subType}`} type="button" className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] font-medium text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-white" onClick={() => { setAllocationForm((prev) => ({ ...prev, category: preset.category, claimType: preset.claimType, subType: preset.subType, annualLimit: String(preset.annualLimit), remainingBalance: prev.id ? prev.remainingBalance : String(preset.annualLimit), notes: preset.notes })); setAllocationModalOpen(true); }}>{preset.claimType} - {preset.subType}</button>)}</div>
            <div className="mt-5"><label className="topbar-control w-full lg:max-w-md"><Search className="h-4 w-4 text-[var(--text-muted)]" /><input value={allocationSearch} onChange={(event) => setAllocationSearch(event.target.value)} className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" placeholder="Search employee or claim type..." /></label></div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead><tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-4 pb-2">Employee</th><th className="px-4 pb-2">Claim Type</th><th className="px-4 pb-2">Limit</th><th className="px-4 pb-2">Remaining</th><th className="px-4 pb-2 text-right">Action</th></tr></thead>
                <tbody>
                  {allocationRows.map((item) => (
                    <tr key={item.id} className="bg-[var(--surface-muted)]">
                      <td className="rounded-l-[12px] px-4 py-4 align-top"><p className="text-[14px] font-semibold text-[var(--text)]">{item.employeeName}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.department} | {item.designation}</p></td>
                      <td className="px-4 py-4 align-top"><p className="text-[14px] font-semibold text-[var(--text)]">{item.claimType}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.subType} | {formatReimbursementCategory(item.category)}</p></td>
                      <td className="px-4 py-4 text-[14px] text-[var(--text)]">{money(item.annualLimit, item.currency)}</td>
                      <td className="px-4 py-4 text-[14px] text-[var(--text)]">{money(item.remainingBalance, item.currency)}</td>
                      <td className="rounded-r-[12px] px-4 py-4 text-right"><div className="flex flex-wrap justify-end gap-2"><button className="secondary-button !px-3 !py-2" onClick={() => { setAllocationForm({ id: item.id, employeeId: item.employeeId, category: item.category, claimType: item.claimType, subType: item.subType, currency: item.currency, annualLimit: String(item.annualLimit), remainingBalance: String(item.remainingBalance), active: item.active, notes: item.notes }); setAllocationModalOpen(true); }}><Pencil className="h-4 w-4" />Edit</button><button className="secondary-button !px-3 !py-2" onClick={() => deleteAllocationMutation.mutate(item.id)} disabled={deleteAllocationMutation.isPending}><Trash2 className="h-4 w-4" />Delete</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {claimModalOpen ? <ClaimModal form={claimForm} currentEmployee={currentEmployee} claimTypes={myClaimTypes} selectedClaimType={selectedClaimType} receiptName={receiptName} pending={claimMutation.isPending} onClose={() => { setClaimModalOpen(false); setClaimForm(emptyClaim()); setReceiptName(""); }} onChange={setClaimForm} onReceipt={(file) => { setClaimForm((prev) => ({ ...prev, receipt: file })); setReceiptName(file?.name ?? ""); }} onSave={(submit) => claimMutation.mutate(submit)} /> : null}
      {allocationModalOpen ? <AllocationModal form={allocationForm} employees={employees} pending={allocationMutation.isPending} onClose={() => { setAllocationModalOpen(false); setAllocationForm(emptyAllocation()); }} onChange={setAllocationForm} onSave={() => allocationMutation.mutate()} /> : null}
    </div>
  );
}

function RequestTable({ title, rows }: { title: string; rows: ReimbursementRequestRecord[] }) {
  return (
    <section className="page-card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5"><div><p className="section-title text-[24px] font-semibold text-[var(--primary)]">{title}</p></div><div className="rounded-[12px] bg-[var(--panel-alt)] px-4 py-3 text-[13px] text-[var(--text-muted)]">{rows.length} claims</div></div>
      <div className="overflow-x-auto px-4 py-4 lg:px-6"><table className="min-w-full border-separate border-spacing-y-2"><thead><tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-4 pb-2">Claim Type</th><th className="px-4 pb-2">Amount</th><th className="px-4 pb-2">Submitted</th><th className="px-4 pb-2">Receipt Date</th><th className="px-4 pb-2">Status</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="bg-[var(--surface-muted)]"><td className="rounded-l-[12px] px-4 py-4 align-top"><p className="text-[14px] font-semibold text-[var(--text)]">{item.claimType}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.subType} | {formatReimbursementCategory(item.category)}</p></td><td className="px-4 py-4 text-[14px] text-[var(--text)]">{money(item.amount, item.currency)}</td><td className="px-4 py-4 text-[14px] text-[var(--text)]">{formatDateTime(item.submittedAt)}</td><td className="px-4 py-4 text-[14px] text-[var(--text)]">{formatDate(item.receiptDate)}</td><td className="rounded-r-[12px] px-4 py-4"><StatusPill tone={statusTone(item.status)}>{formatReimbursementStatus(item.status)}</StatusPill></td></tr>)}</tbody></table></div>
    </section>
  );
}

function EntitlementList({ rows }: { rows: ReimbursementClaimTypeRecord[] }) {
  return <section className="page-card p-5 sm:p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-[var(--primary)]" /><div><p className="section-title text-[24px] font-semibold text-[var(--primary)]">My Claim Entitlements</p></div></div><div className="mt-5 grid gap-4 xl:grid-cols-2">{rows.map((item) => <div key={item.id} className="panel-muted p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[15px] font-semibold text-[var(--text)]">{item.claimType}</p><p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.subType} | {formatReimbursementCategory(item.category)}</p></div><StatusPill tone={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</StatusPill></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Annual Limit</p><p className="mt-1 text-[15px] font-semibold text-[var(--primary)]">{money(item.annualLimit, item.currency)}</p></div><div><p className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Remaining Balance</p><p className="mt-1 text-[15px] font-semibold text-[var(--primary)]">{money(item.remainingBalance, item.currency)}</p></div></div><p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{item.notes || "No policy notes."}</p></div>)}</div></section>;
}

function DraftList({ rows, onEdit }: { rows: ReimbursementRequestRecord[]; onEdit: (draft: ReimbursementRequestRecord) => void }) {
  return <section className="page-card p-5 sm:p-6"><div className="flex items-center gap-3"><FolderPen className="h-5 w-5 text-[var(--primary)]" /><div><p className="section-title text-[24px] font-semibold text-[var(--primary)]">My Draft Claim</p></div></div><div className="mt-5 grid gap-4 xl:grid-cols-2">{rows.map((item) => <div key={item.id} className="panel-muted p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[15px] font-semibold text-[var(--text)]">{item.claimType}</p><p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.subType} | {item.receiptDate}</p></div><StatusPill tone="neutral">Draft</StatusPill></div><p className="mt-3 text-[14px] text-[var(--text)]">{money(item.amount, item.currency)}</p><p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">{item.remarks || "No remarks added."}</p><div className="mt-4"><button className="secondary-button" onClick={() => onEdit(item)}><Pencil className="h-4 w-4" />Continue Draft</button></div></div>)}</div></section>;
}

function ApprovalQueue({ rows, pending, onApprove }: { rows: ReimbursementRequestRecord[]; pending: boolean; onApprove: (reimbursementId: string, status: "approved" | "rejected") => void }) {
  return <section className="page-card p-5 sm:p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-[var(--primary)]" /><div><p className="section-title text-[24px] font-semibold text-[var(--primary)]">Manager Approval Queue</p></div></div><div className="mt-5 grid gap-4 xl:grid-cols-2">{rows.map((item) => <div key={item.id} className="panel-muted p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p><p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.designation} | {item.claimType} - {item.subType}</p></div><StatusPill tone="warning">Pending Manager</StatusPill></div><p className="mt-3 text-[14px] font-semibold text-[var(--primary)]">{money(item.amount, item.currency)}</p><p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">{item.remarks || "No additional notes."}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><button className="secondary-button" onClick={() => onApprove(item.id, "rejected")} disabled={pending}><X className="h-4 w-4" />Reject</button><button className="primary-button" onClick={() => onApprove(item.id, "approved")} disabled={pending}><Check className="h-4 w-4" />Approve</button></div></div>)}</div></section>;
}

function ClaimModal({ form, currentEmployee, claimTypes, selectedClaimType, receiptName, pending, onClose, onChange, onReceipt, onSave }: { form: ClaimForm; currentEmployee: EmployeeRecord | null; claimTypes: ReimbursementClaimTypeRecord[]; selectedClaimType: ReimbursementClaimTypeRecord | null; receiptName: string; pending: boolean; onClose: () => void; onChange: React.Dispatch<React.SetStateAction<ClaimForm>>; onReceipt: (file: File | null) => void; onSave: (submit: boolean) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.48)] p-4"><div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5"><div><p className="section-title text-[28px] font-semibold text-[var(--primary)]">{form.reimbursementId ? "Edit Draft Reimbursement" : "New Reimbursement"}</p><p className="mt-2 text-[14px] text-[var(--text-muted)]">Add claim details, save a draft, or submit for manager review.</p></div><button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={onClose}><X className="h-4 w-4" /></button></div><div className="flex-1 overflow-auto px-6 py-6"><div className="grid gap-5 md:grid-cols-2"><div className="panel-muted p-4"><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Designation</p><p className="mt-2 text-[15px] font-semibold text-[var(--primary)]">{currentEmployee?.position ?? "-"}</p><p className="mt-1 text-[13px] text-[var(--text-muted)]">{currentEmployee?.department ?? "-"}</p></div><label className="space-y-2 text-[14px] font-medium text-[var(--primary)]"><span>Claim Type</span><select value={form.claimTypeId} onChange={(event) => { const nextClaim = claimTypes.find((item) => item.id === event.target.value); onChange((prev) => ({ ...prev, claimTypeId: event.target.value, currency: nextClaim?.currency ?? prev.currency })); }} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]"><option value="">Select claim type</option>{claimTypes.map((item) => <option key={item.id} value={item.id}>{item.claimType} - {item.subType}</option>)}</select></label><div className="panel-muted p-4"><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Balance</p><p className="mt-2 text-[15px] font-semibold text-[var(--primary)]">{selectedClaimType ? money(selectedClaimType.remainingBalance, selectedClaimType.currency) : "-"}</p><p className="mt-1 text-[13px] text-[var(--text-muted)]">Annual limit {selectedClaimType ? money(selectedClaimType.annualLimit, selectedClaimType.currency) : "-"}</p></div><label className="space-y-2 text-[14px] font-medium text-[var(--primary)]"><span>Receipt Date</span><input type="date" value={form.receiptDate} onChange={(event) => onChange((prev) => ({ ...prev, receiptDate: event.target.value }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" /></label><label className="space-y-2 text-[14px] font-medium text-[var(--primary)]"><span>Currency</span><input value={form.currency} onChange={(event) => onChange((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" /></label><label className="space-y-2 text-[14px] font-medium text-[var(--primary)]"><span>Receipt Amount</span><input type="text" inputMode="numeric" value={form.amount} onChange={(event) => onChange((prev) => ({ ...prev, amount: formatNumberInput(event.target.value) }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" placeholder="Example: 1.000.000" /></label><label className="space-y-2 text-[14px] font-medium text-[var(--primary)] md:col-span-2"><span>Receipt Upload</span><label className="flex min-h-[124px] cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-5 py-6 text-center"><Upload className="h-6 w-6 text-[var(--primary)]" /><p className="mt-3 text-[14px] font-semibold text-[var(--primary)]">{receiptName || "Upload receipt file"}</p><p className="mt-2 text-[12px] text-[var(--text-muted)]">PDF, JPG, or PNG. Required when submitting.</p><input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(event) => onReceipt(event.target.files?.[0] ?? null)} /></label></label><div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800 md:col-span-2">By uploading a receipt, you confirm the document belongs to your reimbursement claim and may be retained for finance, HR, and audit review according to company retention policy.</div><label className="space-y-2 text-[14px] font-medium text-[var(--primary)] md:col-span-2"><span>Remarks</span><textarea rows={5} value={form.remarks} onChange={(event) => onChange((prev) => ({ ...prev, remarks: event.target.value }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" /></label></div></div><div className="shrink-0 flex items-center justify-between gap-3 border-t border-[var(--border)] bg-white px-6 py-5"><button className="secondary-button" onClick={onClose}>Cancel</button><div className="flex flex-col gap-2 sm:flex-row"><button className="secondary-button" onClick={() => onSave(false)} disabled={pending}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Save as Draft</button><button className="primary-button" onClick={() => onSave(true)} disabled={pending}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Submit</button></div></div></div></div>;
}

function AllocationModal({ form, employees, pending, onClose, onChange, onSave }: { form: AllocationForm; employees: EmployeeRecord[]; pending: boolean; onClose: () => void; onChange: React.Dispatch<React.SetStateAction<AllocationForm>>; onSave: () => void }) {
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const activeEmployees = useMemo(() => employees.filter((item) => item.status === "active"), [employees]);
  const selectedEmployee = useMemo(() => activeEmployees.find((item) => item.id === form.employeeId) ?? null, [activeEmployees, form.employeeId]);
  const selectedLabel = selectedEmployee ? `${selectedEmployee.name} - ${selectedEmployee.department} - ${selectedEmployee.position}` : "";
  const keyword = employeeSearch.trim().toLowerCase();
  const filteredEmployees = useMemo(
    () => activeEmployees.filter((item) => keyword.length === 0 || `${item.name} ${item.department} ${item.position} ${item.nik}`.toLowerCase().includes(keyword)),
    [activeEmployees, keyword]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.48)] p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div>
            <p className="section-title text-[28px] font-semibold text-[var(--primary)]">{form.id ? "Edit Claim Type" : "Add Claim Type"}</p>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">Define claim categories, limits, and balances for the selected employee.</p>
          </div>
          <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="relative space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Employee</span>
              <div className="topbar-control w-full">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input
                  value={employeePickerOpen ? employeeSearch : (employeeSearch || selectedLabel)}
                  onFocus={() => {
                    setEmployeePickerOpen(true);
                    if (employeeSearch.length === 0 && selectedLabel) {
                      setEmployeeSearch(selectedLabel);
                    }
                  }}
                  onBlur={() => setTimeout(() => setEmployeePickerOpen(false), 120)}
                  onChange={(event) => {
                    setEmployeeSearch(event.target.value);
                    setEmployeePickerOpen(true);
                  }}
                  placeholder="Search by name, employee ID, department, or position..."
                  className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </div>
              {employeePickerOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-64 overflow-auto rounded-[12px] border border-[var(--border)] bg-white p-2 shadow-lg">
                  {filteredEmployees.map((item) => {
                    const label = `${item.name} - ${item.department} - ${item.position}`;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full rounded-[10px] px-3 py-3 text-left hover:bg-[var(--surface-muted)]"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onChange((prev) => ({ ...prev, employeeId: item.id }));
                          setEmployeeSearch(label);
                          setEmployeePickerOpen(false);
                        }}
                      >
                        <p className="text-[14px] font-semibold text-[var(--text)]">{item.name}</p>
                        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.nik} | {item.department} | {item.position}</p>
                      </button>
                    );
                  })}
                  {filteredEmployees.length === 0 ? <div className="px-3 py-3 text-[13px] text-[var(--text-muted)]">No employees found.</div> : null}
                </div>
              ) : null}
            </label>

            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Category</span>
              <select value={form.category} onChange={(event) => onChange((prev) => ({ ...prev, category: event.target.value as ReimbursementCategory }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]">
                <option value="medical">Medical</option>
                <option value="glasses">Glasses</option>
                <option value="maternity">Maternity</option>
                <option value="transport">Transport</option>
                <option value="communication">Communication</option>
                <option value="wellness">Wellness</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Claim Type</span>
              <input value={form.claimType} onChange={(event) => onChange((prev) => ({ ...prev, claimType: event.target.value }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>

            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Sub Type</span>
              <input value={form.subType} onChange={(event) => onChange((prev) => ({ ...prev, subType: event.target.value }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>

            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Currency</span>
              <input value={form.currency} onChange={(event) => onChange((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>

            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Annual Limit</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.annualLimit}
                onChange={(event) => onChange((prev) => ({ ...prev, annualLimit: formatNumberInput(event.target.value) }))}
                className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]"
                placeholder="Example: 3.500.000"
              />
            </label>

            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)]">
              <span>Remaining Balance</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.remainingBalance}
                onChange={(event) => onChange((prev) => ({ ...prev, remainingBalance: formatNumberInput(event.target.value) }))}
                className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]"
                placeholder="Example: 3.500.000"
              />
            </label>

            <label className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-[14px] font-medium text-[var(--primary)]">
              <input type="checkbox" checked={form.active} onChange={(event) => onChange((prev) => ({ ...prev, active: event.target.checked }))} />
              Active Claim Type
            </label>

            <label className="space-y-2 text-[14px] font-medium text-[var(--primary)] md:col-span-2">
              <span>Notes</span>
              <textarea rows={4} value={form.notes} onChange={(event) => onChange((prev) => ({ ...prev, notes: event.target.value }))} className="w-full rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-[14px]" />
            </label>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-[var(--border)] bg-white px-6 py-5">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={onSave} disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Save Claim Type
          </button>
        </div>
      </div>
    </div>
  );
}

