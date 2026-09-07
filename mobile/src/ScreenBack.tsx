import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "./theme";

export function ScreenBack() {
  const navigation = useNavigation();
  const { colors: c } = useTheme();
  return (
    <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={styles.back}>
      <Text style={[styles.backText, { color: c.ink }]}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { position: "absolute", left: 12, top: 52, zIndex: 30, padding: 8 },
  backText: { fontSize: 32, lineHeight: 34 },
});
