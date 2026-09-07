import { View } from "react-native";
import { ScreenBack } from "./ScreenBack";
import { TradingContent } from "./TradingContent";
import type { ListedStock } from "./stockList";

export function TradingScreen({
  route,
}: {
  route: { params?: { stock?: ListedStock } };
}) {
  return (
    <View style={{ flex: 1 }}>
      <TradingContent stock={route.params?.stock} />
      <ScreenBack />
    </View>
  );
}
