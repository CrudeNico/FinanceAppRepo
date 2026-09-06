import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { CashflowHistory } from "./CashflowHistory";
import {
  ASSET,
  cashflowStats,
  chartScale,
  filterByRange,
  filterSeries,
  formatChartDate,
  formatEuro,
  type PricePoint,
  type RangeKey,
} from "./assetData";
import type { CategoryGroup } from "./cashflowCategories";
import { loadCashflowEntries, loadCategoryGroups, saveCashflowEntries } from "./db";
import type { CashflowEntry } from "./models";
import type { ListedStock } from "./stockList";

const BLUE = "#3B82F6";
const GREEN = "#16A34A";
const INK = "#111111";
const MUTED = "#9CA3AF";
const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];

export function CashflowContent({ stock }: { stock?: ListedStock }) {
  const [range, setRange] = useState<RangeKey>("1M");
  const [hover, setHover] = useState<PricePoint | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const historyOffset = useRef({ y: 0, height: 0 });
  const revealAfterLayout = useRef(false);
  const [view, setView] = useState<"graph" | "pie">("graph");
  const [pieFocus, setPieFocus] = useState<"split" | "total">("split");
  const [dataReady, setDataReady] = useState(false);
  const [logoReady, setLogoReady] = useState(!stock?.image);
  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const show = dataReady && logoReady;
  const stats = useMemo(() => cashflowStats(entries), [entries]);
  const prices = useMemo(() => filterSeries(stats.prices, range), [stats.prices, range]);
  const pieEntries = useMemo(() => {
    const rows = entries.filter(
      (entry) => entry.id !== "c-start" && entry.label !== "Starting balance",
    );
    return filterByRange(rows, range);
  }, [entries, range]);
  const expenseSlices = useMemo(
    () => categorySlices(pieEntries, groups, "expense"),
    [pieEntries, groups],
  );
  const incomeSlices = useMemo(
    () => categorySlices(pieEntries, groups, "income"),
    [pieEntries, groups],
  );
  const totalSlices = useMemo(
    () => categorySlices(pieEntries, groups, "all"),
    [pieEntries, groups],
  );
  const shownPrice = hover?.value ?? stats.value;

  useEffect(() => {
    let cancelled = false;
    setDataReady(false);
    if (!stock?.id) {
      setEntries([]);
      setDataReady(true);
      return;
    }
    Promise.all([loadCashflowEntries(stock.id), loadCategoryGroups()])
      .then(([rows, nextGroups]) => {
        if (cancelled) return;
        const start = rows.find(
          (entry) => entry.id === "c-start" || entry.label === "Starting balance",
        );
        const next =
          start && start.id !== "c-start"
            ? [
                { ...start, id: "c-start", label: "Starting balance", kind: "income" as const },
                ...rows.filter((entry) => entry.id !== start.id),
              ]
            : rows;
        setEntries(next);
        if (start && start.id !== "c-start" && stock.id) {
          saveCashflowEntries(stock.id, next).catch(() => undefined);
        }
        setGroups(nextGroups);
        setDataReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setDataReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [stock?.id]);

  function persist(next: CashflowEntry[]) {
    setEntries(next);
    if (stock?.id) saveCashflowEntries(stock.id, next).catch(() => undefined);
  }

  function revealHistory() {
    const visible = Dimensions.get("window").height - keyboardHeightRef.current;
    const { y, height } = historyOffset.current;
    const top = Math.max(0, y + height - visible + 20);
    scrollRef.current?.scrollTo({ y: top, animated: true });
  }

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        const height = event.endCoordinates.height;
        keyboardHeightRef.current = height;
        setKeyboardHeight(height);
        requestAnimationFrame(revealHistory);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        keyboardHeightRef.current = 0;
        setKeyboardHeight(0);
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.screen, { opacity: show ? 1 : 0 }]}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + keyboardHeight }]}
      scrollEnabled={show && !scrubbing}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.logo,
            stock?.image ? styles.logoPlain : stock?.color ? { backgroundColor: stock.color } : null,
          ]}
        >
          {stock?.image ? (
            <Image
              source={{ uri: stock.image }}
              style={styles.logoImage}
              fadeDuration={0}
              onLoad={() => setLogoReady(true)}
              onError={() => setLogoReady(true)}
            />
          ) : (
            <Text style={styles.logoMark}>
              {stock?.letter ?? stock?.ticker?.trim()?.[0] ?? "C"}
            </Text>
          )}
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {stock?.ticker ?? ASSET.ticker}
            </Text>
            <View style={styles.metaDot} />
          </View>
          <Text style={styles.name}>{stock?.name ?? ASSET.name}</Text>
        </View>
      </View>

      <Text style={styles.price}>
        <Text style={styles.euro}>€</Text>
        {(shownPrice ?? 0).toFixed(2)}
      </Text>

      {view === "graph" ? (
        <>
          <PriceChart
            prices={prices}
            current={stats.value}
            hover={hover}
            onHover={setHover}
            onScrubbing={setScrubbing}
          />
          <View style={styles.controls}>
            <RangeButtons range={range} onChange={setRange} onPick={() => setHover(null)} />
            <ViewToggle view={view} onView={setView} onScrubbing={setScrubbing} onClearHover={() => setHover(null)} />
          </View>
        </>
      ) : (
        <PieBoard
          income={incomeSlices}
          expense={expenseSlices}
          total={totalSlices}
          focus={pieFocus}
          onFocus={setPieFocus}
          onScrubbing={setScrubbing}
          ranges={
            <RangeButtons
              range={range}
              onChange={setRange}
              onPick={() => setHover(null)}
              compact
            />
          }
          toggle={
            <ViewToggle
              view={view}
              onView={setView}
              onScrubbing={setScrubbing}
              onClearHover={() => setHover(null)}
            />
          }
        />
      )}

      <Text style={styles.section}>Your net worth</Text>
      <View style={styles.card}>
        <Row label="VALUE" value={formatEuro(stats.value)} />
        <Row label="EXPENSES" value={formatEuro(stats.monthlyExpenses)} last />
      </View>

      <View
        onLayout={(event) => {
          historyOffset.current = {
            y: event.nativeEvent.layout.y,
            height: event.nativeEvent.layout.height,
          };
          if (revealAfterLayout.current) {
            revealAfterLayout.current = false;
            requestAnimationFrame(revealHistory);
          }
        }}
      >
        <CashflowHistory
          entries={entries}
          ready={dataReady}
          onChange={persist}
          onAdded={() => {
            revealAfterLayout.current = true;
          }}
        />
      </View>
    </ScrollView>
  );
}

