"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  Settings,
  ReceiptText,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import clsx from "clsx";
import { activeTenant } from "@/lib/tenant";
import { navItems } from "@/lib/data";
import { AttendanceQuickAction } from "@/components/layout/attendance-quick-action";
import { NotificationCenter } from "@/components/layout/notification-center";
import { useSession } from "@/components/providers/session-provider";
import { LogoutButton } from "@/components/auth/logout-button";

const iconMap = {
  Dashboard: LayoutGrid,
  "Employee List": Users,
  "Employee Attendance": ClipboardList,
  Reimbursement: ReceiptText,
  "Activity Logs": Bell,
  Payroll: WalletCards,
  Profile: UserRound,
  Reports: ChartColumn,
  "Leave Flow": CalendarClock,
  "Leave System": CalendarClock
};

export function AppShell({ title, subtitle, actions, children, compact = false }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; compact?: boolean }) {
  const pathname = usePathname();
  const { currentUser } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleNav = navItems.filter((item) => !item.roles || (currentUser ? item.roles.includes(currentUser.role) : false));
  const isEmployeeSurface = currentUser?.role === "employee" || currentUser?.role === "manager";
  const currentUserInitials = currentUser?.name
    ? currentUser.name.split(" ").map((part) => part[0]).join("").slice(0, 2)
    : "AU";
  const currentUserRoleLabel = currentUser?.role
    ? `${currentUser.role.charAt(0).toUpperCase()}${currentUser.role.slice(1)}`
    : "Admin";
  const mobileNavItems = useMemo(
    () => visibleNav.filter((item) => ["/dashboard", "/attendance", "/payroll", "/profile"].includes(item.href)).slice(0, 4),
    [visibleNav]
  );

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  const handleSidebarMouseEnter = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setSidebarExpanded(true);
  };

  const handleSidebarMouseLeave = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = setTimeout(() => {
      setSidebarExpanded(false);
    }, 120);
  };

  return (
    <div className="app-shell min-w-0 lg:pl-[var(--sidebar-width-compact)]">
      {mobileNavOpen ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.48)] lg:hidden" onClick={() => setMobileNavOpen(false)} /> : null}

      <aside
        className={clsx(
          "app-sidebar app-sidebar-rail fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] -translate-x-full overflow-y-auto px-5 py-5 shadow-2xl transition-transform duration-200 lg:fixed lg:inset-y-auto lg:left-0 lg:top-1/2 lg:z-30 lg:h-auto lg:w-[var(--sidebar-width-expanded)] lg:translate-x-0 lg:-translate-y-1/2 lg:px-0 lg:py-0 lg:shadow-none",
          sidebarExpanded && "is-expanded",
          mobileNavOpen && "translate-x-0"
        )}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <div className="sidebar-rail-inner flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 px-2 py-2 lg:hidden">
            <div className="flex items-center gap-4">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] text-sm font-semibold shadow-[0_14px_28px_rgba(20,43,87,0.18)]"
                style={{ backgroundColor: "#ffffff", color: "var(--primary)" }}
              >
                {activeTenant.shortLabel}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-[var(--primary)]">{activeTenant.productName}</p>
                <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]">{activeTenant.companyTagline}</p>
              </div>
            </div>

            <button type="button" className="secondary-button !min-h-10 !w-10 !rounded-full !p-0 lg:hidden" onClick={() => setMobileNavOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="sidebar-profile-wrap hidden lg:flex">
            <Link href="/profile" className="sidebar-profile-chip">
              <span className="sidebar-profile-badge">{currentUserInitials}</span>
              <span className="sidebar-profile-copy min-w-0">
                <span className="block truncate text-[13px] font-semibold text-white">{currentUser?.name ?? "Admin User"}</span>
                <span className="mt-0.5 block truncate text-[11px] text-[rgba(255,255,255,0.62)]">{currentUserRoleLabel}</span>
              </span>
            </Link>
          </div>

          <div className="sidebar-divider sidebar-divider-top hidden lg:block" />

          <div className="sidebar-section sidebar-section-main">
            <nav className="sidebar-nav sidebar-nav-main mt-6 space-y-2 lg:mt-0 lg:space-y-0">
              {visibleNav.map((item) => {
                const Icon = iconMap[item.label as keyof typeof iconMap] ?? LayoutGrid;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link key={item.href} href={item.href} className={clsx("nav-item", active && "nav-item-active")}>
                    <span className="nav-item-indicator" />
                    <span className="nav-item-box">
                      <span className="nav-item-icon">
                        <Icon className="h-5 w-5" />
                      </span>
                    </span>
                    <span className="nav-item-label truncate text-[15px] font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="sidebar-section sidebar-section-utility mt-auto">
            <div className="sidebar-divider sidebar-divider-bottom mt-4 hidden lg:mt-0 lg:block" />

            <div className="sidebar-nav sidebar-nav-utility space-y-2 pt-4 lg:pt-0 lg:space-y-0">
              <AttendanceQuickAction className="primary-button sidebar-action w-full" />

              <Link href="/help-center" className="nav-item w-full">
                <span className="nav-item-indicator" />
                <span className="nav-item-box">
                  <span className="nav-item-icon">
                    <HelpCircle className="h-5 w-5" />
                  </span>
                </span>
                <span className="nav-item-label text-[15px] font-medium">Help Center</span>
              </Link>

              <Link href="/login" className="nav-item">
                <span className="nav-item-indicator" />
                <span className="nav-item-box">
                  <span className="nav-item-icon">
                    <Users className="h-5 w-5" />
                  </span>
                </span>
                <span className="nav-item-label text-[15px] font-medium">Switch Account</span>
              </Link>

              <LogoutButton className="nav-item !w-full">
                <span className="nav-item-indicator" />
                <span className="nav-item-box">
                  <span className="nav-item-icon">
                    <LogOut className="h-5 w-5" />
                  </span>
                </span>
                <span className="nav-item-label text-[15px] font-medium">Sign Out</span>
              </LogoutButton>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-surface min-h-screen min-w-0">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(243,245,249,0.92)] backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className="secondary-button !min-h-10 !w-10 !rounded-full !p-0 lg:hidden" onClick={() => setMobileNavOpen(true)}>
                <Menu className="h-4 w-4" />
              </button>

              <Link href="/dashboard" className="group flex min-w-0 items-center gap-3 rounded-[12px] px-1 py-1">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-[rgba(15,46,102,0.14)] bg-white shadow-[0_12px_24px_rgba(15,46,102,0.14)]">
                  <Image src="/pralux-logo-original.jpg" alt="Pralux logo" width={38} height={38} priority />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--primary)]">Pralux HR-App</span>
                  <span className="block truncate text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Workforce Intelligence Platform</span>
                </span>
              </Link>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <label className="topbar-control hidden min-w-0 sm:flex sm:w-[200px] lg:w-[280px]">
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <input className="w-full border-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" placeholder="Search..." />
              </label>

              <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0 sm:hidden">
                <Search className="h-4 w-4" />
              </button>

              <NotificationCenter />
              <button className="secondary-button !hidden !min-h-10 !w-10 !rounded-full !p-0 sm:inline-flex">
                <Settings className="h-4 w-4" />
              </button>

              <div className="flex min-w-0 items-center gap-2 rounded-full border border-[var(--border)] bg-white px-2 py-1.5 sm:px-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--primary)] text-xs font-semibold text-white">
                  {currentUserInitials}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="truncate text-[14px] font-semibold text-[var(--primary)]">{currentUser?.name ?? "Admin User"}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={clsx("min-w-0 px-4 py-5 sm:px-6 lg:px-8", compact ? "lg:py-6" : "lg:py-8", isEmployeeSurface && "pb-28 sm:pb-8")}>
          <div className={clsx("flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", compact ? "mb-6" : "mb-8")}>
            <div className="min-w-0">
              <h1 className={clsx("section-title font-semibold leading-tight text-[var(--primary)]", compact ? "text-[30px] sm:text-[32px] lg:text-[36px]" : "text-[32px] sm:text-[36px] lg:text-[44px]")}>{title}</h1>
              {subtitle ? <p className={clsx("mt-2 max-w-3xl text-[var(--text-muted)]", compact ? "text-[14px] leading-5" : "text-[14px] leading-6 sm:text-[15px]")}>{subtitle}</p> : null}
            </div>
            {actions ? <div className="min-w-0 shrink-0 max-sm:w-full max-sm:[&>*]:w-full">{actions}</div> : null}
          </div>

          {children}
        </main>
      </div>

      {isEmployeeSurface ? (
        <>
          <div className="fixed bottom-[74px] right-4 z-30 sm:hidden">
            <AttendanceQuickAction className="primary-button min-w-[148px] shadow-2xl" compact />
          </div>

          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[rgba(255,255,255,0.96)] px-3 py-2 backdrop-blur sm:hidden">
            <div className="grid grid-cols-4 gap-2">
              {mobileNavItems.map((item) => {
                const Icon = iconMap[item.label as keyof typeof iconMap] ?? LayoutGrid;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[14px] px-2 py-2 text-center",
                      active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--text-muted)]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium leading-4">{item.label === "Employee Attendance" ? "Attendance" : item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}

