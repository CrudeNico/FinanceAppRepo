import { AssetContent } from "./AssetContent";
import type { ListedStock } from "./stockList";

export function AssetScreen({
  route,
}: {
  route: { params?: { stock?: ListedStock } };
}) {
  return <AssetContent stock={route.params?.stock} />;
}
