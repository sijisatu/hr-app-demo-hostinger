import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";
import { getAuditLogsPage, type AuditLogRecord } from "@/lib/api";

type ActivityLogsPageProps = {
  searchParams?: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    module?: string;
    actorRole?: string;
    targetType?: string;
    startDate?: string;
    endDate?: string;
  }>;
};

const pageSize = 25;

function buildQuery(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLabel(value: string | null | undefined, fallback = "-") {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toneClass(moduleName: string) {
  if (moduleName === "auth") {
    return "bg-[rgba(15,46,102,0.08)] text-[var(--primary)]";
  }
  if (moduleName === "employee" || moduleName === "department") {
    return "bg-[rgba(20,184,166,0.14)] text-[rgb(15,118,110)]";
  }
  if (moduleName === "reimbursement" || moduleName === "payroll") {
    return "bg-[rgba(249,115,22,0.14)] text-[rgb(194,65,12)]";
  }
  return "bg-[var(--surface-muted)] text-[var(--text)]";
}

function FilterPill({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${active ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
      {children}
    </span>
  );
}

function ActivityTable({ rows }: { rows: AuditLogRecord[] }) {
  return (
    <div className="page-card overflow-hidden p-0">
      <div className="mobile-scroll-shadow overflow-x-auto px-4 py-4 lg:px-6">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <th className="px-4 pb-2">Timestamp</th>
              <th className="px-4 pb-2">Module</th>
              <th className="px-4 pb-2">Summary</th>
              <th className="px-4 pb-2">Actor</th>
              <th className="px-4 pb-2">Target</th>
              <th className="px-4 pb-2">Event Key</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="bg-[var(--surface-muted)]">
                <td className="rounded-l-[14px] px-4 py-4 align-top">
                  <p className="text-[13px] font-semibold text-[var(--text)]">{formatDateTime(row.occurredAt)}</p>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">{row.ipAddress ?? "Internal request"}</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${toneClass(row.module)}`}>
                    {formatLabel(row.module)}
                  </span>
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="text-[14px] font-semibold text-[var(--text)]">{row.summary}</p>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">{formatLabel(row.action)}</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="text-[14px] font-semibold text-[var(--text)]">{row.actorName ?? "System"}</p>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                    {[formatLabel(row.actorRole, ""), row.actorDepartment].filter(Boolean).join(" | ") || "-"}
                  </p>
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="text-[14px] font-semibold text-[var(--text)]">{row.targetLabel ?? row.targetId ?? "-"}</p>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                    {[formatLabel(row.targetType, ""), row.targetId].filter(Boolean).join(" | ") || "-"}
                  </p>
                </td>
                <td className="rounded-r-[14px] px-4 py-4 align-top">
                  <code className="rounded-[10px] bg-white px-3 py-1 text-[12px] text-[var(--primary)]">{row.eventKey}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ActivityLogsPage({ searchParams }: ActivityLogsPageProps) {
  await requireSession(["admin", "hr"]);
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page) || 1);
  const filters = {
    page,
    pageSize,
    search: params.search?.trim() || undefined,
    module: params.module?.trim() || undefined,
    actorRole: params.actorRole?.trim() || undefined,
    targetType: params.targetType?.trim() || undefined,
    startDate: params.startDate?.trim() || undefined,
    endDate: params.endDate?.trim() || undefined
  };

  const result = await Promise.allSettled([getAuditLogsPage(filters)]);
  const auditLogs = result[0].status === "fulfilled"
    ? result[0].value
    : {
        items: [] as AuditLogRecord[],
        total: 0,
        page,
        pageSize,
        hasNext: false
      };
  const dataUnavailable = result[0].status === "rejected";

  const moduleOptions = ["auth", "employee", "department", "leave", "overtime", "reimbursement", "payroll"];
  const roleOptions = ["admin", "hr", "manager", "employee"];
  const targetOptions = ["employee", "department", "leave", "overtime", "reimbursement", "pay-run"];

  const nextLink = auditLogs.hasNext
    ? buildQuery({ ...filters, page: auditLogs.page + 1 })
    : "";
  const previousLink = auditLogs.page > 1
    ? buildQuery({ ...filters, page: auditLogs.page - 1 })
    : "";

  return (
    <AppShell title="Activity Logs">
      <div className="space-y-6">
        {dataUnavailable ? (
          <div className="page-card border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
            Some audit log data is temporarily unavailable. The page is still loaded with the latest safe structure.
          </div>
        ) : null}

        <section className="page-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Operational Activity Trail</p>
              <p className="mt-2 text-[14px] text-[var(--text-muted)]">Track who changed what, on which module, and which target record was affected.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={Boolean(filters.module)}>{filters.module ? `Module: ${formatLabel(filters.module)}` : "All Modules"}</FilterPill>
              <FilterPill active={Boolean(filters.actorRole)}>{filters.actorRole ? `Role: ${formatLabel(filters.actorRole)}` : "All Roles"}</FilterPill>
              <FilterPill active={Boolean(filters.targetType)}>{filters.targetType ? `Target: ${formatLabel(filters.targetType)}` : "All Targets"}</FilterPill>
            </div>
          </div>

          <form className="mt-5 grid gap-3 lg:grid-cols-6" action="/activity-logs" method="get">
            <input
              name="search"
              defaultValue={filters.search ?? ""}
              placeholder="Search summary, actor, or target..."
              className="topbar-control lg:col-span-2"
            />
            <select name="module" defaultValue={filters.module ?? ""} className="filter-control text-[14px]">
              <option value="">All Modules</option>
              {moduleOptions.map((option) => (
                <option key={option} value={option}>{formatLabel(option)}</option>
              ))}
            </select>
            <select name="actorRole" defaultValue={filters.actorRole ?? ""} className="filter-control text-[14px]">
              <option value="">All Roles</option>
              {roleOptions.map((option) => (
                <option key={option} value={option}>{formatLabel(option)}</option>
              ))}
            </select>
            <select name="targetType" defaultValue={filters.targetType ?? ""} className="filter-control text-[14px]">
              <option value="">All Targets</option>
              {targetOptions.map((option) => (
                <option key={option} value={option}>{formatLabel(option)}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              <input name="startDate" type="date" defaultValue={filters.startDate ?? ""} className="filter-control text-[14px]" />
              <input name="endDate" type="date" defaultValue={filters.endDate ?? ""} className="filter-control text-[14px]" />
            </div>
            <div className="flex gap-3 lg:col-span-2">
              <button type="submit" className="primary-button">Apply Filters</button>
              <Link href="/activity-logs" className="secondary-button">Reset</Link>
            </div>
          </form>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="page-card p-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Visible Rows</p>
            <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{auditLogs.items.length}</p>
            <p className="mt-3 text-[14px] text-[var(--text-muted)]">Current page result size.</p>
          </div>
          <div className="page-card p-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Matched Events</p>
            <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{auditLogs.total}</p>
            <p className="mt-3 text-[14px] text-[var(--text-muted)]">Total records matching active filters.</p>
          </div>
          <div className="page-card p-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Coverage</p>
            <p className="mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]">{auditLogs.page}</p>
            <p className="mt-3 text-[14px] text-[var(--text-muted)]">Page index with {auditLogs.pageSize} rows per page.</p>
          </div>
        </div>

        {auditLogs.items.length > 0 ? (
          <ActivityTable rows={auditLogs.items} />
        ) : (
          <div className="page-card p-6 text-[14px] text-[var(--text-muted)]">
            No activity logs match the current filters yet.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[var(--text-muted)]">
            Showing page {auditLogs.page} with up to {auditLogs.pageSize} rows per request.
          </p>
          <div className="flex gap-3">
            {previousLink ? <Link href={`/activity-logs${previousLink}`} className="secondary-button">Previous</Link> : <span className="secondary-button pointer-events-none opacity-50">Previous</span>}
            {nextLink ? <Link href={`/activity-logs${nextLink}`} className="primary-button">Next</Link> : <span className="primary-button pointer-events-none opacity-50">Next</span>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
