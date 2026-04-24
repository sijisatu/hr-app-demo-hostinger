type TenantTheme = {
  primary: string;
  primarySoft: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
};

type TenantConfig = {
  key: string;
  companyName: string;
  productName: string;
  companyTagline: string;
  shortLabel: string;
  description: string;
  supportEmail: string;
  theme: TenantTheme;
};

const tenants: Record<string, TenantConfig> = {
  pralux: {
    key: "pralux",
    companyName: "Praluxstd",
    productName: "PulsePresence",
    companyTagline: "Enterprise attendance intelligence",
    shortLabel: "PP",
    description: "White-label HRIS attendance workspace for modern Indonesian teams.",
    supportEmail: "support@praluxstd.com",
    theme: {
      primary: "#132f63",
      primarySoft: "rgba(19, 47, 99, 0.08)",
      accent: "#57d7c7",
      success: "#37c58f",
      danger: "#f36363",
      warning: "#ffb64f"
    }
  },
  atlas: {
    key: "atlas",
    companyName: "Atlas Dynamics",
    productName: "Atlas Presence",
    companyTagline: "Global workforce command center",
    shortLabel: "AT",
    description: "White-label operations dashboard for global attendance and leave teams.",
    supportEmail: "ops@atlas.example",
    theme: {
      primary: "#1f3f74",
      primarySoft: "rgba(31, 63, 116, 0.09)",
      accent: "#53d3d0",
      success: "#39c48d",
      danger: "#ef6363",
      warning: "#f4b04f"
    }
  }
};

export const activeTenant =
  tenants[process.env.NEXT_PUBLIC_TENANT_KEY ?? "pralux"] ?? tenants.pralux;

export const tenantOptions = Object.values(tenants);
