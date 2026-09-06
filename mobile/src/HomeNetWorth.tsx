import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
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
import {
  cashflowStats,
  chartScale,
  filterSeries,
  formatChartDate,
  formatEuro,
  mergeValueSeries,
  stockStats,
  stockValuePoints,
  tradingStats,
  type PricePoint,
  type RangeKey,
} from "./assetData";
import { listCards, loadCashflowEntries, loadStockHistory, loadTradingMonths } from "./db";

const BLUE = "#3B82F6";
const INK = "#111111";
const MUTED = "#9CA3AF";
const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];
export function HomeNetWorth({
  onScrubbing,
}: {
  onScrubbing?: (active: boolean) => void;
}) {
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
    { name: "Stocks", color: "#111111", value: Math.max(stocks, 0) },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.price}>
        <Text style={styles.euro}>€</Text>
        {shown.toFixed(2)}
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
                style={[styles.range, range === item && styles.rangeOn]}
              >
                <Text style={[styles.rangeText, range === item && styles.rangeTextOn]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : pieHint ? (
          <View style={styles.pieHintBox}>
            <View style={[styles.pieHintChip, chipStyle(pieHint.name)]}>
              <Text style={styles.pieHintChipText}>
                {pieHint.name} · {Math.round(pieHint.pct)}%
              </Text>
            </View>
            <Text style={styles.pieHintAmount}>{formatEuro(pieHint.value)}</Text>
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
            style={[styles.viewBtn, view === "graph" && styles.viewBtnOn]}
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
            style={[styles.viewBtn, view === "pie" && styles.viewBtnOn]}
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
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area =
    points.length > 0
      ? `${line} L ${left + innerW} ${top + innerH} L ${left} ${top + innerH} Z`
      : "";
  const currentY = yFor(current);
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
          <LinearGradient id="homeFill" x1="0" y1="0" x2="0" y2="1">
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
    const pct = total === 0 ? 0 : (slice.value / total) * 100;
    return {
      ...slice,
      key: `${slice.name}-${index}`,
      d: piePath(cx, cy, radius, start, end),
      full: sweep >= Math.PI * 2 - 0.001,
      start,
      end,
      pct,
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

  return (
    <View style={styles.pieWrap}>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          onScrubbing?.(true);
          pick(event.nativeEvent.locationX, event.nativeEvent.locationY);
        }}
        onResponderMove={(event) => {
          pick(event.nativeEvent.locationX, event.nativeEvent.locationY);
        }}
        onResponderRelease={() => {
          onScrubbing?.(false);
          onHold(null);
        }}
        onResponderTerminate={() => {
          onScrubbing?.(false);
          onHold(null);
        }}
      >
        <Svg width={size} height={size}>
          {total === 0 ? (
            <Circle cx={cx} cy={cy} r={radius} stroke={MUTED} strokeWidth="1.5" fill="none" />
          ) : (
            paths.map((slice) =>
              slice.full ? (
                <Circle key={slice.key} cx={cx} cy={cy} r={radius} fill={slice.color} />
              ) : slice.pct <= 0 ? null : (
                <Path key={slice.key} d={slice.d} fill={slice.color} />
              ),
            )
          )}
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

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  price: {
    color: INK,
    fontSize: 52,
    fontWeight: "400",
    letterSpacing: -1.4,
    lineHeight: 56,
  },
  euro: { fontSize: 34, fontWeight: "400" },
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
  pieHintChipText: { color: INK, fontSize: 13, fontWeight: "600" },
  pieHintAmount: { color: INK, fontSize: 20, fontWeight: "500", marginTop: 4 },
});
