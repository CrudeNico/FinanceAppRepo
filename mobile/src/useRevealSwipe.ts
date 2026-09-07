import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, type View } from "react-native";

type Point = { pageX: number; pageY: number; locationX: number; locationY: number };

function pagePoint(event: { pageX?: number; clientX?: number; pageY?: number; clientY?: number }): Point {
  return {
    pageX: Number(event.pageX ?? event.clientX ?? 0),
    pageY: Number(event.pageY ?? event.clientY ?? 0),
    locationX: 0,
    locationY: 0,
  };
}

function fromNative(event: { nativeEvent?: Record<string, number> }): Point {
  const native = event.nativeEvent ?? {};
  const touch = (native as { touches?: { pageX: number; pageY: number }[] }).touches?.[0];
  return {
    pageX: Number(touch?.pageX ?? native.pageX ?? native.clientX ?? 0),
    pageY: Number(touch?.pageY ?? native.pageY ?? native.clientY ?? 0),
    locationX: Number(native.locationX ?? native.offsetX ?? 0),
    locationY: Number(native.locationY ?? native.offsetY ?? 0),
  };
}

function domNode(value: unknown): HTMLElement | null {
  if (!value || typeof HTMLElement === "undefined") return null;
  if (value instanceof HTMLElement) return value;
  const record = value as { firstChild?: unknown };
  if (record.firstChild instanceof HTMLElement) return record.firstChild;
  return null;
}

