import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { initDb } from "./src/db";
import { HomeScreen } from "./src/HomeScreen";
import { StockScreen } from "./src/StockScreen";
import { TradingScreen } from "./src/TradingScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb()
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
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
