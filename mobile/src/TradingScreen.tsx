import { TradingContent } from "./TradingContent";
import type { ListedStock } from "./stockList";

export function TradingScreen({
  route,
}: {
  route: { params?: { stock?: ListedStock } };
}) {
  return <TradingContent stock={route.params?.stock} />;
}
