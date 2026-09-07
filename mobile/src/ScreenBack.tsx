import { useNavigation } from "@react-navigation/native";
import { Platform, Pressable, StyleSheet } from "react-native";
import { createPortal } from "react-dom";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "./theme";

export function ScreenBack() {
  const navigation = useNavigation();
  const { colors: c, dark } = useTheme();
  const border = dark ? "#22C55E" : "#E5E7EB";

  function goBack() {
    navigation.goBack();
  }

  if (Platform.OS === "web" && typeof document !== "undefined") {
    return createPortal(
      <div
        role="button"
        aria-label="Back"
        onClick={goBack}
        style={{
          position: "fixed",
          left: 16,
          top: 12,
          zIndex: 2147483646,
          width: 36,
          height: 36,
          borderRadius: 18,
          border: `1.5px solid ${border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          background: "transparent",
          boxSizing: "border-box",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15.75 19.5 8.25 12l7.5-7.5"
            stroke={c.ink}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>,
      document.body,
    );
  }

  return (
    <Pressable
      onPress={goBack}
      hitSlop={8}
      style={[styles.back, { borderColor: border }]}
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
    zIndex: 50,
    elevation: 50,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
