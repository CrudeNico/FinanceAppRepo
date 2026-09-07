import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { CategoryIconById } from "./categoryIcons";
import { IONICON_OUTLINES } from "./ioniconNames";
import { useTheme } from "./theme";
import { useDragTrack } from "./useRevealSwipe";

const INK = "#111111";
const MUTED = "#9CA3AF";
const LINE = "#E8E8E8";
const SIZE = 108;
const OUTER = 50;
const INNER = 40;
const CX = SIZE / 2;
const CY = SIZE / 2;
const SLICES = 48;
const SWATCH = 32;

const PRESET_ICONS = [
  "restaurant-outline",
  "home-outline",
  "car-outline",
  "bag-handle-outline",
  "game-controller-outline",
  "heart-outline",
  "airplane-outline",
  "school-outline",
  "wallet-outline",
  "fitness-outline",
  "people-outline",
  "laptop-outline",
  "gift-outline",
  "card-outline",
];

function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (n: number) => Math.round(255 * n).toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

function point(radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function ringSlice(inner: number, outer: number, start: number, end: number) {
  const a = point(outer, start);
  const b = point(outer, end);
  const c = point(inner, end);
  const d = point(inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;
}

const WHEEL_SLICES = Array.from({ length: SLICES }, (_, slice) => {
  const start = (slice / SLICES) * 360;
  const end = ((slice + 1) / SLICES) * 360;
  return {
    d: ringSlice(INNER, OUTER, start, end),
    color: hslToHex(start, 80, 50),
  };
});

export const PALETTE_COLORS = [hslToHex(0, 80, 50)];

export function ColorPalette({
  value,
  onChange,
  onGrab,
}: {
  value: string;
  onChange: (color: string) => void;
  onGrab?: (active: boolean) => void;
}) {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const grabRef = useRef(onGrab);
  grabRef.current = onGrab;

  function pick(x: number, y: number) {
    const dx = x - CX;
    const dy = y - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > OUTER + 12) return;
    const hue = (Math.atan2(dy, dx) * 180) / Math.PI;
    changeRef.current(hslToHex((hue + 360) % 360, 80, 50));
  }

  const drag = useDragTrack(
    (x, y) => pick(x, y),
    (active) => grabRef.current?.(active),
  );

  return (
    <View style={styles.wheelWrap} {...drag}>
      <Svg width={SIZE} height={SIZE} pointerEvents="none">
        {WHEEL_SLICES.map((slice) => (
          <Path key={slice.d} d={slice.d} fill={slice.color} />
        ))}
        <Circle cx={CX} cy={CY} r={SWATCH} fill={value} />
      </Svg>
    </View>
  );
}

export function IconPalette({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}) {
  const { colors: c } = useTheme();
  const [query, setQuery] = useState("");
  const icons = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = IONICON_OUTLINES as readonly string[];
    const picked: string[] = [];
    const seen = new Set<string>();
    const source = needle
      ? all.filter((name) => name.replace(/-outline$/, "").includes(needle))
      : PRESET_ICONS;
    source.forEach((name) => {
      if (picked.length >= 14 || seen.has(name)) return;
      picked.push(name);
      seen.add(name);
    });
    if (picked.length < 14) {
      [...PRESET_ICONS, ...all].forEach((name) => {
        if (picked.length >= 14 || seen.has(name)) return;
        picked.push(name);
        seen.add(name);
      });
    }
    return picked;
  }, [query]);

  return (
    <View style={styles.iconSide}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search icons"
        placeholderTextColor={c.muted}
        style={[styles.search, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {[0, 7].map((start) => (
        <View key={start} style={styles.iconRow}>
          {icons.slice(start, start + 7).map((icon) => (
            <Pressable
              key={icon}
              onPress={() => onChange(icon)}
              style={[
                styles.iconPick,
                { borderColor: c.line },
                value === icon && { borderColor: c.ink, backgroundColor: c.lift },
              ]}
            >
              <CategoryIconById icon={icon} color={color} size={13} />
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

export function DraftLooks({
  color,
  icon,
  onColor,
  onIcon,
  onGrab,
}: {
  color: string;
  icon: string;
  onColor: (color: string) => void;
  onIcon: (icon: string) => void;
  onGrab?: (active: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <ColorPalette value={color} onChange={onColor} onGrab={onGrab} />
      <IconPalette value={icon} color={color} onChange={onIcon} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  wheelWrap: {
    width: SIZE,
    height: SIZE,
  },
  iconSide: { flex: 1 },
  search: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: INK,
    fontSize: 12,
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  iconPick: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPickOn: { borderColor: INK, backgroundColor: "#F3F4F6" },
});
