import { StockContent } from "./StockContent";
import type { ListedStock } from "./stockList";

export function StockScreen({
  route,
}: {
  route: { params?: { stock?: ListedStock } };
}) {
  return <StockContent stock={route.params?.stock} />;
}
