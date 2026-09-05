import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Dashboard } from "./src/Dashboard";

export default function App() {
  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <Dashboard />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B1F3A",
  },
});
