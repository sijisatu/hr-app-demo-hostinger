const baseUrl = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseCookie(setCookieHeader) {
  if (!setCookieHeader) {
    return "";
  }
  return setCookieHeader
    .split(/,(?=[^;]+?=)/g)
    .map((entry) => entry.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchText(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return { response, text };
}

async function main() {
  const loginPage = await fetchText("/login");
  assert(loginPage.response.ok, "Frontend /login not reachable.");
  assert(/Sign in/i.test(loginPage.text), "Frontend /login content mismatch.");

  const roles = ["global-admin", "elena-hr", "sarah-manager", "james-employee"];
  for (const sessionKey of roles) {
    const loginApi = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
      redirect: "manual"
    });
    const payload = await loginApi.json().catch(() => null);
    assert(loginApi.ok, `Frontend API login failed for ${sessionKey}.`);
    assert(payload?.success === true, `Frontend API login contract invalid for ${sessionKey}.`);

    const cookie = parseCookie(loginApi.headers.get("set-cookie"));
    assert(cookie.length > 0, `No auth cookies returned for ${sessionKey}.`);

    const dashboard = await fetchText("/dashboard", {
      headers: { Cookie: cookie }
    });
    assert(dashboard.response.ok, `Dashboard failed after login for ${sessionKey}.`);
  }

  process.stdout.write("Frontend smoke test passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
