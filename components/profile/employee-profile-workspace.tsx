"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Download, Eye, FileText, KeyRound, LoaderCircle, X } from "lucide-react";
import type { EmployeeDocumentRecord, EmployeeRecord } from "@/lib/api";
import { findLeaveAllocation, getLeaveAllocationAvailable } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";

type TabKey = "personal" | "education" | "job" | "experience" | "financial" | "documents";

const tabs: { key: TabKey; label: string }[] = [
  { key: "personal", label: "Personal Info" },
  { key: "education", label: "Education" },
  { key: "job", label: "Job Details" },
  { key: "experience", label: "Work Experience" },
  { key: "financial", label: "Financial Details" },
  { key: "documents", label: "Documents" }
];

const documentTypeLabels: Record<string, string> = {
  ktp: "Identity Card",
  ijazah: "Diploma",
  sertifikat: "Certificate",
  npwp: "NPWP",
  kk: "Family Card",
  "kontrak-kerja": "Employment Contract",
  bpjs: "BPJS",
  lainnya: "Other"
};

function money(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function resolveDocumentUrl(fileUrl: string) {
  return resolveAssetUrl(fileUrl) ?? "";
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
      <span>{label}</span>
      <div className="filter-control flex min-h-12 items-center bg-[var(--surface-muted)] text-[var(--text)]">{value || "-"}</div>
    </label>
  );
}

function ReadOnlyArea({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <label className={`block space-y-2 text-[14px] font-medium text-[var(--text)] ${className}`}>
      <span>{label}</span>
      <div className="filter-control min-h-[120px] whitespace-pre-wrap bg-[var(--surface-muted)] py-3 text-[var(--text)]">{value || "-"}</div>
    </label>
  );
}

function MiniCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel-muted p-4">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-3 text-[28px] font-semibold text-[var(--primary)]">{value}</p>
      <p className="mt-2 text-[13px] text-[var(--text-muted)]">{note}</p>
    </div>
  );
}

function DocumentPreview({ document }: { document: EmployeeDocumentRecord }) {
  const resolvedUrl = resolveDocumentUrl(document.fileUrl);
  const normalized = document.fileName.toLowerCase();
  const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((extension) => normalized.endsWith(extension));
  const isPdf = normalized.endsWith(".pdf");

  if (isImage) {
    return (
      <div className="flex justify-center">
        <Image src={resolvedUrl} alt={document.title} width={1400} height={1400} unoptimized className="max-h-[72vh] h-auto w-auto max-w-full rounded-[20px] border border-[var(--border)] bg-white object-contain shadow-soft" />
      </div>
    );
  }

  if (isPdf) {
    return (
      <iframe
        src={resolvedUrl}
        title={document.title}
        className="h-[72vh] w-full rounded-[20px] border border-[var(--border)] bg-white"
      />
    );
  }

  return (
    <div className="flex h-[72vh] flex-col items-center justify-center gap-4 rounded-[20px] border border-dashed border-[var(--border)] bg-white p-8 text-center">
      <FileText className="h-12 w-12 text-[var(--primary)]" />
      <div>
        <p className="text-[18px] font-semibold text-[var(--text)]">Preview is not available for this file type.</p>
        <p className="mt-2 text-[14px] text-[var(--text-muted)]">Download the file or open it in a new tab to view the full document.</p>
      </div>
      <div className="flex gap-3">
        <a href={resolvedUrl} download={document.fileName} className="secondary-button"><Download className="h-4 w-4" /> Download</a>
        <a href={resolvedUrl} target="_blank" rel="noreferrer" className="secondary-button">Open in New Tab</a>
      </div>
    </div>
  );
}

