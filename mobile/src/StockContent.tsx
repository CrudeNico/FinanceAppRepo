import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
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
import { HistoryCard } from "./HistoryCard";
import {
  ASSET,
  formatChartDate,
  formatEuro,
  formatNumber,
  seriesFor,
  type PricePoint,
  type RangeKey,
} from "./assetData";

const BLUE = "#3B82F6";
const GREEN = "#16A34A";
const INK = "#111111";
const MUTED = "#9CA3AF";
const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];

export function StockContent() {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hover, setHover] = useState<PricePoint | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const historyOffset = useRef({ y: 0, height: 0 });
  const revealAfterLayout = useRef(false);
  const prices = useMemo(() => seriesFor(range), [range]);
  const shownPrice = hover?.value ?? ASSET.price;

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
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + keyboardHeight }]}
      scrollEnabled={!scrubbing}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={styles.headerRow}>
        <View style={styles.logo}>
          <Text style={styles.logoMark}>V</Text>
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {ASSET.ticker} · {ASSET.exchange}
            </Text>
            <View style={styles.metaDot} />
          </View>
          <Text style={styles.name}>{ASSET.name}</Text>
        </View>
      </View>

      <Text style={styles.price}>
        <Text style={styles.euro}>€</Text>
        {shownPrice.toFixed(2)}
      </Text>
      <Text style={styles.change}>
        ↗ {ASSET.change.toFixed(2)} ({ASSET.changePct.toFixed(2)}%) last year
      </Text>

      <PriceChart
        prices={prices}
        current={ASSET.price}
        average={ASSET.averagePrice}
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
              style={[styles.range, range === item && styles.rangeOn]}
            >
              <Text style={[styles.rangeText, range === item && styles.rangeTextOn]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.section}>Your investment</Text>
      <View style={styles.card}>
        <Row label="VALUE" value={formatEuro(ASSET.value)} />
        <Row
          label="RETURN"
          value={`+${formatEuro(ASSET.returnAmount)} (${ASSET.returnPct.toFixed(2)}%)`}
          green
        />
        <Row label="SHARES" value={formatNumber(ASSET.shares, 8)} underline />
        <Row label="AVERAGE PRICE" value={formatEuro(ASSET.averagePrice)} last />
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
        <HistoryCard
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
  average,
  hover,
  onHover,
  onScrubbing,
}: {
  prices: PricePoint[];
  current: number;
  average: number;
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
  const min = Math.min(136, ...values) - 2;
  const max = Math.max(168, ...values) + 2;
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
  const area = `${line} L ${left + innerW} ${top + innerH} L ${left} ${top + innerH} Z`;

  const ticks = [136, 140, 144, 148, 156, 160, 164];
  const currentY = yFor(current);
  const averageY = yFor(average);
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
        <Path d={area} fill="url(#fill)" />
        <Path
          d={line}
          fill="none"
          stroke={BLUE}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Line
          x1={left}
          x2={width - 25}
          y1={currentY}
          y2={currentY}
          stroke={BLUE}
          strokeWidth="1"
        />
        <Line
          x1={left}
          x2={width - 25}
          y1={averageY}
          y2={averageY}
          stroke="#9CA3AF"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <Pill x={width - 50} y={currentY - 10} label={current.toFixed(2)} fill={BLUE} />
        <Pill x={width - 50} y={averageY - 10} label={average.toFixed(2)} fill="#4B5563" />
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
  },
  logoMark: { color: "#ffffff", fontSize: 26, fontWeight: "700" },
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
  ranges: { flexDirection: "row", alignItems: "center", gap: 2 },
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
