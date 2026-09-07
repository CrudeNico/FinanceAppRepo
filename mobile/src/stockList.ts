export type ListedStock = {
  id: string;
  ticker: string;
  name: string;
  image: string | null;
  letter?: string;
  color?: string;
  saved?: boolean;
  saving?: boolean;
};

export const INITIAL_STOCKS: ListedStock[] = [
  {
    id: "vwce",
    ticker: "VWCE",
    name: "Vanguard FTSE All-World (Acc)",
    image: null,
    letter: "V",
    color: "#C8102E",
    saved: true,
  },
];
