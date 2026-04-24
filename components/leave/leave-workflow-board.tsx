"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, LoaderCircle, Pencil, Plus, Search, Trash2, WalletCards, X } from "lucide-react";
import {
  getEmployees,
  getLeaveAllocationAvailable,
  toLeaveTypeCode,
  updateEmployee,
  type EmployeeRecord,
  type LeaveBalanceAllocation
} from "@/lib/api";

type Mode = "create" | "edit" | null;

type AllocationFormRow = {
  id: string;
  code: string;
  label: string;
  days: string;
  carryOver: string;
  carryOverExpiresAt: string;
};

type LeaveForm = {
  employeeId: string;
  sickUsed: string;
  allocations: AllocationFormRow[];
};

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createAllocationRow(seed?: Partial<LeaveBalanceAllocation>): AllocationFormRow {
  const label = seed?.label ?? "";
  return {
    id: seed?.code ?? crypto.randomUUID(),
    code: seed?.code ?? toLeaveTypeCode(label),
    label,
    days: String(seed?.days ?? 0),
    carryOver: String(seed?.carryOver ?? 0),
    carryOverExpiresAt: seed?.carryOverExpiresAt ?? ""
  };
}

function blankForm(employeeId = ""): LeaveForm {
  return {
    employeeId,
    sickUsed: "0",
    allocations: [createAllocationRow({ label: "Annual Leave", code: "annual-leave", days: 12 })]
  };
}

function getEmployeeAllocations(employee: EmployeeRecord) {
  const allocations = Array.isArray(employee.leaveBalances?.allocations)
    ? employee.leaveBalances.allocations
    : [];
  return allocations.length > 0
    ? allocations
    : [{ code: "annual-leave", label: "Annual Leave", days: 12, carryOver: 0, carryOverExpiresAt: null } satisfies LeaveBalanceAllocation];
}

function mapEmployeeToForm(employee: EmployeeRecord): LeaveForm {
  const allocations = getEmployeeAllocations(employee).map((allocation) => createAllocationRow(allocation));

  return {
    employeeId: employee.id,
    sickUsed: String(employee.leaveBalances?.sickUsed ?? 0),
    allocations
  };
}

function normalizeAllocations(rows: AllocationFormRow[]) {
  return rows
    .map((row) => {
      const label = row.label.trim();
      if (!label) {
        return null;
      }
      return {
        code: toLeaveTypeCode(row.code || label),
        label,
        days: numberOrZero(row.days),
        carryOver: numberOrZero(row.carryOver),
        carryOverExpiresAt: row.carryOverExpiresAt || null
      } satisfies LeaveBalanceAllocation;
    })
    .filter((row): row is LeaveBalanceAllocation => row !== null);
}

