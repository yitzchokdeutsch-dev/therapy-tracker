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

/** Returns the therapist IDs this user is allowed to see. Admins see all. */
export function visibleTherapistIds(user: UserContext, allIds: string[]): string[] {
  if (user.role === "therapist" && user.therapistId) return [user.therapistId];
  return allIds;
}

/** Stub until auth is wired — swap this for a real session lookup. */
export const MOCK_USER: UserContext = { role: "admin" };
