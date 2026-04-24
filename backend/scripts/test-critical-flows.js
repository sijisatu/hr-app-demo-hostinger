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

function today() {
  return new Date().toISOString().slice(0, 10);
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

  const health = await api("/api/health");
  assert(health.response.ok && health.json?.success === true, "Health check failed.");

  const employeesRes = await api("/api/employees", { headers: adminHeaders });
  assert(employeesRes.response.ok && Array.isArray(employeesRes.json?.data), "Failed to load employees.");
  const employees = employeesRes.json.data;

  const manager = employees.find((item) => item.role === "manager" && item.status === "active");
  assert(manager, "No active manager found for critical flow test.");

  const targetEmployee = employees.find((item) =>
    item.role === "employee" &&
    item.status === "active" &&
    item.managerName &&
    item.department &&
    item.department.trim().toLowerCase() === manager.department.trim().toLowerCase() &&
    item.managerName.trim().toLowerCase() === manager.name.trim().toLowerCase()
  );
  assert(targetEmployee, "No employee-manager pair found for reimbursement approval flow.");
  assert(targetEmployee.loginUsername, "Target employee has no login username.");
  assert(manager.loginUsername, "Manager has no login username.");

  const employeeHeaders = await loginAs(targetEmployee.loginUsername);
  const managerHeaders = await loginAs(manager.loginUsername);

  const checkInForm = new FormData();
  checkInForm.set("userId", targetEmployee.id);
  checkInForm.set("employeeName", targetEmployee.name);
  checkInForm.set("department", targetEmployee.department);
  checkInForm.set("location", "Jakarta HQ");
  checkInForm.set("latitude", "-6.2");
  checkInForm.set("longitude", "106.816666");
  const checkIn = await api("/api/attendance/check-in", {
    method: "POST",
    headers: adminHeaders,
    body: checkInForm
  });
  assert(checkIn.response.ok && checkIn.json?.success === true, `Attendance check-in failed. ${checkIn.text}`);
  const attendanceId = checkIn.json.data.id;

  const checkOut = await api("/api/attendance/check-out", {
    method: "POST",
    headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ attendanceId })
  });
  assert(checkOut.response.ok && checkOut.json?.success === true, `Attendance check-out failed. ${checkOut.text}`);

  const payrollRun = await api("/api/payroll/runs", {
    method: "POST",
    headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      periodLabel: `Smoke Payroll ${today()} ${Date.now()}`,
      periodStart: today(),
      periodEnd: today(),
      payDate: today()
    })
  });
  assert(payrollRun.response.ok && payrollRun.json?.success === true, `Payroll run generation failed. ${payrollRun.text}`);

  const claimTypeRes = await api("/api/reimbursement/claims", {
    method: "POST",
    headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      employeeId: targetEmployee.id,
      employeeName: targetEmployee.name,
      department: targetEmployee.department,
      designation: targetEmployee.position,
      category: "medical",
      claimType: "Medical",
      subType: `Outpatient-${Date.now()}`,
      currency: "IDR",
      annualLimit: 2_000_000,
      remainingBalance: 2_000_000,
      active: true,
      notes: "smoke flow"
    })
  });
  assert(
    claimTypeRes.response.ok && claimTypeRes.json?.success === true,
    `Create reimbursement claim type failed. ${claimTypeRes.text}`
  );
  const claimType = claimTypeRes.json.data;

  const reimbursementForm = new FormData();
  reimbursementForm.set("userId", targetEmployee.id);
  reimbursementForm.set("employeeName", targetEmployee.name);
  reimbursementForm.set("department", targetEmployee.department);
  reimbursementForm.set("designation", targetEmployee.position);
  reimbursementForm.set("claimTypeId", claimType.id);
  reimbursementForm.set("currency", "IDR");
  reimbursementForm.set("amount", "150000");
  reimbursementForm.set("receiptDate", today());
  reimbursementForm.set("remarks", "smoke reimbursement request");
  reimbursementForm.set("submit", "true");
  reimbursementForm.set("receipt", new Blob(["%PDF-1.4 smoke"], { type: "application/pdf" }), "receipt-smoke.pdf");

  const reimbursementCreate = await api("/api/reimbursement/requests", {
    method: "POST",
    headers: adminHeaders,
    body: reimbursementForm
  });
  assert(
    reimbursementCreate.response.ok && reimbursementCreate.json?.success === true,
    `Create reimbursement request failed. ${reimbursementCreate.text}`
  );
  const reimbursementId = reimbursementCreate.json.data.id;

  const managerApprove = await api("/api/reimbursement/requests/manager-approve", {
    method: "POST",
    headers: { ...managerHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ reimbursementId, status: "approved", actor: manager.name })
  });
  assert(
    managerApprove.response.ok && managerApprove.json?.success === true,
    `Manager approval reimbursement failed. ${managerApprove.text}`
  );

  const hrActorName = "Global Admin";
  const hrProcess = await api("/api/reimbursement/requests/hr-process", {
    method: "POST",
    headers: { ...adminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ reimbursementId, status: "processed", actor: hrActorName })
  });
  assert(hrProcess.response.ok && hrProcess.json?.success === true, `HR reimbursement process failed. ${hrProcess.text}`);

  process.stdout.write("Critical flow test passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
