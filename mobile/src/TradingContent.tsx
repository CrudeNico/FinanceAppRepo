import { useEffect, useMemo, useRef, useState } from "react";
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
import { TradingCalendar } from "./TradingCalendar";
import { TradingHistory } from "./TradingHistory";
import {
  ASSET,
  chartScale,
  filterSeries,
  formatChartDate,
  formatEuro,
  rangePeriodLabel,
  seriesChange,
  tradingStats,
  type PricePoint,
  type RangeKey,
} from "./assetData";
import { loadTradingDays, loadTradingMonths, saveTradingDays, saveTradingMonths } from "./db";
import type { DayEntry, TradeRow } from "./models";
import type { ListedStock } from "./stockList";

const BLUE = "#3B82F6";
const GREEN = "#16A34A";
const RED = "#DC2626";
const INK = "#111111";
const MUTED = "#9CA3AF";
const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];

export function TradingContent({ stock }: { stock?: ListedStock }) {
  const [view, setView] = useState<"graph" | "calendar">("graph");
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hover, setHover] = useState<PricePoint | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const historyOffset = useRef({ y: 0, height: 0 });
  const revealAfterLayout = useRef(false);
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<TradeRow[]>([]);
  const [days, setDays] = useState<Record<string, DayEntry>>({});
  const [monthTotal, setMonthTotal] = useState(0);
  const stats = useMemo(() => tradingStats(entries), [entries]);
  const prices = useMemo(() => filterSeries(stats.prices, range), [stats.prices, range]);
  const change = useMemo(() => seriesChange(prices), [prices]);
  const shownPrice = hover?.value ?? stats.value;
  const up = change.amount >= 0;
  const monthPct = stats.value === 0 ? 0 : (monthTotal / stats.value) * 100;
  const monthUp = monthTotal >= 0;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!stock?.id) {
      setEntries([]);
      setDays({});
      setReady(true);
      return;
    }
    Promise.all([loadTradingMonths(stock.id), loadTradingDays(stock.id)])
      .then(([months, calendar]) => {
        if (cancelled) return;
        setEntries(months);
        setDays(calendar);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setDays({});
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [stock?.id]);

  function persistMonths(next: TradeRow[]) {
    setEntries(next);
    if (stock?.id) saveTradingMonths(stock.id, next);
  }

  function persistDays(next: Record<string, DayEntry>) {
    setDays(next);
    if (stock?.id) saveTradingDays(stock.id, next);
  }

  const viewToggle = (
    <View style={styles.viewToggle}>
      <Pressable
        onPress={() => {
          setHover(null);
          setView("graph");
        }}
        hitSlop={8}
        style={[styles.viewBtn, view === "graph" && styles.viewBtnOn]}
      >
        <ChartIcon />
      </Pressable>
      <Pressable
        onPress={() => {
          setHover(null);
          setScrubbing(false);
          setView("calendar");
        }}
        hitSlop={8}
        style={[styles.viewBtn, view === "calendar" && styles.viewBtnOn]}
      >
        <CalendarIcon />
      </Pressable>
    </View>
  );

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

  if (!ready) {
    return <View style={styles.screen} />;
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + keyboardHeight }]}
      scrollEnabled={!scrubbing}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={styles.headerRow}>
        <View style={[styles.logo, stock?.color ? { backgroundColor: stock.color } : null]}>
          {stock?.image ? (
            <Image source={{ uri: stock.image }} style={styles.logoImage} />
          ) : (
            <Text style={styles.logoMark}>
              {stock?.letter ?? stock?.ticker?.trim()?.[0] ?? "V"}
            </Text>
          )}
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {stock?.ticker ?? ASSET.ticker} · {ASSET.exchange}
            </Text>
            <View style={styles.metaDot} />
          </View>
          <Text style={styles.name}>{stock?.name ?? ASSET.name}</Text>
        </View>
      </View>

      <Text style={styles.price}>
        <Text style={styles.euro}>€</Text>
        {view === "calendar" ? Math.abs(monthTotal).toFixed(2) : shownPrice.toFixed(2)}
      </Text>
      {view === "calendar" ? (
        <Text style={[styles.change, { color: monthUp ? GREEN : RED }]}>
          {monthUp ? "↗" : "↘"} {Math.abs(monthPct).toFixed(2)}%
        </Text>
      ) : (
        <Text style={[styles.change, { color: up ? GREEN : RED }]}>
          {up ? "↗" : "↘"} {Math.abs(change.amount).toFixed(2)} ({Math.abs(change.pct).toFixed(2)}%){" "}
          {rangePeriodLabel(range)}
        </Text>
      )}

      {view === "graph" ? (
        <PriceChart
          prices={prices}
          current={stats.value}
          hover={hover}
          onHover={setHover}
          onScrubbing={setScrubbing}
        />
      ) : (
        <TradingCalendar
          toolbar={viewToggle}
          onMonthTotal={setMonthTotal}
          days={days}
          onDaysChange={persistDays}
        />
      )}

      {view === "graph" ? (
      <View style={styles.controls}>
        <View style={styles.ranges}>
          {RANGES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setHover(null);
                    setRange(item);
                  }}
                  style={[styles.range, range === item && styles.rangeOn]}
                >
                  <Text style={[styles.rangeText, range === item && styles.rangeTextOn]}>
                    {item}
                  </Text>
                </Pressable>
          ))}
        </View>
        {viewToggle}
      </View>
      ) : null}

      <Text style={styles.section}>Your investment</Text>
      <View style={styles.card}>
        <Row label="VALUE" value={formatEuro(stats.value)} />
        <Row
          label="RETURN"
          value={`${stats.returnAmount >= 0 ? "+" : ""}${formatEuro(stats.returnAmount)} (${stats.returnPct.toFixed(2)}%)`}
          green={stats.returnAmount >= 0}
          last
        />
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
        <TradingHistory
          entries={entries}
          onChange={persistMonths}
          onAdded={() => {
            revealAfterLayout.current = true;
          }}
        />
      </View>
    </ScrollView>
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
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
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
        {area ? <Path d={area} fill="url(#fill)" /> : null}
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

function CalendarIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
  },
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
  viewToggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewBtn: { padding: 6, borderRadius: 10 },
  viewBtnOn: { backgroundColor: "#EFEFEF" },
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
