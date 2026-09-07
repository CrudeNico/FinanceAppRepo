import { type ReactNode } from "react";
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

  if (Platform.OS === "web") {
    return (
      <div
        style={{
          maxHeight: scroll ? maxHeight : undefined,
          overflowY: scroll ? "auto" : "visible",
          overscrollBehavior: "contain",
        }}
        onPointerEnter={() => {
          if (scroll) onLock?.(true);
        }}
        onPointerLeave={() => onLock?.(false)}
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
