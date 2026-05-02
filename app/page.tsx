import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/auth/login-panel";
import { getCurrentSession } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/auth-config";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (session) {
    redirect(defaultRouteForRole(session.role));
  }

  return <LoginPanel />;
}
