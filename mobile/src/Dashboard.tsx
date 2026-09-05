import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  DEMO_INVESTMENTS,
  DEMO_NET_WORTH,
  PRICE_SERIES,
  SLICE_PALETTE,
  allocation,
  filterSeries,
  formatDate,
  formatEuro,
  monthChangePct,
  newId,
  netWorthSeries,
  priceInEur,
  type Fund,
  type FundId,
  type Investment,
  type Range,
  type SeriesPoint,
} from "./portfolio";

const NAVY = "#0B1F3A";
const WHITE = "#ffffff";
const INK = "#1F1C18";
const MUTED = "#6B7280";
const RANGES: Range[] = ["1M", "3M", "6M", "1Y", "All"];

export function Dashboard() {
  const [investments, setInvestments] = useState<Investment[]>(DEMO_INVESTMENTS);
  const [extraFunds, setExtraFunds] = useState<Fund[]>([]);
  const [range, setRange] = useState<Range>("All");
  const [selectedFund, setSelectedFund] = useState<FundId | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draftDate, setDraftDate] = useState("2026-09-04");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftEntry, setDraftEntry] = useState("");
  const [draftEuros, setDraftEuros] = useState("");
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const slices = useMemo(
    () =>
      allocation(investments, extraFunds)
        .filter((item) => item.value > 0)
        .map((item) => ({
          id: item.fund.id,
          name: item.fund.name,
          value: item.value,
          invested: item.invested,
          color: item.fund.color,
        })),
    [extraFunds, investments],
  );

  const history = useMemo(() => {
    const rows = selectedFund
      ? investments.filter((item) => item.fundId === selectedFund)
      : investments;
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }, [investments, selectedFund]);

  const overlay = Boolean(selectedFund);

  const chartData = useMemo(() => {
    if (overlay && selectedFund) {
      const known = PRICE_SERIES[selectedFund] ?? [];
      const extra = investments
        .filter((item) => item.fundId === selectedFund)
        .map((item) => ({ date: item.date, value: priceInEur(item) }));
      const merged = new Map(known.map((point) => [point.date, point.value]));
      for (const point of extra) {
        if (!merged.has(point.date)) merged.set(point.date, point.value);
      }
      const series = [...merged.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }));
      return filterSeries(series.length > 1 ? series : extra, range);
    }
    return filterSeries(netWorthSeries(investments), range);
  }, [investments, overlay, range, selectedFund]);

  const latestAmount = chartData[chartData.length - 1]?.value ?? DEMO_NET_WORTH;
  const netParts = splitEuro(hoverValue ?? latestAmount);

  function acceptDraft() {
    const amountEur = Number(draftAmount.replace(",", "."));
    const sharePrice = Number(draftEntry.replace(",", "."));
    const euros = Number(draftEuros.replace(",", "."));
    if (!draftDate || !amountEur || !sharePrice) return;
    const currency = euros && Math.abs(euros - sharePrice) > 0.01 ? "USD" : "EUR";
    setInvestments((current) => [
      ...current,
      {
        id: newId(),
        fundId: selectedFund ?? "nasdaq",
        date: draftDate,
        amountEur,
        sharePrice,
        currency,
        fxRate: currency === "USD" ? euros / sharePrice : 1,
      },
    ]);
    setDraftAmount("");
    setDraftEntry("");
    setDraftEuros("");
    setAdding(false);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.cornerGlow}>
          <Svg width={240} height={240} viewBox="0 0 240 240">
            <Defs>
              <RadialGradient id="cornerFade" cx="70%" cy="30%" rx="70%" ry="70%">
                <Stop offset="0" stopColor="#5A8CC3" stopOpacity="0.34" />
                <Stop offset="0.55" stopColor="#3D7AB5" stopOpacity="0.12" />
                <Stop offset="1" stopColor="#0B1F3A" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="240" height="240" fill="url(#cornerFade)" />
          </Svg>
        </View>
        <Text style={styles.kicker}>Total net worth</Text>
        <Text style={styles.net}>
          {netParts.whole}
          <Text style={styles.netSmall}>,{netParts.decimals}</Text>
          <Text style={styles.netSmall}> €</Text>
        </Text>
        <View style={styles.row}>
          {RANGES.map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setHoverValue(null);
                setRange(item);
              }}
              style={[styles.chip, range === item ? styles.chipOn : null]}
            >
              <Text style={[styles.chipText, range === item ? styles.chipOnText : null]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <LineChart data={chartData} onHoverValue={setHoverValue} />
      </View>

      <View style={styles.sheet}>
        <Pie
          slices={slices}
          selected={selectedFund}
          onSelect={(id) => {
            setHoverValue(null);
            setSelectedFund((current) => (current === id ? null : id));
          }}
          onClear={() => {
            setHoverValue(null);
            setSelectedFund(null);
          }}
          onAdd={({ name, color, amountEur }) => {
            const id = `fund-${Date.now()}`;
            setExtraFunds((current) => [...current, { id, name, label: name, color }]);
            setInvestments((current) => [
              ...current,
              {
                id: newId(),
                fundId: id,
                date: new Date().toISOString().slice(0, 10),
                amountEur,
                sharePrice: 1,
                currency: "EUR",
                fxRate: 1,
              },
            ]);
          }}
        />

        <View style={styles.historyHead}>
          <Text style={styles.title}>History</Text>
          <View style={styles.historyActions}>
            <Pressable
              onPress={() => setHistoryOpen((open) => !open)}
              hitSlop={8}
              style={styles.iconBtn}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d={
                    historyOpen
                      ? "M4.5 15.75 L12 8.25 L19.5 15.75"
                      : "M19.5 8.25 L12 15.75 L4.5 8.25"
                  }
                  stroke={INK}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => {
                setAdding(true);
                setHistoryOpen(true);
              }}
              style={styles.iconBtn}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 4.5 V19.5 M19.5 12 H4.5"
                  stroke={INK}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          </View>
        </View>

        {historyOpen ? (
          <View>
            <View style={styles.tableHead}>
              <Text style={[styles.col, styles.head]}>Date</Text>
              <Text style={[styles.col, styles.head]}>Amount</Text>
              <Text style={[styles.col, styles.head]}>Entry</Text>
              <Text style={[styles.col, styles.head]}>EUR</Text>
              <Text style={styles.acceptCol} />
            </View>
            {adding ? (
              <View style={styles.tableRow}>
                <TextInput
                  style={[styles.col, styles.input]}
                  value={draftDate}
                  onChangeText={setDraftDate}
                />
                <TextInput
                  style={[styles.col, styles.input]}
                  value={draftAmount}
                  onChangeText={setDraftAmount}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.col, styles.input]}
                  value={draftEntry}
                  onChangeText={setDraftEntry}
                  placeholder="Price"
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.col, styles.input]}
                  value={draftEuros}
                  onChangeText={setDraftEuros}
                  placeholder="USD→€"
                  keyboardType="decimal-pad"
                />
                <Pressable onPress={acceptDraft} style={styles.accept}>
                  <Text style={styles.acceptText}>✓</Text>
                </Pressable>
              </View>
            ) : (
              history.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.col}>{formatDate(item.date)}</Text>
                  <Text style={styles.col}>{formatEuro(item.amountEur)}</Text>
                  <Text style={styles.col}>
                    {item.currency === "USD"
                      ? `$${item.sharePrice.toFixed(2)}`
                      : formatEuro(item.sharePrice)}
                  </Text>
                  <Text style={styles.col}>
                    {item.currency === "USD" ? formatEuro(priceInEur(item)) : "—"}
                  </Text>
                  <Text style={styles.acceptCol} />
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function LineChart({
  data,
  onHoverValue,
}: {
  data: SeriesPoint[];
  onHoverValue: (value: number | null) => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 340;
  const height = 200;
  const left = 8;
  const right = 8;
  const top = 16;
  const bottom = 28;
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const coords = data.map((point, index) => {
    const t = index / Math.max(data.length - 1, 1);
    const x = left + t * innerW;
    const y = top + (1 - (point.value - min) / span) * innerH;
    return { ...point, x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = [
    `M ${left} ${top + innerH}`,
    ...coords.map((point) => `L ${point.x} ${point.y}`),
    `L ${left + innerW} ${top + innerH}`,
    "Z",
  ].join(" ");
  function pick(locationX: number) {
    let nearest = 0;
    let best = Infinity;
    coords.forEach((point, index) => {
      const distance = Math.abs(point.x - locationX);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
    onHoverValue(coords[nearest]?.value ?? null);
  }

  function clearHover() {
    setHoverIndex(null);
    onHoverValue(null);
  }

  const dateMarks =
    hoverIndex == null
      ? coords.filter((_, index) => index === 0 || index === coords.length - 1)
      : [coords[hoverIndex]];

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => pick(event.nativeEvent.locationX)}
      onResponderMove={(event) => pick(event.nativeEvent.locationX)}
      onResponderRelease={clearHover}
      onResponderTerminate={clearHover}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={WHITE} stopOpacity="0.22" />
            <Stop offset="1" stopColor={WHITE} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="endFade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0.75" stopColor={NAVY} stopOpacity="0" />
            <Stop offset="1" stopColor={NAVY} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#shade)" />
        <Polyline points={line} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="2" />
        <Path
          d={`M ${width - 36} 0 H ${width} V ${top + innerH} H ${width - 36} Z`}
          fill="url(#endFade)"
        />
        {dateMarks.map((point, index) => {
          const hovering = hoverIndex != null;
          const isStart = !hovering && index === 0;
          const isEnd = !hovering && index === dateMarks.length - 1;
          const x = hovering
            ? Math.min(Math.max(point.x, 44), width - 44)
            : isStart
              ? 8
              : width - 8;
          return (
            <SvgText
              key={point.date}
              x={x}
              y={height - 6}
              fill="rgba(255,255,255,0.7)"
              fontSize="10"
              textAnchor={isStart ? "start" : isEnd ? "end" : "middle"}
            >
              {formatDate(point.date)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

type SliceItem = {
  id: FundId;
  name: string;
  value: number;
  invested: number;
  color: string;
};

const LEGEND_ROW = 36;
const LEGEND_VISIBLE = 4;

function Pie({
  slices,
  selected,
  onSelect,
  onClear,
  onAdd,
}: {
  slices: SliceItem[];
  selected: FundId | null;
  onSelect: (id: FundId) => void;
  onClear: () => void;
  onAdd: (draft: { name: string; color: string; amountEur: number }) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftColor, setDraftColor] = useState<string>(SLICE_PALETTE[2]);
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const size = 132;
  const radius = 48;
  const inner = 28;
  const cx = 66;
  const cy = 66;
  const selectedSlice = selected ? slices.find((slice) => slice.id === selected) : null;
  const canConfirm = Boolean(draftName.trim() && Number(draftAmount.replace(",", ".")));

  function usedColors(...extra: string[]) {
    return new Set(
      [...slices.map((slice) => slice.color), ...extra].map((color) => color.toLowerCase()),
    );
  }

  function colorPool(blocked: Set<string>) {
    return SLICE_PALETTE.filter((color) => !blocked.has(color.toLowerCase()));
  }

  function inventColor(blocked: Set<string>) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const hue = Math.floor(Math.random() * 360);
      const color = `hsl(${hue} 28% 38%)`;
      if (!blocked.has(color.toLowerCase())) return color;
    }
    return `hsl(${Math.floor(Math.random() * 360)} 26% 42%)`;
  }

  function fillOptions(blocked: Set<string>, count: number) {
    const fromPalette = pickRandom(colorPool(blocked), count);
    const extras = [...fromPalette];
    while (extras.length < count) {
      const next = inventColor(new Set([...blocked, ...extras.map((item) => item.toLowerCase())]));
      extras.push(next);
    }
    return extras;
  }

  function pickRandom(from: string[], count: number) {
    const copy = [...from];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy.slice(0, count);
  }

  function resetDraft() {
    setAdding(false);
    setPaletteOpen(false);
    setDraftName("");
    setDraftAmount("");
    setColorOptions([]);
  }

  function submitDraft() {
    const amountEur = Number(draftAmount.replace(",", "."));
    const name = draftName.trim();
    if (!name || !amountEur) return;
    onAdd({ name, color: draftColor, amountEur });
    resetDraft();
  }

  function startAdd() {
    const blocked = usedColors();
    const available = colorPool(blocked);
    const preview = available[0] ?? SLICE_PALETTE[0];
    const options = fillOptions(usedColors(preview), 7);
    setDraftColor(preview);
    setColorOptions(options);
    setAdding(true);
    setPaletteOpen(false);
    onClear();
  }

  function chooseColor(color: string) {
    const blocked = usedColors(color, ...colorOptions.filter((item) => item !== color));
    const refill = fillOptions(blocked, 1)[0];
    setDraftColor(color);
    setColorOptions((current) => {
      const next = current.filter((item) => item !== color);
      return [...next, refill].slice(0, 7);
    });
  }

  return (
    <View style={[styles.pieRow, adding || selectedSlice ? styles.pieRowTop : null]}>
      <View style={styles.pieWrap}>
        <Svg width={132} height={132} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((slice, index) => {
            const start = slices.slice(0, index).reduce((sum, item) => {
              return sum + (item.value / total) * Math.PI * 2;
            }, -Math.PI / 2);
            const sweep = (slice.value / total) * Math.PI * 2;
            const end = start + sweep;
            const large = sweep > Math.PI ? 1 : 0;
            const os = polar(cx, cy, radius, start);
            const oe = polar(cx, cy, radius, end);
            const is = polar(cx, cy, inner, end);
            const ie = polar(cx, cy, inner, start);
            const d = `M ${os.x} ${os.y} A ${radius} ${radius} 0 ${large} 1 ${oe.x} ${oe.y} L ${is.x} ${is.y} A ${inner} ${inner} 0 ${large} 0 ${ie.x} ${ie.y} Z`;
            const dimmed = Boolean(selected && slice.id !== selected);
            return (
              <G key={slice.id} originX={cx} originY={cy} scale={dimmed ? 0.78 : 1}>
                <Path
                  d={d}
                  fill={dimmed ? fadeColor(slice.color) : slice.color}
                  onPress={() => {
                    resetDraft();
                    onSelect(slice.id);
                  }}
                />
              </G>
            );
          })}
        </Svg>
        <Pressable
          onPress={() => {
            if (adding) {
              resetDraft();
              return;
            }
            startAdd();
          }}
          hitSlop={8}
          style={styles.piePlus}
          accessibilityLabel={adding ? "Cancel new participant" : "Add participant"}
        >
          <PlusIcon />
        </Pressable>
      </View>

      {adding ? (
        <View style={styles.addCol}>
          <View>
            <View style={styles.addBox}>
              <View style={styles.addRow}>
                <Pressable
                  onPress={() => setPaletteOpen((open) => !open)}
                  style={[styles.colorDot, { backgroundColor: draftColor }]}
                />
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Name"
                  placeholderTextColor="rgba(31,28,24,0.35)"
                  style={styles.addName}
                  autoFocus
                  returnKeyType="next"
                />
                <TextInput
                  value={draftAmount}
                  onChangeText={setDraftAmount}
                  placeholder="0"
                  placeholderTextColor="rgba(31,28,24,0.35)"
                  keyboardType="decimal-pad"
                  style={styles.addAmount}
                  returnKeyType="next"
                  blurOnSubmit
                />
                <Text style={styles.addEuro}>€</Text>
              </View>
              {paletteOpen ? (
                <View style={styles.palette}>
                  {colorOptions.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => chooseColor(color)}
                      style={[styles.paletteDot, { backgroundColor: color }]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            {canConfirm ? (
              <Pressable
                onPress={submitDraft}
                style={styles.addConfirm}
                accessibilityLabel="Add participant"
              >
                <PlusIcon />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : selectedSlice ? (
        <View style={styles.selectedCol}>
          <Pressable onPress={() => onSelect(selectedSlice.id)} style={styles.legend}>
            <View style={[styles.dot, { backgroundColor: selectedSlice.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {selectedSlice.name}
            </Text>
            <Text style={styles.legendShare}>{formatPct((selectedSlice.value / total) * 100, false)}</Text>
            <Text style={styles.legendValue}>{formatEuro(selectedSlice.value)}</Text>
          </Pressable>
          <View style={styles.perfRow}>
            <Text style={gainStyle(gainPct(selectedSlice))}>
              Total {formatPct(gainPct(selectedSlice))}
            </Text>
            <Text style={gainStyle(monthChangePct(selectedSlice.id))}>
              1M {formatPct(monthChangePct(selectedSlice.id))}
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.legendScroll}
          contentContainerStyle={styles.legendCol}
          nestedScrollEnabled
          showsVerticalScrollIndicator={slices.length > LEGEND_VISIBLE}
        >
          {slices.map((slice) => (
            <Pressable key={slice.id} onPress={() => onSelect(slice.id)} style={styles.legend}>
              <View style={[styles.dot, { backgroundColor: slice.color }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {slice.name}
              </Text>
              <Text style={styles.legendValue}>{formatEuro(slice.value)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4.5v15m7.5-7.5h-15"
        stroke={NAVY}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function gainPct(slice: SliceItem) {
  if (!slice.invested) return 0;
  return ((slice.value - slice.invested) / slice.invested) * 100;
}

function formatPct(value: number, signed = true) {
  const abs = Math.abs(value).toFixed(1).replace(".", ",");
  if (!signed) return `${abs}%`;
  if (value > 0) return `+${abs}%`;
  if (value < 0) return `−${abs}%`;
  return `${abs}%`;
}

function gainStyle(value: number) {
  if (value > 0) return [styles.perfText, styles.perfUp];
  if (value < 0) return [styles.perfText, styles.perfDown];
  return [styles.perfText];
}

function splitEuro(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const [whole, decimals = "00"] = formatted.split(",");
  return { whole, decimals };
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function fadeColor(hex: string) {
  const raw = hex.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const lift = (channel: number) => Math.round(channel + (236 - channel) * 0.52);
  return `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NAVY },
  page: { paddingBottom: 40 },
  hero: {
    overflow: "hidden",
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: NAVY,
  },
  cornerGlow: {
    position: "absolute",
    top: -80,
    right: -70,
    width: 240,
    height: 240,
  },
  kicker: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  net: { color: WHITE, fontSize: 42, fontWeight: "500", marginTop: 8 },
  netSmall: { fontSize: 18, color: "rgba(255,255,255,0.75)" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16, marginBottom: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: WHITE },
  chipText: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  chipOnText: { color: NAVY },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -12,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    minHeight: 420,
  },
  pieRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 12 },
  pieRowTop: { alignItems: "flex-start" },
  pieWrap: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  piePlus: {
    position: "absolute",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  addCol: { flex: 1, alignSelf: "flex-start" },
  addBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  addConfirm: {
    marginTop: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  addName: { flex: 1, color: INK, fontSize: 13, paddingVertical: 2 },
  addAmount: { width: 56, color: INK, fontSize: 12, textAlign: "right", paddingVertical: 2 },
  addEuro: { color: "rgba(31,28,24,0.45)", fontSize: 12 },
  palette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    backgroundColor: "#E8EAEE",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  paletteDot: { width: 16, height: 16, borderRadius: 8 },
  selectedCol: { flex: 1, paddingTop: 6, gap: 10 },
  legendScroll: { flex: 1, maxHeight: LEGEND_ROW * LEGEND_VISIBLE },
  legendCol: { flexGrow: 1 },
  legend: {
    height: LEGEND_ROW,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendText: { color: INK, flex: 1, fontSize: 13 },
  legendShare: { color: MUTED, fontSize: 12, fontVariant: ["tabular-nums"] },
  legendValue: { color: INK, fontSize: 12, fontVariant: ["tabular-nums"] },
  perfRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  perfText: { color: MUTED, fontSize: 12 },
  perfUp: { color: "#3F7D5A" },
  perfDown: { color: "#B85C38" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  historyHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
  },
  historyActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  title: { color: INK, fontSize: 24, fontWeight: "500" },
  iconBtn: { height: 28, width: 28, alignItems: "center", justifyContent: "center" },
  tableHead: {
    flexDirection: "row",
    marginTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(31,28,24,0.15)",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(31,28,24,0.08)",
  },
  col: { flex: 1, color: INK, fontSize: 11 },
  head: { color: MUTED, fontSize: 10, textTransform: "uppercase" },
  input: { borderBottomWidth: 1, borderBottomColor: "rgba(31,28,24,0.2)", paddingVertical: 4 },
  acceptCol: { width: 28 },
  accept: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: { color: WHITE, fontSize: 14 },
});