export function useRevealSwipe({
  open,
  enabled = true,
  width = 68,
  onOpen,
  onClose,
  onLock,
  onUnlock,
  onTap,
}: {
  open: boolean;
  enabled?: boolean;
  width?: number;
  onOpen: () => void;
  onClose: () => void;
  onLock?: () => void;
  onUnlock?: () => void;
  onTap?: (locationX: number) => void;
}) {
  const pan = useRef(new Animated.Value(0)).current;
  const nodeRef = useRef<View | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  function bindRef(view: View | null) {
    nodeRef.current = view;
    const next = domNode(view);
    setHost((current) => (current === next ? current : next));
  }
  const offset = useRef(0);
  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const captured = useRef(false);
  const tapX = useRef(0);
  const openRef = useRef(onOpen);
  const closeRef = useRef(onClose);
  const lockRef = useRef(onLock);
  const unlockRef = useRef(onUnlock);
  const tapRef = useRef(onTap);
  const enabledRef = useRef(enabled);
  const widthRef = useRef(width);
  openRef.current = onOpen;
  closeRef.current = onClose;
  lockRef.current = onLock;
  unlockRef.current = onUnlock;
  tapRef.current = onTap;
  enabledRef.current = enabled;
  widthRef.current = width;

  function snap(shouldOpen: boolean) {
    const toValue = shouldOpen ? widthRef.current : 0;
    offset.current = toValue;
    Animated.timing(pan, {
      toValue,
      duration: 120,
      useNativeDriver: true,
    }).start();
    if (shouldOpen) openRef.current();
    else closeRef.current();
  }

  useEffect(() => {
    if (!open) {
      offset.current = 0;
      Animated.timing(pan, { toValue: 0, duration: 80, useNativeDriver: true }).start();
    } else {
      offset.current = widthRef.current;
      pan.setValue(widthRef.current);
    }
  }, [open, pan]);

  function grant(next: Point, locationX: number) {
    if (!enabledRef.current) return false;
    dragging.current = true;
    captured.current = false;
    start.current = { x: next.pageX, y: next.pageY };
    tapX.current = locationX;
    lockRef.current?.();
    pan.stopAnimation((value) => {
      offset.current = value;
    });
    return true;
  }

  function move(next: Point) {
    if (!dragging.current || !enabledRef.current) return;
    const dx = next.pageX - start.current.x;
    const dy = next.pageY - start.current.y;
    if (!captured.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        dragging.current = false;
        unlockRef.current?.();
        return;
      }
      captured.current = true;
    }
    pan.setValue(Math.max(0, Math.min(widthRef.current, offset.current + dx)));
  }

  function finish(next: Point) {
    if (!dragging.current) return;
    dragging.current = false;
    unlockRef.current?.();
    const dx = next.pageX - start.current.x;
    const dy = next.pageY - start.current.y;
    if (!captured.current && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      if (offset.current > widthRef.current / 2) {
        closeRef.current();
        return;
      }
      tapRef.current?.(tapX.current);
      return;
    }
    if (dx > 12) snap(true);
    else if (dx < -12) snap(false);
    else snap(offset.current + dx > widthRef.current / 2);
  }

  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;
    const el = host;
    if (!el) return;
    el.style.touchAction = "none";
    (el.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = "none";

    const locX = (event: TouchEvent | PointerEvent | MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = "clientX" in event ? event.clientX : event.changedTouches?.[0]?.clientX ?? 0;
      return x - rect.left;
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      grant(pagePoint(touch), locX(event));
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || !dragging.current) return;
      if (captured.current) event.preventDefault();
      move(pagePoint(touch));
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (touch) finish(pagePoint(touch));
    };
    const onMouseDown = (event: MouseEvent) => {
      grant(pagePoint(event), locX(event));
      const onMove = (next: MouseEvent) => {
        if (captured.current) next.preventDefault();
        move(pagePoint(next));
      };
      const onUp = (next: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        finish(pagePoint(next));
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("mousedown", onMouseDown);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
    };
  }, [enabled, host]);

  const handlers =
    Platform.OS === "web"
      ? {}
      : {
          onStartShouldSetResponder: () => enabled,
          onMoveShouldSetResponder: () => enabled,
          onResponderGrant: (event: { nativeEvent: Record<string, number> }) =>
            grant(fromNative({ nativeEvent: event.nativeEvent }), Number(event.nativeEvent.locationX ?? 0)),
          onResponderMove: (event: { nativeEvent: Record<string, number> }) =>
            move(fromNative({ nativeEvent: event.nativeEvent })),
          onResponderRelease: (event: { nativeEvent: Record<string, number> }) =>
            finish(fromNative({ nativeEvent: event.nativeEvent })),
          onResponderTerminate: () => {
            dragging.current = false;
            unlockRef.current?.();
          },
        };

  return {
    pan,
    nodeRef: bindRef,
    handlers,
    style: Platform.OS === "web" ? ({ touchAction: "none", userSelect: "none" } as const) : undefined,
  };
}

export function useDragTrack(
  onPick: (x: number, y: number, phase: "start" | "move") => void,
  onActive: (active: boolean) => void,
) {
  const pickRef = useRef(onPick);
  const activeRef = useRef(onActive);
  pickRef.current = onPick;
  activeRef.current = onActive;

  return useMemo(() => {
    return {
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderGrant: (event: { nativeEvent: { locationX: number; locationY?: number } }) => {
        activeRef.current(true);
        pickRef.current(event.nativeEvent.locationX, event.nativeEvent.locationY ?? 0, "start");
      },
      onResponderMove: (event: { nativeEvent: { locationX: number; locationY?: number } }) => {
        pickRef.current(event.nativeEvent.locationX, event.nativeEvent.locationY ?? 0, "move");
      },
      onResponderRelease: () => activeRef.current(false),
      onResponderTerminate: () => activeRef.current(false),
      onTouchStart: (event: { nativeEvent: { locationX: number; locationY?: number } }) => {
        activeRef.current(true);
        pickRef.current(event.nativeEvent.locationX, event.nativeEvent.locationY ?? 0, "start");
      },
      onTouchMove: (event: { nativeEvent: { locationX: number; locationY?: number } }) => {
        pickRef.current(event.nativeEvent.locationX, event.nativeEvent.locationY ?? 0, "move");
      },
      onTouchEnd: () => activeRef.current(false),
    };
  }, []);
}
