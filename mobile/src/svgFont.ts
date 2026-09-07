import { Platform } from "react-native";

export const svgUiFont = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui",
}) as string;