export function LeaveWorkflowBoard() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [search, setSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<LeaveForm>(blankForm());

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees });
  const employees = employeesQuery.data ?? [];
  const activeEmployees = employees.filter((employee) => employee.status === "active");
  const formAllocations = Array.isArray(form.allocations) ? form.allocations : [];

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return activeEmployees;
    }
    return activeEmployees.filter((employee) =>
      employee.name.toLowerCase().includes(keyword) ||
      employee.nik.toLowerCase().includes(keyword) ||
      employee.department.toLowerCase().includes(keyword) ||
      employee.position.toLowerCase().includes(keyword)
    );
  }, [activeEmployees, search]);

  const employeeSearchOptions = useMemo(() => {
    const keyword = employeeSearch.trim().toLowerCase();
    if (!keyword) {
      return activeEmployees;
    }
    return activeEmployees.filter((employee) =>
      employee.name.toLowerCase().includes(keyword) ||
      employee.nik.toLowerCase().includes(keyword) ||
      employee.department.toLowerCase().includes(keyword) ||
      employee.position.toLowerCase().includes(keyword)
    );
  }, [activeEmployees, employeeSearch]);

  const openCreate = () => {
    const firstEmployee = activeEmployees[0];
    if (!firstEmployee) {
      setMessage("No active employees are available for leave allocation.");
      return;
    }
    setMode("create");
    setEmployeePickerOpen(false);
    setEmployeeSearch(`${firstEmployee.name} - ${firstEmployee.nik}`);
    setForm(blankForm(firstEmployee.id));
  };

  const openEdit = (employeeId: string) => {
    const target = activeEmployees.find((employee) => employee.id === employeeId);
    if (!target) {
      return;
    }
    setMode("edit");
    setEmployeePickerOpen(false);
    setEmployeeSearch(`${target.name} - ${target.nik}`);
    setForm(mapEmployeeToForm(target));
  };

  const updateRow = (id: string, key: keyof AllocationFormRow, value: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: (prev.allocations ?? []).map((row) => {
        if (row.id !== id) {
          return row;
        }
        if (key === "label") {
          return {
            ...row,
            label: value,
            code: toLeaveTypeCode(value)
          };
        }
        return { ...row, [key]: value };
      })
    }));
  };

  const addAllocationRow = () => {
    setForm((prev) => ({
      ...prev,
      allocations: [...(prev.allocations ?? []), createAllocationRow()]
    }));
  };

  const removeAllocationRow = (id: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: (prev.allocations ?? []).filter((row) => row.id !== id)
    }));
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const employee = employees.find((item) => item.id === form.employeeId);
      if (!employee) {
        throw new Error("Select an employee first.");
      }

      const allocations = normalizeAllocations(formAllocations);
      const labels = allocations.map((allocation) => allocation.label.toLowerCase());
      if (allocations.length === 0) {
        throw new Error("Add at least one leave type before saving.");
      }
      if (new Set(labels).size !== labels.length) {
        throw new Error("Each leave type label must be unique.");
      }

      return updateEmployee(employee.id, {
        leaveBalances: {
          allocations,
          sickUsed: numberOrZero(form.sickUsed),
          balanceYear: new Date().getFullYear()
        }
      });
    },
    onSuccess: async (employee) => {
      setMessage(`Leave allocation for ${employee.name} was saved.`);
      setMode(null);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error: Error) => setMessage(error.message)
  });

  const formEmployee = activeEmployees.find((employee) => employee.id === form.employeeId) ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
        <div className="flex items-center gap-3 text-white/74">
          <WalletCards className="h-5 w-5" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em]">Leave System</p>
        </div>
        <p className="mt-6 max-w-4xl text-[15px] leading-[1.6] text-white/80">
          Build custom leave portfolios for each employee, including carry over and expiry rules.
        </p>
      </section>

      <section className="page-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="topbar-control w-full lg:max-w-md">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
              placeholder="Search employee, ID, department, or role..."
            />
          </label>
          <button className="primary-button shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Leave Allocation
          </button>
        </div>
      </section>

      <section className="page-card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Leave Allocation List</p>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">{filteredEmployees.length} active employees.</p>
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-4 lg:px-6">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-4 pb-2">Employee</th>
                <th className="px-4 pb-2">Leave Types</th>
                <th className="px-4 pb-2">Total Balance</th>
                <th className="px-4 pb-2">Sick Used</th>
                <th className="px-4 pb-2">Year</th>
                <th className="px-4 pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const employeeAllocations = getEmployeeAllocations(employee);
                const allocationCount = employeeAllocations.length;
                const totalBalance = employeeAllocations.reduce((sum, allocation) => sum + getLeaveAllocationAvailable(allocation), 0);
                return (
                  <tr key={employee.id} className="bg-[var(--surface-muted)]">
                    <td className="rounded-l-[12px] px-4 py-4 align-top">
                      <p className="text-[14px] font-semibold text-[var(--text)]">{employee.name}</p>
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">{employee.nik} | {employee.department}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {employeeAllocations.slice(0, 3).map((allocation) => (
                          <span key={allocation.code} className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[var(--primary)]">
                            {allocation.label}
                          </span>
                        ))}
                        {allocationCount > 3 ? (
                          <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[var(--text-muted)]">
                            +{allocationCount - 3} more
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{totalBalance.toFixed(1)} days</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{Number(employee.leaveBalances?.sickUsed ?? 0).toFixed(1)}</td>
                    <td className="px-4 py-4 text-[14px] text-[var(--text)]">{employee.leaveBalances?.balanceYear ?? new Date().getFullYear()}</td>
                    <td className="rounded-r-[12px] px-4 py-4 text-right">
                      <button className="secondary-button" onClick={() => openEdit(employee.id)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {employeesQuery.isLoading ? (
            <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading leave allocation...</span>
            </div>
          ) : null}

          {!employeesQuery.isLoading && filteredEmployees.length === 0 ? (
            <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
              No employee records matched the current leave allocation filters.
            </div>
          ) : null}
        </div>
      </section>

      {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)]">{message}</div> : null}

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
              <div>
                <p className="section-title text-[28px] font-semibold text-[var(--primary)]">{mode === "create" ? "Add Leave Allocation" : "Edit Leave Allocation"}</p>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">Create and manage custom leave types for the selected employee.</p>
              </div>
              <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={() => setMode(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
              <div className="space-y-6">
                <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]">
                  <span>Employee</span>
                  {mode === "edit" ? (
                    <input value={employeeSearch} disabled className="filter-control w-full disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]" />
                  ) : (
                    <div className="relative">
                      <label className="topbar-control w-full">
                        <Search className="h-4 w-4 text-[var(--text-muted)]" />
                        <input
                          value={employeeSearch}
                          onFocus={() => setEmployeePickerOpen(true)}
                          onChange={(event) => {
                            setEmployeeSearch(event.target.value);
                            setEmployeePickerOpen(true);
                          }}
                          className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                          placeholder="Search employee, ID, department, or role..."
                        />
                      </label>
                      {employeePickerOpen ? (
                        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-[12px] border border-[var(--border)] bg-white p-2 shadow-lg">
                          {employeeSearchOptions.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              className="w-full rounded-[10px] px-3 py-3 text-left hover:bg-[var(--surface-muted)]"
                              onClick={() => {
                                setEmployeeSearch(`${employee.name} - ${employee.nik}`);
                                setForm(mapEmployeeToForm(employee));
                                setEmployeePickerOpen(false);
                              }}
                            >
                              <p className="text-[14px] font-semibold text-[var(--text)]">{employee.name}</p>
                              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{employee.nik} | {employee.department} | {employee.position}</p>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </label>

                {formEmployee ? (
                  <div className="panel-muted p-4">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{formEmployee.name}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{formEmployee.department} | {formEmployee.position}</p>
                  </div>
                ) : null}

                <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--primary)]">Custom Leave Types</p>
                      <p className="mt-2 text-[13px] text-[var(--text-muted)]">Add any leave type this employee should receive, including company-specific policies.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={addAllocationRow}>
                      <Plus className="h-4 w-4" />
                      Add Type
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {formAllocations.map((row) => (
                      <div key={row.id} className="rounded-[14px] border border-[var(--border)] bg-white p-4">
                        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.4fr)_120px_120px_180px_auto]">
                          <label className="space-y-2 text-[13px] font-medium text-[var(--text)]">
                            <span>Leave Type</span>
                            <input
                              value={row.label}
                              onChange={(event) => updateRow(row.id, "label", event.target.value)}
                              className="filter-control w-full"
                              placeholder="Example: Birthday Leave"
                            />
                          </label>
                          <label className="space-y-2 text-[13px] font-medium text-[var(--text)]">
                            <span>Current</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={row.days}
                              onChange={(event) => updateRow(row.id, "days", event.target.value)}
                              className="filter-control w-full"
                            />
                          </label>
                          <label className="space-y-2 text-[13px] font-medium text-[var(--text)]">
                            <span>Carry Over</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={row.carryOver}
                              onChange={(event) => updateRow(row.id, "carryOver", event.target.value)}
                              className="filter-control w-full"
                            />
                          </label>
                          <label className="space-y-2 text-[13px] font-medium text-[var(--text)]">
                            <span>Carry Over Expires</span>
                            <input
                              type="date"
                              value={row.carryOverExpiresAt}
                              onChange={(event) => updateRow(row.id, "carryOverExpiresAt", event.target.value)}
                              className="filter-control w-full"
                            />
                          </label>
                          <div className="flex items-end">
                            <button
                              type="button"
                              className="secondary-button !px-3"
                              onClick={() => removeAllocationRow(row.id)}
                              disabled={formAllocations.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="block max-w-[220px] space-y-2 text-[14px] font-medium text-[var(--text)]">
                  <span>Sick Leave Used</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.sickUsed}
                    onChange={(event) => setForm((prev) => ({ ...prev, sickUsed: event.target.value }))}
                    className="filter-control w-full"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] bg-white px-6 py-5">
              <button className="secondary-button" onClick={() => setMode(null)}>Cancel</button>
              <button className="primary-button" onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending || !form.employeeId}>
                {upsertMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save Allocation
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="panel rounded-[14px] p-6">
        <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Leave Allocation Rules</p>
        <div className="mt-5 space-y-4 text-[14px] leading-[1.55] text-[var(--muted)]">
          <div className="flex gap-3"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /> <span>HR controls which leave types each employee receives and how much balance is available.</span></div>
          <div className="flex gap-3"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /> <span>Custom leave types can be added for company-specific policies without code changes.</span></div>
          <div className="flex gap-3"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /> <span>Sick submissions remain usage-based, while paid and unpaid leave balances stay fully configurable.</span></div>
        </div>
      </section>
    </div>
  );
}
