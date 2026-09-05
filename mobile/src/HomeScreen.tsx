import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ASSET } from "./assetData";

export function HomeScreen({ navigation }: { navigation: { navigate: (name: string) => void } }) {
  return (
    <View style={styles.screen}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate("Stock")}
        style={styles.card}
      >
        <View style={styles.logo}>
          <Text style={styles.logoMark}>V</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.meta}>
            {ASSET.ticker} · {ASSET.exchange}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {ASSET.name}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#E6E6E6",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F3F3F3",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#C8102E",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMark: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
  copy: { flex: 1, minWidth: 0 },
  meta: { color: "#9CA3AF", fontSize: 11 },
  name: { color: "#111111", fontSize: 14, fontWeight: "600", marginTop: 1 },
});
