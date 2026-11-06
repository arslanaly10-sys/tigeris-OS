"use client";
import { createContext, useContext } from "react";
import type { AuthContext } from "@/lib/api";
import type { Permission } from "@tigeris/shared";

const Ctx = createContext<AuthContext | null>(null);
export const SessionProvider = ({ value, children }: { value: AuthContext; children: React.ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export function useSession(): AuthContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
export const useCan = () => {
  const s = useSession();
  return (p: Permission) => s.permissions.includes(p);
};
