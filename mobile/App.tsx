import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { enterProfile, getLastTheme, getSession, initProfiles, logoutProfile } from "./src/profiles";
import { getSetting, setSetting } from "./src/db";
import { HomeScreen } from "./src/HomeScreen";
import { StockScreen } from "./src/StockScreen";
import { CashflowScreen } from "./src/CashflowScreen";
import { TradingScreen } from "./src/TradingScreen";
import { SettingsScreen } from "./src/SettingsScreen";
import { ProfilesScreen } from "./src/ProfilesScreen";
import { SessionProvider } from "./src/SessionContext";
import { ThemeProvider, useTheme } from "./src/theme";

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loginDark, setLoginDark] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [entering, setEntering] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("gesturestart", block);
    document.addEventListener("gesturechange", block);
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
    };
  }, []);

  useEffect(() => {
    initProfiles()
      .then(() => getLastTheme())
      .then((theme) => {
        setLoginDark(theme === "dark");
        return getSession();
      })
      .then(async (id) => {
        if (!id) return null;
        return enterProfile(id);
      })
      .then((profile) => {
        setProfileId(profile?.id ?? null);
        setReady(true);
      })
      .catch(() => {
        setProfileId(null);
        setReady(true);
      });
  }, []);

  async function enter(id: string) {
    setEntering(true);
    try {
      const profile = await enterProfile(id);
      if (!profile) return;
      const seen = await getSetting("setupDone");
      if (!seen) {
        await setSetting("setupDone", "1");
        setOpenSettings(true);
      } else {
        setOpenSettings(false);
      }
      setProfileId(profile.id);
    } finally {
      setEntering(false);
    }
  }

  function logout() {
    if (leaving.current) return;
    leaving.current = true;
    setProfileId(null);
    setOpenSettings(false);
    getLastTheme()
      .then((theme) => setLoginDark(theme === "dark"))
      .catch(() => undefined)
      .finally(() => {
        logoutProfile()
          .catch(() => undefined)
          .finally(() => {
            leaving.current = false;
          });
      });
  }

  if (!ready || entering) {
    return <BootLoading dark={loginDark} />;
  }

  if (!profileId) {
    return (
      <>
        <StatusBar style={loginDark ? "light" : "dark"} />
        <ProfilesScreen
          dark={loginDark}
          onEnter={(id) => enter(id).catch(() => undefined)}
        />
      </>
    );
  }

  return (
    <ThemeProvider key={profileId}>
      <SessionProvider logout={logout}>
        <ThemedApp openSettings={openSettings} />
      </SessionProvider>
    </ThemeProvider>
  );
}

function BootLoading({ dark }: { dark?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: dark ? "#0B0B0B" : "#ffffff",
      }}
    >
      <ActivityIndicator color={dark ? "#F4F4F5" : "#111111"} />
    </View>
  );
}

function ThemedApp({ openSettings }: { openSettings: boolean }) {
  const { dark } = useTheme();
  const navigation = useNavigationContainerRef();

  useEffect(() => {
    if (!openSettings) return;
    const timer = setTimeout(() => navigation.navigate("Settings" as never), 0);
    return () => clearTimeout(timer);
  }, [navigation, openSettings]);

  return (
    <NavigationContainer
      ref={navigation}
      theme={dark ? DarkTheme : DefaultTheme}
    >
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          contentStyle: { backgroundColor: dark ? "#0B0B0B" : "#ffffff" },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen
          name="Cashflow"
          component={CashflowScreen}
          options={{
            animation: "none",
            fullScreenGestureEnabled: false,
            gestureResponseDistance: 20,
          }}
        />
        <Stack.Screen
          name="Stock"
          component={StockScreen}
          options={{
            animation: "none",
            fullScreenGestureEnabled: false,
            gestureResponseDistance: 20,
          }}
        />
        <Stack.Screen
          name="Trading"
          component={TradingScreen}
          options={{
            animation: "none",
            fullScreenGestureEnabled: false,
            gestureResponseDistance: 20,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
