export type EmployeeSessionPayload = {
  sessionKey: string;
  id: string;
  name: string;
  email: string;
  role: "admin" | "hr" | "manager" | "employee";
  department: string;
  position: string;
};

export type EmployeeLoginResult = {
  sessionId: string;
  expiresAt: string;
  maxAgeSeconds: number;
  idleTimeoutMinutes: number;
  maxConcurrentSessions: number;
  user: EmployeeSessionPayload;
};
