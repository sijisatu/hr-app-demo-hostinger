import type { UserRole } from "@/lib/auth-config";

export type NavItem = {
  href: string;
  label: string;
  roles?: UserRole[];
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/employees", label: "Employee List", roles: ["admin", "hr"] },
  { href: "/attendance", label: "Employee Attendance", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/reimbursement", label: "Reimbursement", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/activity-logs", label: "Activity Logs", roles: ["admin", "hr"] },
  { href: "/profile", label: "Profile", roles: ["manager", "employee"] },
  { href: "/reports", label: "Reports", roles: ["admin", "hr"] },
  { href: "/leave", label: "Leave System", roles: ["admin", "hr"] }
];
