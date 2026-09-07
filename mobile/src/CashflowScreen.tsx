import { CashflowContent } from "./CashflowContent";
import type { ListedStock } from "./stockList";

export function CashflowScreen({
  route,
}: {
  route: { params?: { stock?: ListedStock } };
}) {
  return <CashflowContent stock={route.params?.stock} />;
}
