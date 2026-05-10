export type Role = "admin" | "therapist" | "billing" | "readonly";

export interface UserContext {
  role: Role;
  therapistId?: string;
}

const RULES = {
  admin: {
    canEditClients: true,
    canDeleteSessions: true,
    canManageBilling: true,
    canManageSetup: true,
    canViewAllTherapists: true,
    canRecordPayments: true,
    canExportData: true,
  },
  billing: {
    canEditClients: false,
    canDeleteSessions: false,
    canManageBilling: true,
    canManageSetup: false,
    canViewAllTherapists: true,
    canRecordPayments: true,
    canExportData: true,
  },
  therapist: {
    canEditClients: true,
    canDeleteSessions: true,
    canManageBilling: false,
    canManageSetup: false,
    canViewAllTherapists: false,
    canRecordPayments: false,
    canExportData: false,
  },
  readonly: {
    canEditClients: false,
    canDeleteSessions: false,
    canManageBilling: false,
    canManageSetup: false,
    canViewAllTherapists: true,
    canRecordPayments: false,
    canExportData: false,
  },
} as const;

type Permission = keyof (typeof RULES)[Role];

export function can(user: UserContext, permission: Permission): boolean {
  return RULES[user.role][permission];
}

export function visibleTherapistIds(user: UserContext, allIds: string[]): string[] {
  if (user.role === "therapist" && user.therapistId) return [user.therapistId];
  return allIds;
}

// Which roles can visit each route prefix
export const PAGE_ACCESS: Record<string, Role[]> = {
  "/":           ["admin", "therapist", "billing", "readonly"],
  "/clients":    ["admin", "therapist", "billing", "readonly"],
  "/scheduling": ["admin", "therapist"],
  "/checkin":    ["admin", "therapist"],
  "/calendar":   ["admin", "therapist", "billing", "readonly"],
  "/payments":   ["admin", "billing"],
  "/billing":    ["admin", "billing"],
  "/setup":      ["admin"],
  "/admin":      ["admin"],
  "/account":    ["admin", "therapist", "billing", "readonly"],
};

export function canAccessPage(role: Role, pathname: string): boolean {
  const match = Object.entries(PAGE_ACCESS).find(([path]) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path)
  );
  return match ? match[1].includes(role) : true;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin:     "Admin",
  therapist: "Therapist",
  billing:   "Billing",
  readonly:  "Read Only",
};

export const ROLE_COLORS: Record<Role, string> = {
  admin:     "bg-brand-100 text-brand-700",
  therapist: "bg-emerald-100 text-emerald-700",
  billing:   "bg-purple-100 text-purple-700",
  readonly:  "bg-surface-200 text-ink-500",
};
