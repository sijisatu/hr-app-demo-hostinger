import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/auth-config";

export default async function HomePage() {
  const session = await getCurrentSession();
  redirect(session ? defaultRouteForRole(session.role) : "/login");
}
