import { useNavigation } from "@react-navigation/native";
import { useRef } from "react";

export function useLockBackGesture() {
  const navigation = useNavigation();
  const locked = useRef(false);

  function lock() {
    if (locked.current) return;
    locked.current = true;
    navigation.setOptions({ gestureEnabled: false });
  }

  function unlock() {
    if (!locked.current) return;
    locked.current = false;
    navigation.setOptions({ gestureEnabled: true });
  }

  return { lock, unlock };
}
