import { View } from "react-native";
import { CashflowContent } from "./CashflowContent";
import { ScreenBack } from "./ScreenBack";
import type { ListedStock } from "./stockList";

export function CashflowScreen({
  route,
}: {
  route: { params?: { stock?: ListedStock } };
}) {
  return (
    <View style={{ flex: 1 }}>
      <CashflowContent stock={route.params?.stock} />
      <ScreenBack />
    </View>
  );
}
