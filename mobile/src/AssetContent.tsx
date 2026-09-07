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
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { AssetHistory } from "./AssetHistory";
import {
  ASSET,
  assetStats,
  chartScale,
  filterSeries,
  formatChartDate,
  formatCompact,
  formatEuro,
  rangePeriodLabel,
  seriesChange,
  type AssetEntry,
  type PricePoint,
  type RangeKey,
} from "./assetData";
import { loadAssetHistory, saveAssetHistory } from "./db";
import { loadNetWorthTotals } from "./HomeNetWorth";
import type { ListedStock } from "./stockList";
import { ChartAxis } from "./ChartAxis";
import { ChartPill } from "./ChartPill";
import { imageSource } from "./imageSource";
import { MoneyAmount } from "./MoneyAmount";
import { PageLoading } from "./PageLoading";
import { ScreenBack } from "./ScreenBack";
import { svgUiFont } from "./svgFont";
import { useTheme } from "./theme";
import { useDragTrack } from "./useRevealSwipe";

const BLUE = "#3B82F6";
const GREEN = "#16A34A";
const RED = "#DC2626";
const INK = "#111111";
const MUTED = "#9CA3AF";
const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];

export function AssetContent({ stock }: { stock?: ListedStock }) {
  const { colors: c } = useTheme();
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hover, setHover] = useState<PricePoint | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const historyOffset = useRef({ y: 0, height: 0 });
  const revealAfterLayout = useRef(false);
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<AssetEntry[]>([]);
  const [restNet, setRestNet] = useState(0);
  const stats = useMemo(() => assetStats(entries), [entries]);
  const prices = useMemo(() => filterSeries(stats.prices, range), [stats.prices, range]);
  const change = useMemo(() => {
    const live = prices[0]?.value === 0 ? prices.slice(1) : prices;
    return seriesChange(live.length ? live : prices);
  }, [prices]);
  const shownPrice = hover?.value ?? stats.value;
  const up = change.amount >= 0;
  const netTotal = restNet + stats.value;
  const share = netTotal <= 0 ? 0 : (stats.value / netTotal) * 100;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!stock?.id) {
      setEntries([]);
      setRestNet(0);
      setReady(true);
      return;
    }
    Promise.all([loadAssetHistory(stock.id), loadNetWorthTotals()])
      .then(([rows, totals]) => {
        if (cancelled) return;
        const mine = assetStats(rows).value;
        setEntries(rows);
        setRestNet(totals.cash + totals.trading + totals.stocks - mine);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setRestNet(0);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [stock?.id]);

  function persist(next: AssetEntry[]) {
    setEntries(next);
    if (stock?.id) saveAssetHistory(stock.id, next);
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

  if (!ready) {
    return <PageLoading />;
  }

  return (
    <View style={{ flex: 1, position: "relative" }}>
      <ScrollView
        ref={scrollRef}
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + keyboardHeight }]}
        scrollEnabled={!scrubbing}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.headerRow}>
          <View style={[styles.logo, stock?.color ? { backgroundColor: stock.color } : null]} pointerEvents="none">
            {imageSource(stock?.image) ? (
              <Image
                source={imageSource(stock?.image)}
                style={styles.logoImage}
                fadeDuration={0}
                pointerEvents="none"
              />
            ) : (
              <Text style={styles.logoMark}>
                {stock?.letter ?? stock?.ticker?.trim()?.[0] ?? "A"}
              </Text>
            )}
          </View>
          <View style={styles.headerCopy}>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: c.muted }]}>
                {stock?.ticker ?? ASSET.ticker}
              </Text>
              <View style={[styles.metaDot, { backgroundColor: c.line }]} />
            </View>
            <Text style={[styles.name, { color: c.ink }]}>{stock?.name ?? "Asset"}</Text>
          </View>
        </View>

        <MoneyAmount
          value={shownPrice}
          color={c.ink}
          style={styles.price}
          euroStyle={styles.euro}
        />
        <Text style={[styles.change, { color: up ? GREEN : RED }]}>
          {up ? "↗" : "↘"} {formatCompact(Math.abs(change.amount))} ({Math.abs(change.pct).toFixed(2)}%){" "}
          {rangePeriodLabel(range)}
        </Text>

        <PriceChart
          prices={prices}
          current={stats.value}
          hover={hover}
          onHover={setHover}
          onScrubbing={setScrubbing}
        />

        <View style={styles.controls}>
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
                <Text style={[styles.rangeText, { color: c.muted }, range === item && { color: c.ink }]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[styles.section, { color: c.ink }]}>Your investment</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
          <Row label="VALUE" value={formatEuro(stats.value)} />
          <Row label="NET WORTH SHARE" value={`${share.toFixed(2)}%`} last />
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
          <AssetHistory
            entries={entries}
            onChange={persist}
            onSwipe={setScrubbing}
            onAdded={() => {
              revealAfterLayout.current = true;
            }}
          />
        </View>
      </ScrollView>
      <ScreenBack />
    </View>
  );
}

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.row, !last && styles.rowGap]}>
      <Text style={[styles.rowLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: c.ink }]}>{value}</Text>
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
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area =
    points.length > 0
      ? `${line} L ${left + innerW} ${top + innerH} L ${left} ${top + innerH} Z`
      : "";

  const currentY = yFor(current);
  const hoverPoint = hover
    ? points.find((point) => point.date === hover.date && point.value === hover.value) ??
      points.find((point) => point.date === hover.date) ??
      null
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
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="assetFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BLUE} stopOpacity="0.22" />
            <Stop offset="1" stopColor={BLUE} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {area ? <Path d={area} fill="url(#assetFill)" /> : null}
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
        <ChartPill x={width - 50} y={currentY - 10} label={formatCompact(current)} fill={BLUE} />
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 88, paddingBottom: 40 },
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
  chartWrap: { marginTop: 10, marginRight: -8, position: "relative" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  ranges: { flexDirection: "row", alignItems: "center", gap: 2 },
  range: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  rangeText: { color: MUTED, fontSize: 13, fontWeight: "600" },
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
});
