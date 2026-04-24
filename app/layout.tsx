import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { activeTenant } from "@/lib/tenant";
import { getCurrentSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Pralux HR-App",
  description: activeTenant.description,
  icons: {
    icon: "/pralux-logo-original.jpg",
    shortcut: "/pralux-logo-original.jpg",
    apple: "/pralux-logo-original.jpg"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getCurrentSession();
  const themeVars = {
    "--primary": activeTenant.theme.primary,
    "--primary-soft": activeTenant.theme.primarySoft,
    "--accent": activeTenant.theme.accent,
    "--success": activeTenant.theme.success,
    "--danger": activeTenant.theme.danger,
    "--warning": activeTenant.theme.warning,
    "--font-inter": "\"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
  } as React.CSSProperties;

  return (
    <html lang="en">
      <body style={themeVars}>
        <AppProviders currentUser={currentUser}>{children}</AppProviders>
      </body>
    </html>
  );
}
