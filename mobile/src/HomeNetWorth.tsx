import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  cashflowStats,
  chartScale,
  filterSeries,
  formatChartDate,
  formatCompact,
  formatEuro,
  mergeValueSeries,
  stockStats,
  stockValuePoints,
  tradingStats,
  type PricePoint,
  type RangeKey,
} from "./assetData";
import { listCards, loadCashflowEntries, loadStockHistory, loadTradingMonths } from "./db";
import { ChartAxis } from "./ChartAxis";
import { ChartPill } from "./ChartPill";
import { imageSource } from "./imageSource";
import { svgUiFont } from "./svgFont";
import { useTheme } from "./theme";
import { useDragTrack } from "./useRevealSwipe";

const BLUE = "#1D4ED8";
const INK = "#111111";
const MUTED = "#9CA3AF";
const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];
export function HomeNetWorth({
  onScrubbing,
  onProfile,
}: {
  onScrubbing?: (active: boolean) => void;
  onProfile?: () => void;
}) {
  const { colors: c, avatar } = useTheme();
  const [range, setRange] = useState<RangeKey>("1Y");
  const [view, setView] = useState<"graph" | "pie">("graph");
  const [hover, setHover] = useState<PricePoint | null>(null);
  const [pieHint, setPieHint] = useState<{ name: string; pct: number; value: number } | null>(
    null,
  );
  const [scrubbing, setScrubbing] = useState(false);
  const [cash, setCash] = useState(0);
  const [trading, setTrading] = useState(0);
  const [stocks, setStocks] = useState(0);
  const [series, setSeries] = useState<PricePoint[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadTotals()
        .then((next) => {
          if (cancelled) return;
          setCash(next.cash);
          setTrading(next.trading);
          setStocks(next.stocks);
          setSeries(next.series);
        })
        .catch(() => {
          if (cancelled) return;
          setCash(0);
          setTrading(0);
          setStocks(0);
          setSeries([]);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const total = cash + trading + stocks;
  const prices = useMemo(() => filterSeries(series, range), [series, range]);
  const shown = hover?.value ?? total;
  const pie = [
    { name: "Cashflow", color: "#3B82F6", value: Math.max(cash, 0) },
    { name: "Trading", color: "#16A34A", value: Math.max(trading, 0) },
    { name: "Stocks", color: c.ink, value: Math.max(stocks, 0) },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable onPress={onProfile}>
          {imageSource(avatar) ? (
            <Image source={imageSource(avatar)} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: c.lift, borderColor: c.line }]} />
          )}
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>Net Worth</Text>
      </View>
      <Text style={[styles.price, { color: c.ink }]}>
        <Text style={styles.euro}>€</Text>
        {shown.toFixed(2).slice(0, -3)}
        <Text style={styles.euro}>{shown.toFixed(2).slice(-3)}</Text>
      </Text>
      {view === "graph" ? (
        <NetChart
          prices={prices}
          current={total}
          hover={hover}
          onHover={setHover}
          onScrubbing={(active) => {
            setScrubbing(active);
            onScrubbing?.(active);
          }}
        />
      ) : (
        <NetPie
          slices={pie}
          onHold={setPieHint}
          onScrubbing={(active) => {
            setScrubbing(active);
            onScrubbing?.(active);
          }}
        />
      )}
      <View style={view === "pie" ? styles.pieHintRow : styles.controls}>
        {view === "graph" ? (
          <View style={styles.ranges}>
            {RANGES.map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setHover(null);
                  setRange(item);
                }}
                style={[styles.range, range === item && { backgroundColor: c.lift }]}
              >
                <Text style={[styles.rangeText, range === item && { color: c.ink }]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : pieHint ? (
          <View style={styles.pieHintBox}>
            <View style={[styles.pieHintChip, chipStyle(pieHint.name)]}>
              <Text style={[styles.pieHintChipText, { color: c.ink }]}>
                {pieHint.name} · {Math.round(pieHint.pct)}%
              </Text>
            </View>
            <Text style={[styles.pieHintAmount, { color: c.ink }]}>{formatEuro(pieHint.value)}</Text>
          </View>
        ) : null}
        <View style={view === "pie" ? styles.pieHintToggle : styles.viewToggle}>
          <Pressable
            onPress={() => {
              setHover(null);
              setPieHint(null);
              setView("graph");
            }}
            hitSlop={8}
            style={[styles.viewBtn, view === "graph" && { backgroundColor: c.lift }]}
          >
            <ChartIcon />
          </Pressable>
          <Pressable
            onPress={() => {
              setHover(null);
              setPieHint(null);
              setScrubbing(false);
              setView("pie");
            }}
            hitSlop={8}
            style={[styles.viewBtn, view === "pie" && { backgroundColor: c.lift }]}
          >
            <PieIcon />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

async function loadTotals() {
  const [cashCards, tradeCards, stockCards] = await Promise.all([
    listCards("cashflow"),
    listCards("trading"),
    listCards("stock"),
  ]);
  const cashSeries: PricePoint[][] = [];
  const tradeSeries: PricePoint[][] = [];
  const stockSeries: PricePoint[][] = [];
  let cash = 0;
  let trading = 0;
  let stocks = 0;

  await Promise.all(
    cashCards
      .filter((card) => card.saved)
      .map(async (card) => {
        const stats = cashflowStats(await loadCashflowEntries(card.id));
        cash += stats.value;
        cashSeries.push(stats.prices);
      }),
  );
  await Promise.all(
    tradeCards
      .filter((card) => card.saved)
      .map(async (card) => {
        const stats = tradingStats(await loadTradingMonths(card.id));
        trading += stats.value;
        tradeSeries.push(stats.prices);
      }),
  );
  await Promise.all(
    stockCards
      .filter((card) => card.saved)
      .map(async (card) => {
        const rows = await loadStockHistory(card.id);
        stocks += stockStats(rows).value;
        stockSeries.push(stockValuePoints(rows));
      }),
  );

  return {
    cash,
    trading,
    stocks,
    series: mergeValueSeries([
      mergeValueSeries(cashSeries),
      mergeValueSeries(tradeSeries),
      mergeValueSeries(stockSeries),
    ]),
  };
}

function smoothLine(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function NetChart({
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
  const { colors: c } = useTheme();
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
  const yFor = (value: number) => top + ((max - value) / (max - min)) * innerH;
  const points = prices.map((point, index) => ({
    ...point,
    x: left + (index / Math.max(prices.length - 1, 1)) * innerW,
    y: yFor(point.value),
  }));
  const line = smoothLine(points);
  const last = points[points.length - 1];
  const area = last
    ? `${line} L ${last.x} ${top + innerH} L ${points[0].x} ${top + innerH} Z`
    : "";
  const hoverPoint = hover ? points.find((point) => point.date === hover.date) ?? null : null;

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

  const drag = useDragTrack(
    (x) => pick(x),
    (active) => {
      onScrubbing(active);
      if (!active) onHover(null);
    },
  );

  return (
    <View
      style={styles.chartWrap}
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      {...drag}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="homeFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BLUE} stopOpacity="0.22" />
            <Stop offset="1" stopColor={BLUE} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {area ? <Path d={area} fill="url(#homeFill)" /> : null}
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
        {last ? <Circle cx={last.x} cy={last.y} r={3.5} fill={BLUE} /> : null}
        {prices.length > 0 ? (
          <>
            <Line
              x1={left}
              x2={width - 25}
              y1={yFor(current)}
              y2={yFor(current)}
              stroke={BLUE}
              strokeWidth="1"
            />
            <ChartPill
              x={width - 50}
              y={yFor(current) - 10}
              label={formatCompact(current)}
              fill={BLUE}
            />
          </>
        ) : null}
        {hoverPoint ? (
          <>
            <Line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={16}
              y2={top + innerH}
              stroke={c.ink}
              strokeWidth="1"
            />
            <Circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill={BLUE} />
            <SvgText
              x={Math.min(Math.max(hoverPoint.x, 36), width - 70)}
              y={12}
              fill={c.ink}
              fontSize="10"
              fontFamily={svgUiFont}
              fontStyle="normal"
              textAnchor="middle"
            >
              {formatChartDate(hoverPoint.date)}
            </SvgText>
          </>
        ) : null}
      </Svg>
      <ChartAxis ticks={ticks} yFor={yFor} color={c.muted} />
    </View>
  );
}

function chipStyle(name: string) {
  if (name === "Trading") return styles.pieHintTrading;
  if (name === "Stocks") return styles.pieHintStocks;
  return styles.pieHintCash;
}

function NetPie({
  slices,
  onHold,
  onScrubbing,
}: {
  slices: { name: string; color: string; value: number }[];
  onHold: (slice: { name: string; pct: number; value: number } | null) => void;
  onScrubbing?: (active: boolean) => void;
}) {
  const { colors: c } = useTheme();
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 84;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let angle = -Math.PI / 2;
  const paths = slices.map((slice, index) => {
    const sweep = total === 0 ? 0 : (slice.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = start + sweep / 2;
    const pct = total === 0 ? 0 : (slice.value / total) * 100;
    return {
      ...slice,
      key: `${slice.name}-${index}`,
      d: piePath(cx, cy, radius, start, end),
      full: sweep >= Math.PI * 2 - 0.001,
      start,
      end,
      pct,
      labelX: cx + Math.cos(mid) * radius * 0.55,
      labelY: cy + Math.sin(mid) * radius * 0.55,
    };
  });

  function pick(x: number, y: number) {
    const dx = x - cx;
    const dy = y - cy;
    if (Math.hypot(dx, dy) > radius + 6) {
      onHold(null);
      return;
    }
    let a = Math.atan2(dy, dx);
    if (a < -Math.PI / 2) a += Math.PI * 2;
    const hit = paths.find((slice) => a >= slice.start && a < slice.end && slice.pct > 0);
    onHold(hit ? { name: hit.name, pct: hit.pct, value: hit.value } : null);
  }

  const drag = useDragTrack(
    (x, y) => pick(x, y),
    (active) => {
      onScrubbing?.(active);
      if (!active) onHold(null);
    },
  );

  return (
    <View style={styles.pieWrap}>
      <View {...drag}>
        <Svg width={size} height={size}>
          {total === 0 ? (
            <Circle cx={cx} cy={cy} r={radius} stroke={c.muted} strokeWidth="1.5" fill="none" />
          ) : (
            paths.map((slice) =>
              slice.full ? (
                <Circle key={slice.key} cx={cx} cy={cy} r={radius} fill={slice.color} />
              ) : slice.pct <= 0 ? null : (
                <Path key={slice.key} d={slice.d} fill={slice.color} />
              ),
            )
          )}
          {paths
            .filter((slice) => slice.pct >= 8)
            .map((slice) => (
              <SvgText
                key={`p-${slice.key}`}
                x={slice.full ? cx : slice.labelX}
                y={(slice.full ? cy : slice.labelY) + 4}
                fill="#ffffff"
                fontSize="13"
                fontWeight="700"
                fontFamily={svgUiFont}
                fontStyle="normal"
                textAnchor="middle"
              >
                {`${Math.round(slice.pct)}%`}
              </SvgText>
            ))}
        </Svg>
      </View>
    </View>
  );
}

function piePath(cx: number, cy: number, radius: number, start: number, end: number) {
  const x0 = cx + radius * Math.cos(start);
  const y0 = cy + radius * Math.sin(start);
  const x1 = cx + radius * Math.cos(end);
  const y1 = cy + radius * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`;
}

function ChartIcon() {
  const { colors: c } = useTheme();
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        stroke={c.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PieIcon() {
  const { colors: c } = useTheme();
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
        stroke={c.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"
        stroke={c.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  title: { fontSize: 28, fontWeight: "600" },
  price: {
    fontSize: 52,
    fontWeight: "400",
    letterSpacing: -1.4,
    lineHeight: 56,
  },
  euro: { fontSize: 34, fontWeight: "400" },
  chartWrap: { marginTop: 10, marginRight: -8, position: "relative" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  ranges: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2 },
  viewToggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewBtn: { padding: 6, borderRadius: 10 },
  range: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  rangeText: { color: MUTED, fontSize: 13, fontWeight: "600" },
  pieWrap: { marginTop: 10, alignItems: "center", minHeight: 220 },
  pieHintRow: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 52,
  },
  pieHintToggle: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pieHintBox: { alignItems: "center" },
  pieHintChip: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pieHintCash: { backgroundColor: "#BFDBFE" },
  pieHintTrading: { backgroundColor: "#BBF7D0" },
  pieHintStocks: { backgroundColor: "#E5E7EB" },
  pieHintChipText: {
    fontSize: 13,
    fontWeight: "600",
    fontStyle: "normal",
    fontFamily: "System",
  },
  pieHintAmount: { fontSize: 20, fontWeight: "500", marginTop: 4 },
});
