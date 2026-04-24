const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000";

async function assertHealthy() {
  const response = await fetch(`${baseUrl}/api/health`, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Health endpoint failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || payload.success !== true) {
    throw new Error("Health payload returned unexpected contract.");
  }
}

async function main() {
  await assertHealthy();
  process.stdout.write("Smoke test passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

