"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LoaderCircle, Receipt, WalletCards } from "lucide-react";
import {
  createPayrollComponent,
  exportPayslip,
  generatePayrollRun,
  getPayRuns,
  getPayrollComponents,
  getPayrollOverview,
  getPayslips,
  money,
  publishPayrollRun,
  toAssetUrl,
  type PayRunRecord,
  type PayslipRecord,
  type PayrollCalculationType,
  type PayrollComponentRecord,
  type PayrollComponentType,
  type PayrollOverview
} from "@/lib/payroll";
import type { UserRole } from "@/lib/auth-config";

type PayrollWorkspaceProps = {
  role: UserRole;
  userId: string;
  initialOverview: PayrollOverview;
  initialComponents: PayrollComponentRecord[];
  initialRuns: PayRunRecord[];
  initialPayslips: PayslipRecord[];
};

type PayrollComponentFormState = {
  code: string;
  name: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  amount: number;
  percentage: number;
  taxable: boolean;
  active: boolean;
  appliesToAll: boolean;
  description: string;
};

type PayrollRunFormState = {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
};

export function PayrollWorkspace({ role, userId, initialOverview, initialComponents, initialRuns, initialPayslips }: PayrollWorkspaceProps) {
  const queryClient = useQueryClient();
  const isAdminView = role === "admin" || role === "hr";
  const [message, setMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [componentForm, setComponentForm] = useState<PayrollComponentFormState>({
    code: "MEAL-OPS-2",
    name: "Meal Support",
    type: "earning",
    calculationType: "fixed",
    amount: 150000,
    percentage: 0,
    taxable: true,
    active: true,
    appliesToAll: true,
    description: "Monthly payroll component"
  });
  const [runForm, setRunForm] = useState<PayrollRunFormState>({
    periodLabel: "April 2026 Payroll",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    payDate: "2026-04-30"
  });

  const overviewQuery = useQuery({ queryKey: ["payroll-overview"], queryFn: getPayrollOverview, initialData: initialOverview });
  const componentQuery = useQuery({ queryKey: ["payroll-components"], queryFn: getPayrollComponents, initialData: initialComponents });
  const runQuery = useQuery({ queryKey: ["payroll-runs"], queryFn: getPayRuns, initialData: initialRuns });
  const payslipQuery = useQuery({
    queryKey: ["payroll-payslips", isAdminView ? "all" : userId],
    queryFn: () => getPayslips(isAdminView ? undefined : userId),
    initialData: initialPayslips
  });

  const latestPayslip = payslipQuery.data?.[0] ?? null;

  const refreshPayroll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["payroll-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["payroll-components"] }),
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] }),
      queryClient.invalidateQueries({ queryKey: ["payroll-payslips"] })
    ]);
  };

  const createComponentMutation = useMutation({
    mutationFn: () =>
      createPayrollComponent({
        ...componentForm,
        percentage: componentForm.calculationType === "percentage" ? componentForm.percentage : null
      }),
    onSuccess: async (result) => {
      setMessage(`Payroll component ${result.name} added successfully.`);
      await refreshPayroll();
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const generateRunMutation = useMutation({
    mutationFn: () => generatePayrollRun(runForm),
    onSuccess: async (result) => {
      setMessage(`Pay run ${result.payRun.periodLabel} was generated successfully in draft status.`);
      await refreshPayroll();
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const publishRunMutation = useMutation({
    mutationFn: (payRunId: string) => publishPayrollRun(payRunId),
    onSuccess: async (result) => {
      setMessage(`Pay run ${result.periodLabel} was published successfully.`);
      await refreshPayroll();
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const exportPayslipMutation = useMutation({
    mutationFn: (payslipId: string) => exportPayslip(payslipId),
    onSuccess: (result) => {
      setDownloadUrl(toAssetUrl(result.fileUrl));
      setMessage(`Payslip generated successfully: ${result.fileUrl}`);
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const summaryCards = useMemo(() => {
    const overview = overviewQuery.data;
    return [
      { label: "Active Employees", value: overview.activeEmployees.toString(), note: "Included in payroll engine" },
      { label: "Components", value: overview.payrollComponents.toString(), note: "Salary earning & deduction rules" },
      { label: "Draft Runs", value: overview.draftRuns.toString(), note: "Need review before publish" },
      { label: "Published Payslips", value: overview.publishedPayslips.toString(), note: "Available for employee download" }
    ];
  }, [overviewQuery.data]);

  const amountValue = componentForm.calculationType === "percentage" ? String(componentForm.percentage) : String(componentForm.amount);

  const handleAmountChange = (value: string) => {
    const parsed = Number(value);
    setComponentForm((prev) => (prev.calculationType === "percentage" ? { ...prev, percentage: parsed } : { ...prev, amount: parsed }));
  };

  if (!isAdminView) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="page-card p-6">
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-[var(--primary)]" />
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">My Payslip</p>
              </div>
            </div>

            {latestPayslip ? (
              <div className="mt-6 rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[18px] font-semibold text-[var(--text)]">{latestPayslip.periodLabel}</p>
                    <p className="mt-1 text-[14px] text-[var(--text-muted)]">Pay date {latestPayslip.payDate} | {latestPayslip.bankName} {latestPayslip.bankAccountMasked}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-[var(--success-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--success)]">{latestPayslip.status}</span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <InfoMetric label="Gross" value={money(latestPayslip.grossPay)} />
                  <InfoMetric label="Tax" value={money(latestPayslip.taxDeduction)} />
                  <InfoMetric label="Other Deductions" value={money(latestPayslip.otherDeductions)} />
                  <InfoMetric label="Net Pay" value={money(latestPayslip.netPay)} />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="primary-button" onClick={() => exportPayslipMutation.mutate(latestPayslip.id)} disabled={exportPayslipMutation.isPending}>
                    {exportPayslipMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Generate Slip Gaji
                  </button>
                  {(downloadUrl ?? toAssetUrl(latestPayslip.generatedFileUrl)) ? (
                    <a className="secondary-button" href={downloadUrl ?? toAssetUrl(latestPayslip.generatedFileUrl) ?? undefined} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                      Download Slip
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-6 text-[14px] text-[var(--text-muted)]">No payslips are available for this account yet.</p>
            )}
          </section>

          <section className="page-card p-6">
            <p className="section-title text-[22px] font-semibold text-[var(--primary)]">Payslip History</p>
            <div className="mt-5 space-y-4">
              {payslipQuery.data?.map((slip) => (
                <div key={slip.id} className="panel-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-[var(--text)]">{slip.periodLabel}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{money(slip.netPay)} | {slip.status}</p>
                    </div>
                    {slip.generatedFileUrl ? (
                      <a className="secondary-button !min-h-9" href={toAssetUrl(slip.generatedFileUrl) ?? undefined} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)]">{message}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="kpi-grid">
        {summaryCards.map((item) => (
          <div key={item.label} className="page-card p-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.label}</p>
            <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{item.value}</p>
            <p className="mt-3 text-[14px] text-[var(--text-muted)]">{item.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="page-card p-6">
            <div>
              <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Pay Runs</p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <InputField label="Period Label" value={runForm.periodLabel} onChange={(value) => setRunForm((prev) => ({ ...prev, periodLabel: value }))} />
              <InputField label="Start" type="date" value={runForm.periodStart} onChange={(value) => setRunForm((prev) => ({ ...prev, periodStart: value }))} />
              <InputField label="End" type="date" value={runForm.periodEnd} onChange={(value) => setRunForm((prev) => ({ ...prev, periodEnd: value }))} />
              <InputField label="Pay Date" type="date" value={runForm.payDate} onChange={(value) => setRunForm((prev) => ({ ...prev, payDate: value }))} />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button className="primary-button" onClick={() => generateRunMutation.mutate()} disabled={generateRunMutation.isPending}>
                {generateRunMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Generate Payroll Draft
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {runQuery.data?.map((run) => (
                <div key={run.id} className="panel-muted p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[16px] font-semibold text-[var(--text)]">{run.periodLabel}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{run.periodStart} - {run.periodEnd} | Pay date {run.payDate}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={run.status === "published" ? "inline-flex rounded-full bg-[var(--success-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--success)]" : "inline-flex rounded-full bg-[var(--warning-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--warning)]"}>{run.status}</span>
                      {run.status === "draft" ? <button className="secondary-button" onClick={() => publishRunMutation.mutate(run.id)} disabled={publishRunMutation.isPending}>Publish</button> : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <InfoMetric label="Employees" value={String(run.employeeCount)} compact />
                    <InfoMetric label="Gross" value={money(run.totalGross)} compact />
                    <InfoMetric label="Tax" value={money(run.totalTax)} compact />
                    <InfoMetric label="Net" value={money(run.totalNet)} compact />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="page-card p-6">
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Generated Payslips</p>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    <th className="px-4 pb-2">Employee</th>
                    <th className="px-4 pb-2">Period</th>
                    <th className="px-4 pb-2">Gross</th>
                    <th className="px-4 pb-2">Tax</th>
                    <th className="px-4 pb-2">Net</th>
                    <th className="px-4 pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payslipQuery.data?.map((slip) => (
                    <tr key={slip.id} className="bg-[var(--surface-muted)]">
                      <td className="rounded-l-[12px] px-4 py-4 text-[14px] font-medium text-[var(--text)]">{slip.employeeName}</td>
                      <td className="px-4 py-4 text-[13px] text-[var(--text-muted)]">{slip.periodLabel}</td>
                      <td className="px-4 py-4 text-[13px] text-[var(--text-muted)]">{money(slip.grossPay)}</td>
                      <td className="px-4 py-4 text-[13px] text-[var(--text-muted)]">{money(slip.taxDeduction)}</td>
                      <td className="px-4 py-4 text-[13px] font-medium text-[var(--text)]">{money(slip.netPay)}</td>
                      <td className="rounded-r-[12px] px-4 py-4">
                        <button className="secondary-button" onClick={() => exportPayslipMutation.mutate(slip.id)} disabled={exportPayslipMutation.isPending}>Generate Slip</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="page-card p-6">
            <div className="flex items-center gap-3">
              <WalletCards className="h-5 w-5 text-[var(--primary)]" />
              <div>
                <p className="section-title text-[22px] font-semibold text-[var(--primary)]">Salary Component Engine</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <InputField label="Code" value={componentForm.code} onChange={(value) => setComponentForm((prev) => ({ ...prev, code: value }))} />
              <InputField label="Name" value={componentForm.name} onChange={(value) => setComponentForm((prev) => ({ ...prev, name: value }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Type" value={componentForm.type} options={["earning", "deduction"]} onChange={(value) => setComponentForm((prev) => ({ ...prev, type: value as PayrollComponentType }))} />
                <SelectField label="Calculation" value={componentForm.calculationType} options={["fixed", "percentage"]} onChange={(value) => setComponentForm((prev) => ({ ...prev, calculationType: value as PayrollCalculationType }))} />
              </div>
              <InputField label={componentForm.calculationType === "percentage" ? "Percentage" : "Amount"} type="number" value={amountValue} onChange={handleAmountChange} />
              <InputField label="Description" value={componentForm.description} onChange={(value) => setComponentForm((prev) => ({ ...prev, description: value }))} />

              <div className="flex flex-wrap gap-3 text-[14px] text-[var(--text-muted)]">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={componentForm.taxable} onChange={(event) => setComponentForm((prev) => ({ ...prev, taxable: event.target.checked }))} /> Taxable</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={componentForm.active} onChange={(event) => setComponentForm((prev) => ({ ...prev, active: event.target.checked }))} /> Active</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={componentForm.appliesToAll} onChange={(event) => setComponentForm((prev) => ({ ...prev, appliesToAll: event.target.checked }))} /> Apply to all employees</label>
              </div>

              <button className="primary-button w-full" onClick={() => createComponentMutation.mutate()} disabled={createComponentMutation.isPending}>
                {createComponentMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Add Component
              </button>
            </div>
          </section>

          <section className="page-card p-6">
            <p className="section-title text-[22px] font-semibold text-[var(--primary)]">Active Components</p>
            <div className="mt-5 max-h-[420px] space-y-4 overflow-y-auto">
              {componentQuery.data?.map((component) => (
                <div key={component.id} className="panel-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[var(--text)]">{component.name}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{component.code} | {component.description}</p>
                    </div>
                    <span className={component.type === "earning" ? "inline-flex rounded-full bg-[var(--success-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--success)]" : "inline-flex rounded-full bg-[var(--danger-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--danger)]"}>{component.type}</span>
                  </div>
                  <p className="mt-3 text-[13px] text-[var(--text-muted)]">{component.calculationType === "percentage" ? `${component.percentage}% of base salary` : money(component.amount)} | {component.appliesToAll ? "Global" : "Scoped"}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)]">{message}</div> : null}
    </div>
  );
}

function InputField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="filter-control w-full" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="filter-control w-full">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function InfoMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "panel-muted p-3" : "panel-muted p-4"}>
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-[16px] font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}
