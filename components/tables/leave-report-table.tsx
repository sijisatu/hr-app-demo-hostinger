"use client";

import { useMemo, useState } from "react";
import { Download, Eye, FileText, Search } from "lucide-react";
import type { EmployeeRecord, LeaveRecord } from "@/lib/api";
import { formatLeaveStatus, formatLeaveType } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { StatusPill } from "@/components/ui/status-pill";

const leaveTone = {
  "Awaiting HR": "warning",
  "Pending Manager": "warning",
  Approved: "success",
  Rejected: "danger"
} as const;

export function LeaveReportTable({
  employees,
  records
}: {
  employees: EmployeeRecord[];
  records: LeaveRecord[];
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");

  const departments = useMemo(
    () => [...new Set(employees.map((item) => item.department))].sort((a, b) => a.localeCompare(b)),
    [employees]
  );
  const leaveTypes = useMemo(
    () => [...new Set(records.map((item) => item.type))].sort((a, b) => a.localeCompare(b)),
    [records]
  );
  const departmentByEmployeeId = useMemo(
    () => new Map(employees.map((item) => [item.id, item.department])),
    [employees]
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((record) => {
      const employeeDepartment = departmentByEmployeeId.get(record.userId) ?? "-";
      const matchesSearch = normalizedSearch.length === 0 || [
        record.employeeName,
        record.reason,
        record.type,
        employeeDepartment
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesDepartment = department === "all" || employeeDepartment === department;
      const matchesType = type === "all" || record.type === type;
      const matchesStatus = status === "all" || record.status === status;
      return matchesSearch && matchesDepartment && matchesType && matchesStatus;
    });
  }, [department, departmentByEmployeeId, records, search, status, type]);

  return (
    <div className="page-card overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap">
            <label className="topbar-control w-full min-w-0 lg:max-w-[280px]">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                placeholder="Search employee, leave type, or reason..."
              />
            </label>

            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="filter-control text-[14px]">
              <option value="all">All Departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select value={type} onChange={(event) => setType(event.target.value)} className="filter-control text-[14px]">
              <option value="all">All Leave Types</option>
              {leaveTypes.map((item) => (
                <option key={item} value={item}>{formatLeaveType(item)}</option>
              ))}
            </select>

            <select value={status} onChange={(event) => setStatus(event.target.value)} className="filter-control text-[14px]">
              <option value="all">All Statuses</option>
              <option value="pending-manager">Pending Manager</option>
              <option value="awaiting-hr">Awaiting HR</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="panel-muted w-full max-w-[360px] px-4 py-3 text-[13px] leading-5 text-[var(--text-muted)]">
            Sick submissions can include doctor letters in image or PDF format for HR review.
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--text-muted)]">
          <p>{filteredRecords.length} leave records match the current filters.</p>
          <button type="button" className="secondary-button !min-h-9 !px-3 !py-2">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="mobile-scroll-shadow overflow-x-auto px-4 py-4 lg:px-6">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <th className="px-4 pb-2">Employee</th>
              <th className="px-4 pb-2">Leave Type</th>
              <th className="px-4 pb-2">Date Range</th>
              <th className="px-4 pb-2">Days</th>
              <th className="px-4 pb-2">Reason</th>
              <th className="px-4 pb-2">Supporting File</th>
              <th className="px-4 pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => {
              const label = formatLeaveStatus(record.status);
              const departmentName = departmentByEmployeeId.get(record.userId) ?? "-";
              const supportingUrl = resolveAssetUrl(record.supportingDocumentUrl);

              return (
                <tr key={record.id} className="rounded-[12px] bg-[var(--surface-muted)] hover:bg-[#edf2f7]">
                  <td className="rounded-l-[12px] px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{record.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{departmentName}</p>
                    <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                      Requested {new Date(record.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top text-[14px] font-semibold text-[var(--text)]">{formatLeaveType(record.type)}</td>
                  <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                    {record.startDate === record.endDate ? record.startDate : `${record.startDate} - ${record.endDate}`}
                  </td>
                  <td className="px-4 py-4 align-top text-[14px] font-medium text-[var(--text)]">{record.daysRequested}</td>
                  <td className="px-4 py-4 align-top text-[13px] leading-5 text-[var(--text-muted)]">{record.reason}</td>
                  <td className="px-4 py-4 align-top">
                    {supportingUrl ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={supportingUrl} target="_blank" rel="noreferrer" className="secondary-button !min-h-9 !px-3 !py-2">
                          <Eye className="h-4 w-4" />
                          Open
                        </a>
                        <a href={supportingUrl} download className="secondary-button !min-h-9 !px-3 !py-2">
                          <FileText className="h-4 w-4" />
                          Download
                        </a>
                      </div>
                    ) : (
                      <span className="text-[13px] text-[var(--text-muted)]">No file</span>
                    )}
                  </td>
                  <td className="rounded-r-[12px] px-4 py-4 align-top">
                    <StatusPill tone={leaveTone[label as keyof typeof leaveTone]}>{label}</StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredRecords.length === 0 ? (
          <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
            No leave records match the current filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