type Slice = {
  name: string;
  color: string;
  value: number;
  kind: "income" | "expense";
};

function categorySlices(
  entries: CashflowEntry[],
  groups: CategoryGroup[],
  kind: "expense" | "income" | "all",
) {
  const byItem = new Map<string, CategoryGroup>();
  groups.forEach((group) => {
    group.items.forEach((item) => byItem.set(item.name, group));
  });
  const totals = new Map<string, Slice>();
  entries.forEach((entry) => {
    if (entry.id === "c-start" || entry.label === "Starting balance") return;
    if (kind !== "all" && entry.kind !== kind) return;
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const group = byItem.get(entry.label);
    const key = `${entry.kind}-${group?.id ?? (entry.label || "other")}`;
    const current = totals.get(key) ?? {
      name: group?.name ?? (entry.label || "Other"),
      color: group?.color || "#6B7280",
      value: 0,
      kind: entry.kind,
    };
    current.value += amount;
    totals.set(key, current);
  });
  return [...totals.values()].sort((a, b) => b.value - a.value);
}

type PieHint = { kind: "income" | "expense"; name: string; pct: number; amount: number };

function hslTone(hue: number, index: number, count: number) {
  const t = count <= 1 ? 0.35 : index / Math.max(count - 1, 1);
  const light = 32 + t * 38;
  return `hsl(${hue}, 72%, ${light}%)`;
}

function shadeSlices(slices: Slice[]) {
  const income = slices
    .filter((slice) => slice.kind === "income")
    .map((slice, index, list) => ({ ...slice, color: hslTone(142, index, list.length) }));
  const expense = slices
    .filter((slice) => slice.kind === "expense")
    .map((slice, index, list) => ({ ...slice, color: hslTone(0, index, list.length) }));
  return [...income, ...expense];
}

