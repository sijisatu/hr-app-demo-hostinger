export type UserRole = "admin" | "hr" | "manager" | "employee";

export type SessionUser = {
  sessionKey: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  position: string;
};

export const authCookieName = "pp_session";
export const authProfileCookieName = "pp_session_profile";

export const demoUsers: SessionUser[] = [
  {
    sessionKey: "global-admin",
    id: "admin-001",
    name: "Global Admin",
    email: "admin@praluxstd.com",
    role: "admin",
    department: "Enterprise HQ",
    position: "Platform Owner"
  },
  {
    sessionKey: "elena-hr",
    id: "emp-003",
    name: "Elena Rodriguez",
    email: "e.rodriguez@praluxstd.com",
    role: "hr",
    department: "Logistics & Supply Chain",
    position: "Operations Manager / HR"
  },
  {
    sessionKey: "sarah-manager",
    id: "emp-001",
    name: "Sarah Jenkins",
    email: "s.jenkins@praluxstd.com",
    role: "manager",
    department: "Brand Identity & Strategy",
    position: "Creative Director"
  },
  {
    sessionKey: "james-employee",
    id: "emp-004",
    name: "James Wilson",
    email: "j.wilson@praluxstd.com",
    role: "employee",
    department: "Consumer Insights",
    position: "Product Strategist"
  }
];

export function findDemoUser(sessionKey: string | undefined | null) {
  if (!sessionKey) {
    return null;
  }
  return demoUsers.find((user) => user.sessionKey === sessionKey) ?? null;
}

export function defaultRouteForRole(role: UserRole) {
  switch (role) {
    case "employee":
      return "/dashboard";
    case "hr":
    case "manager":
    case "admin":
    default:
      return "/dashboard";
  }
}

export function encodeSessionProfile(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

export function decodeSessionProfile(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionUser;
    if (!parsed?.sessionKey || !parsed?.id || !parsed?.role) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
