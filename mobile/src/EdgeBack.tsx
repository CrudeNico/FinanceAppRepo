import { useNavigation } from "@react-navigation/native";
import { useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";

export function EdgeBack() {
  const navigation = useNavigation();
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const unbind = useRef<(() => void) | null>(null);

  if (Platform.OS !== "web") return null;

  function stop() {
    unbind.current?.();
    unbind.current = null;
  }

  function finish(pageX: number, pageY: number) {
    if (!tracking.current) {
      stop();
      return;
    }
    tracking.current = false;
    stop();
    const dx = pageX - startX.current;
    const dy = pageY - startY.current;
    if (dx > 56 && Math.abs(dx) > Math.abs(dy)) navigation.goBack();
  }

  return (
    <View
      style={styles.edge}
      onPointerDown={(event) => {
        tracking.current = true;
        startX.current = event.nativeEvent.pageX ?? event.nativeEvent.clientX;
        startY.current = event.nativeEvent.pageY ?? event.nativeEvent.clientY;
        stop();
        const move = (next: PointerEvent) => {
          if (!tracking.current) return;
          const dx = next.pageX - startX.current;
          const dy = next.pageY - startY.current;
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) tracking.current = false;
        };
        const up = (next: PointerEvent) => finish(next.pageX, next.pageY);
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        unbind.current = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
        };
      }}
    />
  );
}

const styles = StyleSheet.create({
  edge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 20,
    ...(Platform.OS === "web" ? ({ touchAction: "none" } as object) : null),
  },
});