function RangeButtons({
  range,
  onChange,
  onPick,
  compact,
}: {
  range: RangeKey;
  onChange: (range: RangeKey) => void;
  onPick?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.ranges, compact && styles.rangesCompact]}>
      {RANGES.map((item) => (
        <Pressable
          key={item}
          onPress={() => {
            onPick?.();
            onChange(item);
          }}
          style={[styles.range, range === item && styles.rangeOn]}
        >
          <Text style={[styles.rangeText, range === item && styles.rangeTextOn]}>
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ViewToggle({
  view,
  onView,
  onScrubbing,
  onClearHover,
}: {
  view: "graph" | "pie";
  onView: (view: "graph" | "pie") => void;
  onScrubbing: (active: boolean) => void;
  onClearHover: () => void;
}) {
  return (
    <View style={styles.viewToggle}>
      <Pressable
        onPress={() => {
          onClearHover();
          onView("graph");
        }}
        hitSlop={8}
        style={[styles.viewBtn, view === "graph" && styles.viewBtnOn]}
      >
        <ChartIcon />
      </Pressable>
      <Pressable
        onPress={() => {
          onClearHover();
          onScrubbing(false);
          onView("pie");
        }}
        hitSlop={8}
        style={[styles.viewBtn, view === "pie" && styles.viewBtnOn]}
      >
        <PieIcon />
      </Pressable>
    </View>
  );
}

function PieHintCard({
  hint,
  leading,
  extra,
}: {
  hint: PieHint | null;
  leading?: ReactNode;
  extra?: ReactNode;
}) {
  const income = hint?.kind === "income";
  return (
    <View style={styles.pieHintRow}>
      {leading && !hint ? <View style={styles.pieHintRanges}>{leading}</View> : null}
      <View style={styles.pieHintBox}>
        {hint ? (
          <>
            <View style={[styles.pieHintChip, income ? styles.pieHintIncome : styles.pieHintExpense]}>
              <Text style={styles.pieHintChipText}>
                {hint.name} · {Math.round(hint.pct)}%
              </Text>
            </View>
            <Text style={styles.pieHintAmount}>{formatEuro(hint.amount)}</Text>
          </>
        ) : null}
      </View>
      {extra ? <View style={styles.pieHintToggle}>{extra}</View> : null}
    </View>
  );
}

function PieBoard({
  income,
  expense,
  total,
  focus,
  onFocus,
  onScrubbing,
  ranges,
  toggle,
}: {
  income: Slice[];
  expense: Slice[];
  total: Slice[];
  focus: "split" | "total";
  onFocus: (focus: "split" | "total") => void;
  onScrubbing: (active: boolean) => void;
  ranges?: ReactNode;
  toggle?: ReactNode;
}) {
  const [hint, setHint] = useState<PieHint | null>(null);

  useEffect(() => {
    setHint(null);
  }, [income, expense, total]);

  function showHint(next: PieHint | null) {
    setHint(next);
  }

  if (focus === "total") {
    return (
      <View style={styles.pieBoard}>
        <View style={styles.pieTotalStage}>
          <Text style={styles.pieCaption}>Total</Text>
          <CategoryPie
            slices={total}
            size={210}
            kindSummary
            onHover={showHint}
            onScrubbing={onScrubbing}
          />
          <View style={styles.pieSideLowLeft}>
            <CategoryPie
              slices={income}
              size={80}
              onTap={() => {
                setHint(null);
                onFocus("split");
              }}
            />
          </View>
          <View style={styles.pieSideLowRight}>
            <CategoryPie
              slices={expense}
              size={80}
              onTap={() => {
                setHint(null);
                onFocus("split");
              }}
            />
          </View>
        </View>
        <PieHintCard hint={hint} leading={ranges} extra={toggle} />
      </View>
    );
  }

  return (
    <View style={styles.pieBoard}>
      <View style={styles.pieSplit}>
        <View style={styles.pieSplitRow}>
          <View style={styles.pieHalf}>
            <CategoryPie
              slices={income}
              size={176}
              percents
              onHover={showHint}
              onScrubbing={onScrubbing}
            />
            <Text style={styles.pieCaption}>Income</Text>
          </View>
          <View style={styles.pieHalf}>
            <CategoryPie
              slices={expense}
              size={176}
              percents
              onHover={showHint}
              onScrubbing={onScrubbing}
            />
            <Text style={styles.pieCaption}>Expenses</Text>
          </View>
        </View>
        <View style={styles.pieTotalHit} pointerEvents="box-none">
          <CategoryPie
            slices={total}
            size={80}
            onTap={() => {
              setHint(null);
              onFocus("total");
            }}
          />
        </View>
      </View>
        <PieHintCard hint={hint} leading={ranges} extra={toggle} />
    </View>
  );
}

function CategoryPie({
  slices,
  size,
  percents,
  kindSummary,
  onHover,
  onScrubbing,
  onTap,
}: {
  slices: Slice[];
  size: number;
  percents?: boolean;
  kindSummary?: boolean;
  onHover?: (hint: PieHint | null) => void;
  onScrubbing?: (active: boolean) => void;
  onTap?: () => void;
}) {
  const moved = useRef(false);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;
  const painted = shadeSlices(slices);
  const sum = painted.reduce((total, slice) => total + slice.value, 0);
  const incomeSum = painted
    .filter((slice) => slice.kind === "income")
    .reduce((total, slice) => total + slice.value, 0);
  const expenseSum = sum - incomeSum;
  let angle = -Math.PI / 2;
  const paths = painted.map((slice, index) => {
    const sweep = sum === 0 ? 0 : (slice.value / sum) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = start + sweep / 2;
    const pct = sum === 0 ? 0 : (slice.value / sum) * 100;
    return {
      ...slice,
      key: `${slice.kind}-${slice.name}-${index}`,
      d: pieSlice(cx, cy, radius, start, end),
      full: sweep >= Math.PI * 2 - 0.001,
      start,
      end,
      pct,
      labelX: cx + Math.cos(mid) * radius * 0.58,
      labelY: cy + Math.sin(mid) * radius * 0.58,
    };
  });
  const incomePct = sum === 0 ? 0 : (incomeSum / sum) * 100;
  const expensePct = sum === 0 ? 0 : (expenseSum / sum) * 100;
  const incomeSweep = (incomePct / 100) * Math.PI * 2;
  const expenseSweep = (expensePct / 100) * Math.PI * 2;
  const incomeMid = -Math.PI / 2 + incomeSweep / 2;
  const expenseMid = -Math.PI / 2 + incomeSweep + expenseSweep / 2;
  const splitAngle = -Math.PI / 2 + incomeSweep;
  const showKindBorder = Boolean(kindSummary && incomeSum > 0 && expenseSum > 0);

  function pick(x: number, y: number) {
    const dx = x - cx;
    const dy = y - cy;
    if (Math.hypot(dx, dy) > radius + 6) {
      onHover?.(null);
      return;
    }
    let a = Math.atan2(dy, dx);
    if (a < -Math.PI / 2) a += Math.PI * 2;
    const hit = paths.find((slice) => a >= slice.start && a < slice.end) ?? paths[paths.length - 1];
    if (!hit) {
      onHover?.(null);
      return;
    }
    onHover?.({ kind: hit.kind, name: hit.name, pct: hit.pct, amount: hit.value });
  }

  return (
    <View
      style={styles.pieChart}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        moved.current = false;
        if (!onHover) return;
        onScrubbing?.(true);
        pick(event.nativeEvent.locationX, event.nativeEvent.locationY);
      }}
      onResponderMove={(event) => {
        if (!onHover) return;
        moved.current = true;
        pick(event.nativeEvent.locationX, event.nativeEvent.locationY);
      }}
      onResponderRelease={() => {
        onScrubbing?.(false);
        onHover?.(null);
        if (!moved.current) onTap?.();
      }}
      onResponderTerminate={() => {
        onScrubbing?.(false);
        onHover?.(null);
      }}
    >
      <Svg width={size} height={size}>
        {paths.length === 0 ? (
          <Circle cx={cx} cy={cy} r={radius} stroke={MUTED} strokeWidth="1.5" fill="none" />
        ) : (
          paths.map((slice) =>
            slice.full ? (
              <Circle key={slice.key} cx={cx} cy={cy} r={radius} fill={slice.color} />
            ) : (
              <Path key={slice.key} d={slice.d} fill={slice.color} />
            ),
          )
        )}
        {showKindBorder ? (
          <>
            <Line
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(-Math.PI / 2) * radius}
              y2={cy + Math.sin(-Math.PI / 2) * radius}
              stroke="#ffffff"
              strokeWidth="5"
            />
            <Line
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(splitAngle) * radius}
              y2={cy + Math.sin(splitAngle) * radius}
              stroke="#ffffff"
              strokeWidth="5"
            />
          </>
        ) : null}
        {kindSummary
          ? (
              [
                { key: "income", pct: incomePct, mid: incomeMid },
                { key: "expense", pct: expensePct, mid: expenseMid },
              ] as const
            )
              .filter((item) => item.pct >= 8)
              .map((item) => (
                <SvgText
                  key={item.key}
                  x={cx + Math.cos(item.mid) * radius * 0.55}
                  y={cy + Math.sin(item.mid) * radius * 0.55 + 4}
                  fill="#ffffff"
                  fontSize="13"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {`${Math.round(item.pct)}%`}
                </SvgText>
              ))
          : null}
        {percents
          ? paths
              .filter((slice) => slice.pct >= 8)
              .map((slice) => (
                <SvgText
                  key={`p-${slice.key}`}
                  x={slice.full ? cx : slice.labelX}
                  y={(slice.full ? cy : slice.labelY) + 3}
                  fill="#ffffff"
                  fontSize={size < 100 ? 8 : 10}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {`${Math.round(slice.pct)}%`}
                </SvgText>
              ))
          : null}
      </Svg>
    </View>
  );
}

