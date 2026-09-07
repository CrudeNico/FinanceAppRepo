import { View } from "react-native";
import { ScreenBack } from "./ScreenBack";
import { StockContent } from "./StockContent";
import type { ListedStock } from "./stockList";

export function StockScreen({
  route,
}: {
  route: { params?: { stock?: ListedStock } };
}) {
  return (
    <View style={{ flex: 1 }}>
      <StockContent stock={route.params?.stock} />
      <ScreenBack />
    </View>
  );
}
