const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000";

async function api(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, json, text };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function unique(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000)}`;
}

async function loginAs(username, password = "employee123") {
  const login = await api("/api/auth/employee-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  assert(login.response.ok && login.json?.success === true, `Employee login flow failed. ${login.text}`);
  const sessionId = login.json?.data?.sessionId;
  assert(typeof sessionId === "string" && sessionId.length > 0, "Employee login did not return a valid session.");
  return { "X-Session-Key": sessionId };
}

async function main() {
  const adminHeaders = { "X-Session-Key": "global-admin" };
  const employeesRes = await api("/api/employees", { headers: adminHeaders });
  assert(employeesRes.response.ok && Array.isArray(employeesRes.json?.data), "Unable to fetch employees.");
  const employees = employeesRes.json.data;

  const manager = employees.find((item) => item.role === "manager" && item.status === "active");
  const employee = employees.find((item) => item.role === "employee" && item.status === "active" && item.appLoginEnabled);
  assert(manager, "No active manager found.");
  assert(employee, "No active employee found.");
  assert(manager.loginUsername, "Manager has no login username.");
  assert(employee.loginUsername, "Employee has no login username.");

  const managerHeaders = await loginAs(manager.loginUsername);
  const employeeHeaders = await loginAs(employee.loginUsername);

  const employeeCreateDepartment = await api("/api/departments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...employeeHeaders
    },
    body: JSON.stringify({ name: `Invalid-${Date.now()}`, active: true })
  });
  assert(
    employeeCreateDepartment.response.status >= 400,
    `RBAC failed: employee should not create department. status=${employeeCreateDepartment.response.status} body=${employeeCreateDepartment.text}`
  );

  const managerGeneratePayroll = await api("/api/payroll/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...managerHeaders
    },
    body: JSON.stringify({
      periodLabel: `RBAC-${Date.now()}`,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      payDate: "2026-02-01"
    })
  });
  assert(
    managerGeneratePayroll.response.status >= 400,
    `RBAC failed: manager should not generate payroll run. status=${managerGeneratePayroll.response.status} body=${managerGeneratePayroll.text}`
  );

  const wrongManager = employees.find(
    (item) => item.role === "manager" && item.status === "active" && item.name.trim().toLowerCase() !== manager.name.trim().toLowerCase()
  ) ?? manager;
  const createEmployeeCrossDept = await api("/api/employees", {
    method: "POST",
    headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      nik: unique("RBAC-NIK"),
      name: unique("RBAC Employee"),
      email: `${unique("rbac").toLowerCase()}@example.test`,
      birthPlace: "Jakarta",
      birthDate: "1998-01-01",
      gender: "male",
      maritalStatus: "single",
      marriageDate: null,
      address: "RBAC scope test",
      idCardNumber: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
      education: "S1",
      workExperience: "1 year",
      educationHistory: [],
      workExperiences: [],
      department: manager.department,
      position: "QA",
      role: "employee",
      status: "active",
      phone: "081234567890",
      workLocation: "Jakarta HQ",
      workType: "onsite",
      managerName: wrongManager.name,
      employmentType: "contract",
      contractStatus: "contract",
      contractStart: "2026-04-01",
      contractEnd: null,
      baseSalary: 5_000_000,
      allowance: 0,
      positionSalaryId: null,
      financialComponentIds: [],
      taxProfileId: null,
      taxProfile: "TK/0",
      bankName: "BCA",
      bankAccountMasked: "***1234",
      appLoginEnabled: true,
      loginUsername: unique("rbac-user"),
      loginPassword: "employee123"
    })
  });
  assert(
    createEmployeeCrossDept.response.status >= 400,
    `Business constraint failed: cross-department manager assignment should be rejected. status=${createEmployeeCrossDept.response.status} body=${createEmployeeCrossDept.text}`
  );

  process.stdout.write("Role access integration test passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
