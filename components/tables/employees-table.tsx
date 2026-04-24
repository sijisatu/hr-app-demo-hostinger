"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Eye, Landmark, MapPin, MoreVertical, Search, ShieldCheck, Trash2 } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { currency, type EmployeeRecord } from "@/lib/api";

const contractToneMap = {
  permanent: "success",
  contract: "warning",
  intern: "danger"
} as const;

const contractLabelMap = {
  permanent: "Permanent",
  contract: "Contract",
  intern: "Magang"
} as const;

const roleLabelMap = {
  admin: "Admin",
  hr: "HR",
  employee: "Employee",
  manager: "Manager"
} as const;

const pageSizeOptions = [10, 30, 50, 100] as const;

export function EmployeesTable({
  employees,
  onView,
  onEdit,
  onDelete
}: {
  employees: EmployeeRecord[];
  onView?: (employee: EmployeeRecord) => void;
  onEdit?: (employee: EmployeeRecord) => void;
  onDelete?: (employee: EmployeeRecord) => void;
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [contractStatus, setContractStatus] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageSize, setPageSize] = useState<number>(10);

  const departments = useMemo(
    () => [...new Set(employees.map((item) => item.department))].sort((a, b) => a.localeCompare(b)),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch = normalizedSearch.length === 0
        || employee.name.toLowerCase().includes(normalizedSearch)
        || employee.nik.toLowerCase().includes(normalizedSearch)
        || employee.employeeNumber.toLowerCase().includes(normalizedSearch);
      const matchesDepartment = department === "all" || employee.department === department;
      const matchesContract = contractStatus === "all" || employee.contractStatus === contractStatus;
      const matchesStatus = status === "all" || employee.status === status;
      return matchesSearch && matchesDepartment && matchesContract && matchesStatus;
    });
  }, [contractStatus, department, employees, search, status]);

  const visibleEmployees = filteredEmployees.slice(0, pageSize);

  return (
    <div className="page-card overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap">
            <label className="topbar-control w-full min-w-0 lg:max-w-[320px]">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                placeholder="Search by name, NIK, or employee ID..."
              />
            </label>

            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="filter-control text-[14px]">
              <option value="all">All Departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select value={contractStatus} onChange={(event) => setContractStatus(event.target.value)} className="filter-control text-[14px]">
              <option value="all">All Contract Types</option>
              <option value="permanent">Permanent</option>
              <option value="contract">Contract</option>
              <option value="intern">Magang</option>
            </select>

            <select value={status} onChange={(event) => setStatus(event.target.value)} className="filter-control text-[14px]">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))} className="filter-control text-[14px]">
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>Show {option}</option>
              ))}
            </select>
          </div>

          <div className="panel-muted max-w-[360px] px-4 py-3 text-[13px] leading-5 text-[var(--text-muted)]">
            Use the action menu on the right to review employee details or edit each tab.
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--text-muted)]">
          <p>{filteredEmployees.length} employees match the current filters.</p>
          <p>Showing {Math.min(visibleEmployees.length, pageSize)} of {filteredEmployees.length} employees.</p>
        </div>
      </div>

      <div className="mobile-scroll-shadow overflow-x-auto px-4 py-4 lg:px-6">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <th className="px-4 pb-2">Employee</th>
              <th className="px-4 pb-2">Job Details</th>
              <th className="px-4 pb-2">Contract</th>
              <th className="px-4 pb-2">Financial</th>
              <th className="px-4 pb-2">Education</th>
              <th className="px-4 pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((employee) => (
              <tr key={employee.id} className="rounded-[12px] bg-[var(--surface-muted)] hover:bg-[#edf2f7]">
                <td className="rounded-l-[12px] px-4 py-4 align-top">
                  <p className="text-[14px] font-semibold text-[var(--text)]">{employee.name}</p>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">{employee.employeeNumber} • {employee.nik}</p>
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">{employee.email}</p>
                </td>
                <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                    <BriefcaseBusiness className="h-4 w-4" />
                    {employee.position}
                  </div>
                  <p className="mt-2">{employee.department}</p>
                  <p className="mt-2">{roleLabelMap[employee.role]} • {employee.workType}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {employee.workLocation}
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={employee.status}>{employee.status === "active" ? "Active" : "Inactive"}</StatusPill>
                    <StatusPill tone={contractToneMap[employee.contractStatus]}>{contractLabelMap[employee.contractStatus]}</StatusPill>
                  </div>
                  <p className="mt-3 text-[13px] text-[var(--text-muted)]">{employee.contractStart} - {employee.contractEnd ?? "Open-ended"}</p>
                  <p className="mt-2 text-[13px] text-[var(--text-muted)]">{employee.managerName}</p>
                </td>
                <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                    <Landmark className="h-4 w-4" />
                    {currency(employee.baseSalary + employee.allowance)}
                  </div>
                  <p className="mt-2">Base: {currency(employee.baseSalary)}</p>
                  <p className="mt-2">Allowance: {currency(employee.allowance)}</p>
                  <p className="mt-2">{employee.taxProfile}</p>
                </td>
                <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                    <ShieldCheck className="h-4 w-4" />
                    {employee.educationHistory.length} education
                  </div>
                  <p className="mt-2">{employee.workExperiences.length} work experiences</p>
                  <p className="mt-2">{employee.bankName} • {employee.bankAccountMasked}</p>
                </td>
                <td className="rounded-r-[12px] px-4 py-4 text-right align-top">
                  <div className="flex justify-end gap-2">
                    <button className="secondary-button !min-h-9 !w-9 !rounded-full !p-0" onClick={() => onView?.(employee)} title="View detail">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="secondary-button !min-h-9 !w-9 !rounded-full !p-0" onClick={() => onEdit?.(employee)} title="Edit employee">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    <button className="secondary-button !min-h-9 !w-9 !rounded-full !p-0" onClick={() => onDelete?.(employee)} title="Delete employee">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibleEmployees.length === 0 ? (
          <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
            No employee data matches the current filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
