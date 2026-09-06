import { createContext, useContext, type ReactNode } from "react";

type SessionValue = {
  logout: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  logout,
  children,
}: {
  logout: () => void;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={{ logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession");
  return value;
}
