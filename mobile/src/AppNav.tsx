import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { HomeScreen } from "./HomeScreen";
import { StockScreen } from "./StockScreen";

export function AppNav() {
  const [page, setPage] = useState<"home" | "stock">("home");

  if (page === "home") {
    return <HomeScreen onOpenStock={() => setPage("stock")} />;
  }

  return (
    <View style={styles.root}>
      <HomeScreen onOpenStock={() => undefined} />
      <StockScreen onBack={() => setPage("home")} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
