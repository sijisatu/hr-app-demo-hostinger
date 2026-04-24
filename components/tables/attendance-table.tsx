"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Camera, Clock3, Eye, MapPinned, Search, X } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { formatLeaveStatus, formatLeaveType } from "@/lib/api";
import type { AttendanceOverview, AttendanceRecord, EmployeeRecord, LeaveRecord } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";

const toneMap = {
  "on-time": "success",
  late: "danger",
  absent: "warning",
  "early-leave": "neutral"
} as const;

const labelMap = {
  "on-time": "On-time",
  late: "Late",
  absent: "Absent",
  "early-leave": "Early Leave"
} as const;

const pageSizeOptions = [10, 30, 50, 100] as const;

type AttendanceTableRow = {
  id: string;
  employeeName: string;
  department: string;
  timestamp: string;
  title: string;
  subtitle: string;
  windowPrimary: string;
  windowSecondary: string;
  gpsPrimary: string;
  gpsSecondary: string;
  gpsTertiary: string;
  statusLabel: string;
  statusTone: "success" | "danger" | "warning" | "neutral";
  statusFilterValue: string;
  overtimeText: string;
  photoUrl: string | null;
};

function getMonthKey(timestamp: string) {
  return timestamp.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function AttendanceTable({
  logs,
  employees = [],
  onDutyRequests = [],
  punctuality,
  overview
}: {
  logs: AttendanceRecord[];
  employees?: EmployeeRecord[];
  onDutyRequests?: LeaveRecord[];
  punctuality: number;
  overview: AttendanceOverview;
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [month, setMonth] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [previewSelfie, setPreviewSelfie] = useState<{ url: string; name: string } | null>(null);

  const metrics = [
    { label: "Checked In Today", value: `${overview.checkedInToday}`, detail: `${overview.openCheckIns} still open` },
    { label: "GPS Validated", value: `${overview.gpsValidated}`, detail: `${Math.max(overview.checkedInToday - overview.gpsValidated, 0)} flagged` },
    { label: "Selfie Captured", value: `${overview.selfieCaptured}`, detail: `${overview.checkedInToday === 0 ? 0 : Math.round((overview.selfieCaptured / overview.checkedInToday) * 100)}% coverage` },
    { label: "Overtime Hours", value: `${overview.overtimeHours}`, detail: "Accumulated from attendance check-out." }
  ];

  const departmentByEmployeeId = useMemo(
    () => new Map(employees.map((item) => [item.id, item.department])),
    [employees]
  );

  const tableRows = useMemo<AttendanceTableRow[]>(() => {
    const attendanceRows = logs.map((log) => ({
      id: log.id,
      employeeName: log.employeeName,
      department: log.department,
      timestamp: log.timestamp,
      title: log.description,
      subtitle: log.location,
      windowPrimary: `${log.checkIn} - ${log.checkOut ?? "Open"}`,
      windowSecondary: log.location,
      gpsPrimary: log.gpsValidated ? "Validated" : "Outside Radius",
      gpsSecondary: `${log.gpsDistanceMeters}m from anchor`,
      gpsTertiary: log.photoUrl ? "Selfie captured" : "No selfie yet",
      statusLabel: labelMap[log.status],
      statusTone: toneMap[log.status],
      statusFilterValue: log.status,
      overtimeText: log.overtimeMinutes > 0 ? `${log.overtimeMinutes} min` : "-",
      photoUrl: log.photoUrl
    }));

    const onDutyRows = onDutyRequests.map((request) => {
      const statusLabel = formatLeaveStatus(request.status);
      return {
        id: request.id,
        employeeName: request.employeeName,
        department: departmentByEmployeeId.get(request.userId) ?? "-",
        timestamp: request.requestedAt,
        title: formatLeaveType(request.type),
        subtitle: request.reason,
        windowPrimary: "09:00 - 17:00",
        windowSecondary: request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`,
        gpsPrimary: "Not required",
        gpsSecondary: "Generated from approved request",
        gpsTertiary: "No selfie required",
        statusLabel,
        statusTone: request.status === "approved" ? "success" : request.status === "rejected" ? "danger" : "warning",
        statusFilterValue: request.status,
        overtimeText: "-",
        photoUrl: null
      } satisfies AttendanceTableRow;
    });

    return [...attendanceRows, ...onDutyRows].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [departmentByEmployeeId, logs, onDutyRequests]);

  const departments = useMemo(
    () => [...new Set(tableRows.map((item) => item.department))].sort((a, b) => a.localeCompare(b)),
    [tableRows]
  );

  const months = useMemo(
    () => [...new Set(tableRows.map((item) => getMonthKey(item.timestamp)))].sort((a, b) => b.localeCompare(a)),
    [tableRows]
  );

  const statusOptions = useMemo(
    () => [...new Set(tableRows.map((item) => item.statusFilterValue))].sort((a, b) => a.localeCompare(b)),
    [tableRows]
  );

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tableRows.filter((row) => {
      const matchesSearch = normalizedSearch.length === 0 || [
        row.employeeName,
        row.title,
        row.subtitle,
        row.department
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesDepartment = department === "all" || row.department === department;
      const matchesMonth = month === "all" || getMonthKey(row.timestamp) === month;
      const matchesStatus = status === "all" || row.statusFilterValue === status;
      return matchesSearch && matchesDepartment && matchesMonth && matchesStatus;
    });
  }, [department, month, search, status, tableRows]);

  const visibleLogs = filteredLogs.slice(0, pageSize);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="kpi-grid">
          {metrics.map((metric) => (
            <div key={metric.label} className="page-card p-5">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{metric.label}</p>
              <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{metric.value}</p>
              <p className="mt-3 text-[14px] text-[var(--text-muted)]">{metric.detail}</p>
            </div>
          ))}
        </div>

        <div className="page-card bg-[var(--primary)] p-5 text-white">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/72">Average Punctuality</p>
          <p className="mt-3 text-[30px] font-semibold leading-none">{punctuality.toFixed(1)}%</p>
          <p className="mt-3 text-[14px] leading-5 text-white/75">Non-shift attendance mode is active for all employees.</p>
        </div>
      </div>

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
                  placeholder="Search employee, type, or reason..."
                />
              </label>

              <select value={department} onChange={(event) => setDepartment(event.target.value)} className="filter-control text-[14px]">
                <option value="all">All Departments</option>
                {departments.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              <select value={month} onChange={(event) => setMonth(event.target.value)} className="filter-control text-[14px]">
                <option value="all">All Months</option>
                {months.map((item) => (
                  <option key={item} value={item}>{formatMonthLabel(item)}</option>
                ))}
              </select>

              <select value={status} onChange={(event) => setStatus(event.target.value)} className="filter-control text-[14px]">
                <option value="all">All Statuses</option>
                {statusOptions.map((value) => (
                  <option key={value} value={value}>
                    {value in labelMap
                      ? labelMap[value as keyof typeof labelMap]
                      : value === "pending-manager"
                        ? "Pending Manager"
                        : value === "awaiting-hr"
                          ? "Awaiting HR"
                          : value === "approved"
                            ? "Approved"
                            : value === "rejected"
                              ? "Rejected"
                              : value}
                  </option>
                ))}
              </select>

              <select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))} className="filter-control text-[14px]">
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>Show {option}</option>
                ))}
              </select>
            </div>

            <div className="panel-muted w-full max-w-[360px] px-4 py-3 text-[13px] leading-5 text-[var(--text-muted)]">
              GPS and selfie compliance are tracked at check-in time and stored in local directory mode.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--text-muted)]">
            <p>{filteredLogs.length} records match the current filters.</p>
            <p>Showing {Math.min(visibleLogs.length, pageSize)} of {filteredLogs.length} records.</p>
          </div>
        </div>

        <div className="mobile-scroll-shadow overflow-x-auto px-4 py-4 lg:px-6">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-4 pb-2">Employee</th>
                <th className="px-4 pb-2">Description</th>
                <th className="px-4 pb-2">Check Window</th>
                <th className="px-4 pb-2">GPS</th>
                <th className="px-4 pb-2">Status</th>
                <th className="px-4 pb-2">Overtime</th>
                <th className="px-4 pb-2">Selfie</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => (
                <tr key={log.id} className="rounded-[12px] bg-[var(--surface-muted)] hover:bg-[#edf2f7]">
                  <td className="rounded-l-[12px] px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{log.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.department}</p>
                    <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                      {new Date(log.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="text-[14px] font-semibold text-[var(--text)]">{log.title}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{log.subtitle}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                      <Clock3 className="h-4 w-4" />
                      {log.windowPrimary}
                    </div>
                    <p className="mt-2">{log.windowSecondary}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-[13px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                      <MapPinned className="h-4 w-4" />
                      {log.gpsPrimary}
                    </div>
                    <p className="mt-2">{log.gpsSecondary}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      {log.gpsTertiary}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <StatusPill tone={log.statusTone}>{log.statusLabel}</StatusPill>
                  </td>
                  <td className="px-4 py-4 align-top text-[14px] font-medium text-[var(--text)]">
                    {log.overtimeText}
                  </td>
                  <td className="rounded-r-[12px] px-4 py-4 align-top">
                    {resolveAssetUrl(log.photoUrl) ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewSelfie({ url: resolveAssetUrl(log.photoUrl) ?? "", name: log.employeeName })}
                          className="block h-10 w-10 overflow-hidden rounded-[10px] border border-[var(--border)] bg-white"
                        >
                          <Image src={resolveAssetUrl(log.photoUrl) ?? ""} alt={`${log.employeeName} selfie`} width={40} height={40} unoptimized className="h-full w-full object-cover" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewSelfie({ url: resolveAssetUrl(log.photoUrl) ?? "", name: log.employeeName })}
                          className="secondary-button !min-h-9 !px-3 !py-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </div>
                    ) : (
                      <span className="text-[13px] text-[var(--text-muted)]">No selfie</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visibleLogs.length === 0 ? (
            <div className="panel-muted mt-4 px-4 py-5 text-[14px] text-[var(--text-muted)]">
              No attendance records match the current filters.
            </div>
          ) : null}
        </div>
      </div>

      {previewSelfie ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Selfie Preview</p>
                <p className="mt-1 text-[14px] text-[var(--text-muted)]">{previewSelfie.name}</p>
              </div>
              <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={() => setPreviewSelfie(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-[var(--surface-muted)] p-4">
              <div className="max-h-[70vh] overflow-auto rounded-[16px] bg-slate-100 p-2">
                <Image src={previewSelfie.url} alt={`${previewSelfie.name} selfie`} width={1400} height={1400} unoptimized className="h-auto w-full rounded-[12px] object-contain" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
