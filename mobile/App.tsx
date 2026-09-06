import { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { enterProfile, getLastTheme, getSession, initProfiles, logoutProfile } from "./src/profiles";
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
    const profile = await enterProfile(id);
    if (profile) setProfileId(profile.id);
  }

  async function logout() {
    const theme = await getLastTheme();
    setLoginDark(theme === "dark");
    await logoutProfile();
    setProfileId(null);
  }

  if (!ready) return null;

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
      <SessionProvider logout={() => logout().catch(() => undefined)}>
        <ThemedApp />
      </SessionProvider>
    </ThemeProvider>
  );
}

function ThemedApp() {
  const { dark } = useTheme();
  return (
    <NavigationContainer theme={dark ? DarkTheme : DefaultTheme}>
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
