export type CategoryKind = "income" | "expense";

export type CategoryItem = {
  id: string;
  name: string;
};

export type CategoryGroup = {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  saved: boolean;
  items: CategoryItem[];
};

export const CATEGORY_COLORS: Record<string, string> = {
  food: "#E11D48",
  housing: "#0F766E",
  transport: "#2563EB",
  shopping: "#D97706",
  fun: "#7C3AED",
  health: "#DC2626",
  travel: "#0284C7",
  education: "#4F46E5",
  family: "#DB2777",
  bills: "#475569",
  work: "#374151",
  other: "#6B7280",
  employment: "#059669",
  income: "#16A34A",
};

export const CATEGORY_COLOR_OPTIONS = [
  "#E11D48",
  "#0F766E",
  "#2563EB",
  "#D97706",
  "#7C3AED",
  "#DC2626",
  "#0284C7",
  "#4F46E5",
  "#DB2777",
  "#475569",
  "#059669",
  "#16A34A",
];

function group(
  id: string,
  name: string,
  kind: CategoryKind,
  items: string[],
): CategoryGroup {
  return {
    id,
    name,
    kind,
    icon: id,
    color: CATEGORY_COLORS[id] ?? "#6B7280",
    saved: true,
    items: items.map((item, index) => ({ id: `${id}-${index}`, name: item })),
  };
}

export const DEFAULT_CATEGORY_GROUPS: CategoryGroup[] = [
  group("food", "Food & Dining", "expense", [
    "Groceries",
    "Restaurants",
    "Takeaway / Delivery",
    "Coffee & Snacks",
    "Work Lunches",
  ]),
  group("housing", "Housing", "expense", [
    "Rent / Mortgage",
    "Electricity",
    "Gas",
    "Water",
    "Internet",
    "Phone",
    "Home Maintenance",
    "Furniture & Home Goods",
  ]),
  group("transport", "Transportation", "expense", [
    "Public Transport",
    "Fuel",
    "Parking",
    "Taxi / Uber",
    "Car Payment",
    "Car Maintenance",
    "Car Insurance",
    "Bike / Scooter",
  ]),
  group("shopping", "Shopping", "expense", [
    "Clothing",
    "Electronics",
    "Personal Items",
    "Household Items",
    "Gifts",
    "Online Shopping",
  ]),
  group("fun", "Fun & Entertainment", "expense", [
    "Going Out",
    "Movies / Cinema",
    "Games",
    "Hobbies",
    "Events / Concerts",
    "Bars / Nightlife",
    "Books",
    "Streaming Services",
  ]),
  group("health", "Health & Wellness", "expense", [
    "Doctor / Medical",
    "Pharmacy",
    "Dental",
    "Gym / Fitness",
    "Sports",
    "Personal Care",
    "Haircuts / Beauty",
  ]),
  group("travel", "Travel", "expense", [
    "Flights",
    "Hotels",
    "Transportation",
    "Food While Traveling",
    "Activities / Sightseeing",
    "Vacation",
  ]),
  group("education", "Education", "expense", [
    "Courses",
    "Books & Materials",
    "Tuition",
    "Software / Learning Tools",
  ]),
  group("family", "Family & Personal", "expense", [
    "Childcare",
    "Kids",
    "Pets",
    "Family Support",
    "Donations / Charity",
  ]),
  group("bills", "Bills & Financial", "expense", [
    "Insurance",
    "Bank Fees",
    "Taxes",
    "Loan Payments",
    "Credit Card Payments",
    "Subscriptions",
  ]),
  group("work", "Work / Business", "expense", [
    "Work Expenses",
    "Software",
    "Equipment",
    "Office Supplies",
    "Business Travel",
    "Professional Services",
  ]),
  group("other", "Other", "expense", [
    "Cash Withdrawal",
    "Unexpected Expenses",
    "Miscellaneous",
  ]),
  group("employment", "Employment", "income", [
    "Salary",
    "Bonus",
    "Overtime",
    "Tips / Commission",
    "Other Income",
  ]),
  group("income", "Income", "income", [
    "Gifts Received",
    "Refunds",
    "Cashback",
    "Government Benefits",
    "Reimbursements",
    "Selling Items",
    "Other Income",
  ]),
];
