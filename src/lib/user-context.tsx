"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/permissions";

interface UserContextValue {
  role: Role;
  therapistId: string | null; // set when role = "therapist"
}

const UserCtx = createContext<UserContextValue>({ role: "admin", therapistId: null });

export function UserProvider({
  role,
  therapistId,
  children,
}: UserContextValue & { children: React.ReactNode }) {
  return <UserCtx.Provider value={{ role, therapistId }}>{children}</UserCtx.Provider>;
}

export function useUser(): UserContextValue {
  return useContext(UserCtx);
}
