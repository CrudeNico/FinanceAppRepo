import { type ReactNode } from "react";
import { ScrollView } from "react-native";

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
  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scroll}
      style={scroll ? { maxHeight: TABLE_ROW_HEIGHT * TABLE_VISIBLE_ROWS } : undefined}
      onScrollBeginDrag={() => onLock?.(true)}
      onScrollEndDrag={() => onLock?.(false)}
      onMomentumScrollEnd={() => onLock?.(false)}
    >
      {children}
    </ScrollView>
  );
}
