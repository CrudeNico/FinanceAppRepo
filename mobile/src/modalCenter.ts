import { Platform, StyleSheet } from "react-native";

export const modalCenter = StyleSheet.create({
  bg: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    ...(Platform.OS === "web"
      ? ({
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          minHeight: "100dvh",
          zIndex: 40,
        } as object)
      : null),
  },
  sheet: {
    width: 300,
    maxWidth: "100%",
    borderRadius: 16,
    padding: 14,
    zIndex: 41,
    alignSelf: "center",
  },
});
