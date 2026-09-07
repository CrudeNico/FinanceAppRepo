import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "./theme";

export function ScreenBack() {
  const navigation = useNavigation();
  const { colors: c, dark } = useTheme();
  return (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={8}
      style={[
        styles.back,
        { borderColor: dark ? "#22C55E" : "#E5E7EB" },
      ]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15.75 19.5 8.25 12l7.5-7.5"
          stroke={c.ink}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    position: "absolute",
    left: 16,
    top: 12,
    zIndex: 30,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
