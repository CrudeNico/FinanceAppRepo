import { type ReactNode, useEffect, useRef } from "react";
import { Platform, ScrollView } from "react-native";

export const TABLE_ROW_HEIGHT = 36;
export const TABLE_VISIBLE_ROWS = 6;

export function TableBody({
  rows,
  onLock,
  children,
}: {
  rows: number;
  onLock?: (active: boolean) => void;
  children: ReactNode;
}) {
  const scroll = rows > TABLE_VISIBLE_ROWS;
  const maxHeight = TABLE_ROW_HEIGHT * TABLE_VISIBLE_ROWS;
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !scroll) return;
    const el = boxRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !el.contains(target)) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, el.scrollTop + event.deltaY));
      if (next === el.scrollTop) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      el.scrollTop = next;
    };

    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => document.removeEventListener("wheel", onWheel, true);
  }, [scroll]);

  if (Platform.OS === "web") {
    return (
      <div
        ref={boxRef}
        style={{
          height: scroll ? maxHeight : undefined,
          maxHeight: scroll ? maxHeight : undefined,
          overflowY: scroll ? "auto" : "visible",
          overscrollBehavior: "contain",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scroll}
      style={scroll ? { maxHeight, flexGrow: 0 } : undefined}
      onScrollBeginDrag={() => onLock?.(true)}
      onScrollEndDrag={() => onLock?.(false)}
      onMomentumScrollEnd={() => onLock?.(false)}
    >
      {children}
    </ScrollView>
  );
}