export function EmployeeProfileWorkspace({
  employee,
  sickLeaveUsed
}: {
  employee: EmployeeRecord;
  sickLeaveUsed: number;
}) {
  const [tab, setTab] = useState<TabKey>("personal");
  const [previewDocument, setPreviewDocument] = useState<EmployeeDocumentRecord | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const selectedAllowances = useMemo(
    () => employee.financialComponentIds.length,
    [employee.financialComponentIds.length]
  );
  const annualAllocation = useMemo(
    () => findLeaveAllocation(employee.leaveBalances, "Annual Leave"),
    [employee.leaveBalances]
  );
  const permissionAllocation = useMemo(
    () => findLeaveAllocation(employee.leaveBalances, "Permission"),
    [employee.leaveBalances]
  );

  const submitPasswordChange = async () => {
    setPasswordError(null);
    setPasswordMessage(null);

    if (!passwordForm.currentPassword.trim() || !passwordForm.newPassword.trim() || !passwordForm.confirmPassword.trim()) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (passwordForm.newPassword.trim().length < 8) {
      setPasswordError("The new password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("The new password confirmation does not match.");
      return;
    }

    setPasswordPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const payload = await response.json().catch(() => null) as { error?: string; data?: { message?: string } } | null;
      if (!response.ok) {
        setPasswordError(payload?.error ?? "Failed to change password.");
        return;
      }
      setPasswordMessage(payload?.data?.message ?? "Password updated successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordModalOpen(false);
    } finally {
      setPasswordPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="page-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Employee Profile</p>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight text-[var(--primary)] sm:text-[30px]">{employee.name}</h2>
            <p className="mt-2 text-[14px] text-[var(--text-muted)] sm:text-[15px]">{employee.position} - {employee.department}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
            <MiniCard label="Employee ID" value={employee.employeeNumber} note={`NIK ${employee.nik}`} />
            <MiniCard label="Status" value={`${employee.status} - ${employee.contractStatus}`} note={employee.employmentType} />
          </div>
        </div>
      </section>

      <section className="page-card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 pt-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((item) => (
              <button
                key={item.key}
                className={tab === item.key
                  ? "rounded-t-[14px] border border-[var(--border)] border-b-white bg-white px-4 py-3 text-[14px] font-semibold text-[var(--primary)]"
                  : "rounded-t-[14px] px-4 py-3 text-[14px] text-[var(--text-muted)]"}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6">
          {tab === "personal" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Name" value={employee.name} />
              <ReadOnlyField label="NIK" value={employee.nik} />
              <ReadOnlyField label="Email" value={employee.email} />
              <ReadOnlyField label="Phone" value={employee.phone} />
              <ReadOnlyField label="Birth Place" value={employee.birthPlace} />
              <ReadOnlyField label="Birth Date" value={employee.birthDate} />
              <ReadOnlyField label="Gender" value={employee.gender} />
              <ReadOnlyField label="Marital Status" value={employee.maritalStatus} />
              <ReadOnlyField label="Date of Marriage" value={employee.marriageDate ?? "-"} />
              <ReadOnlyField label="Identity Number" value={employee.idCardNumber} />
              <ReadOnlyArea label="Address" value={employee.address} className="md:col-span-2" />
              <div className="page-card p-4 sm:p-5 md:col-span-2">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="section-title text-[18px] font-semibold text-[var(--primary)] sm:text-[20px]">Account Access</p>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => setPasswordModalOpen(true)}>
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <ReadOnlyField label="Account Active" value={employee.appLoginEnabled ? "Yes" : "No"} />
                  <ReadOnlyField label="Username" value={employee.loginUsername ?? "-"} />
                  <ReadOnlyField label="Password" value={employee.appLoginEnabled ? "Hidden for security" : "-"} />
                </div>
              </div>
            </div>
          ) : null}

          {tab === "education" ? (
            <div className="space-y-4">
              {employee.educationHistory.length === 0 ? (
                <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">No education records available.</div>
              ) : employee.educationHistory.map((item, index) => (
                <div key={`edu-${index}`} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="mb-4 text-[15px] font-semibold text-[var(--primary)]">Education #{index + 1}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <ReadOnlyField label="Level" value={item.level} />
                    <ReadOnlyField label="Institution" value={item.institution} />
                    <ReadOnlyField label="Major" value={item.major} />
                    <ReadOnlyField label="Start Year" value={item.startYear} />
                    <ReadOnlyField label="End Year" value={item.endYear} />
                  </div>
                </div>
              ))}
              <ReadOnlyArea label="Education Summary" value={employee.education} />
            </div>
          ) : null}

          {tab === "job" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Department" value={employee.department} />
              <ReadOnlyField label="Position" value={employee.position} />
              <ReadOnlyField label="Role" value={employee.role} />
              <ReadOnlyField label="Status" value={employee.status} />
              <ReadOnlyField label="Contract Status" value={employee.contractStatus} />
              <ReadOnlyField label="Contract Start" value={employee.contractStart} />
              <ReadOnlyField label="Contract End" value={employee.contractEnd ?? "-"} />
              <ReadOnlyField label="Manager" value={employee.managerName} />
              <ReadOnlyField label="Work Location" value={employee.workLocation} />
              <ReadOnlyField label="Work Type" value={employee.workType} />
            </div>
          ) : null}

          {tab === "experience" ? (
            <div className="space-y-4">
              {employee.workExperiences.length === 0 ? (
                <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">No work experience records available.</div>
              ) : employee.workExperiences.map((item, index) => (
                <div key={`exp-${index}`} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="mb-4 text-[15px] font-semibold text-[var(--primary)]">Experience #{index + 1}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <ReadOnlyField label="Company" value={item.company} />
                    <ReadOnlyField label="Role" value={item.role} />
                    <ReadOnlyField label="Start Date" value={item.startDate} />
                    <ReadOnlyField label="End Date" value={item.endDate} />
                    <ReadOnlyArea label="Description" value={item.description} className="md:col-span-2" />
                  </div>
                </div>
              ))}
              <ReadOnlyArea label="Work Experience Summary" value={employee.workExperience} />
            </div>
          ) : null}

          {tab === "financial" ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Base Salary" value={money(employee.baseSalary)} />
                <ReadOnlyField label="Tax Profile" value={employee.taxProfile} />
                <ReadOnlyField label="Bank" value={employee.bankName} />
                <ReadOnlyField label="Bank Account" value={employee.bankAccountMasked} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MiniCard label="Allowance" value={money(employee.allowance)} note={`${selectedAllowances} selected components`} />
                <MiniCard label="Annual Leave" value={`${getLeaveAllocationAvailable(annualAllocation ?? { code: "", label: "", days: 0, carryOver: 0, carryOverExpiresAt: null })} days`} note="Current + carry over annual leave" />
                <MiniCard label="Sick Leave Used" value={`${sickLeaveUsed} times`} note="Displayed as total usage count" />
                <MiniCard label="Permission" value={`${getLeaveAllocationAvailable(permissionAllocation ?? { code: "", label: "", days: 0, carryOver: 0, carryOverExpiresAt: null })} days`} note="Remaining permission balance" />
              </div>
            </div>
          ) : null}

          {tab === "documents" ? (
            <div className="space-y-5">
              <div className="page-card p-4 sm:p-5">
                <p className="section-title text-[18px] font-semibold text-[var(--primary)] sm:text-[20px]">Employee Documents</p>
              </div>

              <section className="page-card p-4 sm:p-5">
                <div className="space-y-3">
                  {employee.documents.length === 0 ? (
                    <div className="panel-muted p-4 text-[14px] text-[var(--text-muted)]">No uploaded documents are available for this account.</div>
                  ) : employee.documents.map((item) => (
                    <div key={item.id} className="panel-muted flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[var(--text)]">{item.title}</p>
                        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{documentTypeLabels[item.type] ?? item.type} • {item.fileName}</p>
                        <p className="mt-1 text-[12px] text-[var(--text-muted)]">Uploaded: {new Date(item.uploadedAt).toLocaleString("en-GB")}</p>
                        {item.notes ? <p className="mt-2 text-[13px] text-[var(--text-muted)]">{item.notes}</p> : null}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <button className="secondary-button" onClick={() => setPreviewDocument(item)}><Eye className="h-4 w-4" /> Preview</button>
                        <a href={resolveDocumentUrl(item.fileUrl)} download={item.fileName} className="secondary-button"><Download className="h-4 w-4" /> Download</a>
                        <a href={resolveDocumentUrl(item.fileUrl)} target="_blank" rel="noreferrer" className="secondary-button">Open</a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>

      {previewDocument ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,23,42,0.58)] p-3 sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="section-title truncate text-[20px] font-semibold text-[var(--primary)] sm:text-[24px]">{previewDocument.title}</p>
                <p className="mt-2 text-[13px] text-[var(--text-muted)] sm:text-[14px]">
                  {documentTypeLabels[previewDocument.type] ?? previewDocument.type} • {previewDocument.fileName}
                </p>
              </div>
              <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={() => setPreviewDocument(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-muted)] p-3 sm:p-5">
              <DocumentPreview document={previewDocument} />
            </div>
          </div>
        </div>
      ) : null}

      {passwordModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.58)] p-4">
          <div className="w-full max-w-lg rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
              <div>
                <p className="section-title text-[22px] font-semibold text-[var(--primary)]">Change Password</p>
              </div>
              <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={() => setPasswordModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
                <span>Current Password</span>
                <input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))} className="filter-control w-full" />
              </label>
              <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
                <span>New Password</span>
                <input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))} className="filter-control w-full" />
              </label>
              <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
                <span>Confirm New Password</span>
                <input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))} className="filter-control w-full" />
              </label>
              {passwordError ? <div className="rounded-[12px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-[14px] text-[var(--danger)]">{passwordError}</div> : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
              <button className="secondary-button" onClick={() => setPasswordModalOpen(false)}>Cancel</button>
              <button className="primary-button" onClick={submitPasswordChange} disabled={passwordPending}>
                {passwordPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Save Password
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordMessage ? (
        <div className="fixed right-4 top-4 z-[80] w-full max-w-[460px] rounded-[14px] border border-[var(--border)] bg-white px-4 py-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] text-[var(--text)]">{passwordMessage}</p>
            <button type="button" className="secondary-button !min-h-8 !w-8 !rounded-full !p-0" onClick={() => setPasswordMessage(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
