export type TradeRow = {
  id: string;
  month: string;
  gain: string;
  loss: string;
  deposit: string;
  withdrawal: string;
};

export type DayEntry = {
  gain: string;
  loss: string;
};

export type CashflowEntry = {
  id: string;
  date: string;
  kind: "income" | "expense";
  amount: string;
  label: string;
};
