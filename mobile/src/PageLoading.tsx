import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTheme } from "./theme";

export function PageLoading() {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center" },
});