function pieSlice(cx: number, cy: number, radius: number, start: number, end: number) {
  const x0 = cx + radius * Math.cos(start);
  const y0 = cy + radius * Math.sin(start);
  const x1 = cx + radius * Math.cos(end);
  const y1 = cy + radius * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`;
}

function ChartIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PieIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Row({
  label,
  value,
  green,
  underline,
  last,
}: {
  label: string;
  value: string;
  green?: boolean;
  underline?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowGap]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          green && styles.green,
          underline && styles.underline,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function PriceChart({
  prices,
  current,
  hover,
  onHover,
  onScrubbing,
}: {
  prices: PricePoint[];
  current: number;
  hover: PricePoint | null;
  onHover: (point: PricePoint | null) => void;
  onScrubbing: (active: boolean) => void;
}) {
  const [boxWidth, setBoxWidth] = useState(360);
  const width = 360;
  const height = 250;
  const left = 0;
  const right = 62;
  const top = 22;
  const bottom = 10;
  const values = prices.map((point) => point.value);
  const { min, max, ticks } = chartScale(values);
  const innerW = width - left - right;
  const innerH = height - top - bottom;

  const yFor = (value: number) =>
    top + ((max - value) / (max - min)) * innerH;

  const points = prices.map((point, index) => ({
    ...point,
    x: left + (index / Math.max(prices.length - 1, 1)) * innerW,
    y: yFor(point.value),
  }));
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area =
    points.length > 0
      ? `${line} L ${left + innerW} ${top + innerH} L ${left} ${top + innerH} Z`
      : "";

  const currentY = yFor(current);
  const hoverPoint = hover
    ? points.find((point) => point.date === hover.date) ?? null
    : null;

  function pick(locationX: number) {
    const x = (locationX / boxWidth) * width;
    let nearest = 0;
    let best = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    onHover(prices[nearest] ?? null);
  }

  return (
    <View
      style={styles.chartWrap}
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        onScrubbing(true);
        pick(event.nativeEvent.locationX);
      }}
      onResponderMove={(event) => pick(event.nativeEvent.locationX)}
      onResponderRelease={() => {
        onScrubbing(false);
        onHover(null);
      }}
      onResponderTerminate={() => {
        onScrubbing(false);
        onHover(null);
      }}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BLUE} stopOpacity="0.22" />
            <Stop offset="1" stopColor={BLUE} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {ticks.map((tick) => (
          <SvgText
            key={tick}
            x={width - 4}
            y={yFor(tick) + 4}
            fill={MUTED}
            fontSize="10"
            textAnchor="end"
          >
            {tick.toFixed(2)}
          </SvgText>
        ))}
        {area ? <Path d={area} fill="url(#cashFill)" /> : null}
        {line ? (
          <Path
            d={line}
            fill="none"
            stroke={BLUE}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        <Line
          x1={left}
          x2={width - 25}
          y1={currentY}
          y2={currentY}
          stroke={BLUE}
          strokeWidth="1"
        />
        <Pill x={width - 50} y={currentY - 10} label={current.toFixed(2)} fill={BLUE} />
        {hoverPoint ? (
          <>
            <Line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={16}
              y2={top + innerH}
              stroke={INK}
              strokeWidth="1"
            />
            <Circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill={BLUE} />
            <SvgText
              x={Math.min(Math.max(hoverPoint.x, 36), width - 70)}
              y={12}
              fill={INK}
              fontSize="10"
              textAnchor="middle"
            >
              {formatChartDate(hoverPoint.date)}
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}

function Pill({
  x,
  y,
  label,
  fill,
}: {
  x: number;
  y: number;
  label: string;
  fill: string;
}) {
  return (
    <>
      <Rect x={x} y={y} width={50} height={20} rx={10} fill={fill} />
      <SvgText
        x={x + 25}
        y={y + 14}
        fill="#ffffff"
        fontSize="10"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  content: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#C8102E",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoPlain: { backgroundColor: "#ffffff" },
  logoMark: { color: "#ffffff", fontSize: 26, fontWeight: "700" },
  logoImage: { width: 44, height: 44, borderRadius: 10 },
  headerCopy: { flex: 1, height: 44, justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { color: MUTED, fontSize: 11, letterSpacing: 0.2 },
  metaDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#D1D5DB" },
  name: { color: INK, fontSize: 14, fontWeight: "700", marginTop: 1, lineHeight: 18 },
  price: { color: INK, fontSize: 52, fontWeight: "400", marginTop: 18, letterSpacing: -1.4, lineHeight: 56 },
  euro: { fontSize: 34, fontWeight: "400" },
  change: { color: GREEN, fontSize: 16, marginTop: 0 },
  chartWrap: { marginTop: 10, marginRight: -8 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  ranges: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2 },
  rangesCompact: { flex: 0 },
  viewToggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewBtn: { padding: 6, borderRadius: 10 },
  viewBtnOn: { backgroundColor: "#EFEFEF" },
  pieBoard: { marginTop: 4, minHeight: 250 },
  pieSplit: { position: "relative" },
  pieTotalHit: {
    position: "absolute",
    top: 22,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
  },
  pieSplitRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 62,
    columnGap: 0,
  },
  pieHalf: { alignItems: "center", marginHorizontal: -6 },
  pieTotalStage: {
    minHeight: 268,
    alignItems: "center",
    justifyContent: "center",
  },
  pieSideLowLeft: {
    position: "absolute",
    left: 36,
    bottom: 10,
    alignItems: "center",
  },
  pieSideLowRight: {
    position: "absolute",
    right: 36,
    bottom: 10,
    alignItems: "center",
  },
  pieChart: { alignItems: "center" },
  pieCaption: { color: MUTED, fontSize: 11, marginTop: 0 },
  pieHintRow: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    minHeight: 52,
  },
  pieHintBox: {
    alignItems: "center",
  },
  pieHintRanges: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  pieHintToggle: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  pieHintChip: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pieHintIncome: { backgroundColor: "#BBF7D0" },
  pieHintExpense: { backgroundColor: "#FECACA" },
  pieHintChipText: { color: INK, fontSize: 13, fontWeight: "600" },
  pieHintAmount: { color: INK, fontSize: 20, fontWeight: "500", marginTop: 4 },
  range: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  rangeOn: { backgroundColor: "#EFEFEF" },
  rangeText: { color: MUTED, fontSize: 13, fontWeight: "600" },
  rangeTextOn: { color: INK },
  section: { color: INK, fontSize: 17, fontWeight: "400", marginTop: 28 },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowGap: { marginBottom: 8 },
  rowLabel: { color: MUTED, fontSize: 12, fontWeight: "600", letterSpacing: 0.4 },
  rowValue: { color: INK, fontSize: 16, fontWeight: "400" },
  green: { color: GREEN },
  underline: { textDecorationLine: "underline" },
});
