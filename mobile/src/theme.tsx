import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSetting, setSetting } from "./db";
import { getActiveProfile, setLastTheme, updateProfileAvatar } from "./profiles";

export type ThemeMode = "light" | "dark";

export type Colors = {
  bg: string;
  bgHome: string;
  ink: string;
  muted: string;
  line: string;
  card: string;
  cardSoft: string;
  lift: string;
  table: string;
  modal: string;
  overlay: string;
  blue: string;
  input: string;
};

export const light: Colors = {
  bg: "#ffffff",
  bgHome: "#E6E6E6",
  ink: "#111111",
  muted: "#9CA3AF",
  line: "#E5E7EB",
  card: "#ffffff",
  cardSoft: "#F3F3F3",
  lift: "#EFEFEF",
  table: "#FAFAFA",
  modal: "#ffffff",
  overlay: "rgba(0,0,0,0.25)",
  blue: "#3B82F6",
  input: "#ffffff",
};

export const dark: Colors = {
  bg: "#0B0B0B",
  bgHome: "#111111",
  ink: "#F4F4F5",
  muted: "#A1A1AA",
  line: "#3F3F46",
  card: "#1C1C1E",
  cardSoft: "#2C2C2E",
  lift: "#27272A",
  table: "#18181B",
  modal: "#1C1C1E",
  overlay: "rgba(0,0,0,0.55)",
  blue: "#60A5FA",
  input: "#18181B",
};

type ThemeContextValue = {
  mode: ThemeMode;
  dark: boolean;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
  avatar: string | null;
  setAvatar: (uri: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [avatar, setAvatarState] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSetting("theme"), getSetting("avatar")])
      .then(([theme, nextAvatar]) => {
        if (theme === "dark" || theme === "light") setModeState(theme);
        if (nextAvatar) setAvatarState(nextAvatar);
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      dark: mode === "dark",
      colors: mode === "dark" ? dark : light,
      setMode: (next) => {
        setModeState(next);
        setSetting("theme", next).catch(() => undefined);
        setLastTheme(next).catch(() => undefined);
      },
      avatar,
      setAvatar: (uri) => {
        setAvatarState(uri);
        setSetting("avatar", uri ?? "").catch(() => undefined);
        const profile = getActiveProfile();
        if (profile) updateProfileAvatar(profile.id, uri).catch(() => undefined);
      },
    }),
    [avatar, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme");
  return value;
}

