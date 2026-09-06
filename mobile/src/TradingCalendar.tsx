import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const INK = "#111111";
const MUTED = "#9CA3AF";
const LINE = "#E8E8E8";
const GREEN = "#16A34A";
const RED = "#DC2626";
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type DayEntry = {
  gain: string;
  loss: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dayKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function netOf(entry?: DayEntry) {
  if (!entry) return null;
  const empty = entry.gain.trim() === "" && entry.loss.trim() === "";
  if (empty) return null;
  return toNumber(entry.gain) - toNumber(entry.loss);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function mondayOffset(year: number, month: number) {
  const weekday = new Date(year, month, 1).getDay();
  return weekday === 0 ? 6 : weekday - 1;
}

export function TradingCalendar({
  toolbar,
  onMonthTotal,
}: {
  toolbar?: ReactNode;
  onMonthTotal?: (total: number) => void;
}) {
  const [cursor, setCursor] = useState({ year: 2026, month: 8 });
  const [days, setDays] = useState<Record<string, DayEntry>>({});
  const [picked, setPicked] = useState<string | null>(null);

  const cells = useMemo(() => {
    const start = mondayOffset(cursor.year, cursor.month);
    const count = daysInMonth(cursor.year, cursor.month);
    const total = Math.ceil((start + count) / 7) * 7;
    return Array.from({ length: total }, (_, index) => {
      const day = index - start + 1;
      if (day < 1 || day > count) return null;
      return day;
    });
  }, [cursor]);
  const lastRow = cells.slice(-7);
  const earlier = cells.slice(0, -7);
  const trailingEmpty = lastRow.filter((day) => day == null).length;
  const iconsOnLastRow = Boolean(toolbar) && trailingEmpty >= 2;
  const lastRowHasEntry = lastRow.some(
    (day) => day != null && netOf(days[dayKey(cursor.year, cursor.month, day)]) != null,
  );

  const monthTotal = useMemo(() => {
    const prefix = `${cursor.year}-${pad(cursor.month + 1)}-`;
    return Object.entries(days).reduce((sum, [key, entry]) => {
      if (!key.startsWith(prefix)) return sum;
      return sum + (netOf(entry) ?? 0);
    }, 0);
  }, [cursor, days]);

  useEffect(() => {
    onMonthTotal?.(monthTotal);
  }, [monthTotal, onMonthTotal]);

  const pickedEntry = picked ? days[picked] : undefined;

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function updatePicked(patch: Partial<DayEntry>) {
    if (!picked) return;
    setDays((current) => {
      const previous = current[picked] ?? { gain: "", loss: "" };
      return { ...current, [picked]: { ...previous, ...patch } };
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.monthRow}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10}>
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTHS[cursor.month]} {cursor.year}
        </Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={10}>
          <Text style={styles.nav}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {earlier.map((day, index) => (
          <DayCell
            key={day == null ? `empty-${index}` : dayKey(cursor.year, cursor.month, day)}
            day={day}
            entry={day == null ? undefined : days[dayKey(cursor.year, cursor.month, day)]}
            onPress={day == null ? undefined : () => setPicked(dayKey(cursor.year, cursor.month, day))}
          />
        ))}
        {lastRow.map((day) => {
          if (day == null) return null;
          const key = dayKey(cursor.year, cursor.month, day);
          const entry = days[key];
          return (
            <DayCell
              key={key}
              day={day}
              entry={entry}
              compact={netOf(entry) == null}
              onPress={() => setPicked(key)}
            />
          );
        })}
        {iconsOnLastRow ? (
          <View
            style={[
              styles.toolbarSlot,
              lastRowHasEntry ? styles.toolbarSlotTall : styles.toolbarSlotShort,
              { width: `${(trailingEmpty / 7) * 100}%` },
            ]}
          >
            {toolbar}
          </View>
        ) : lastRow.map((day, index) =>
          day == null ? <View key={`tail-${index}`} style={styles.cell} /> : null,
        )}
      </View>
      {!iconsOnLastRow && toolbar ? <View style={styles.toolbarBelow}>{toolbar}</View> : null}

      <Modal
        visible={Boolean(picked)}
        transparent
        animationType="fade"
        onRequestClose={() => setPicked(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBg}
        >
          <Pressable style={styles.modalFill} onPress={() => setPicked(null)}>
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <Text style={styles.sheetTitle}>Gain / Loss</Text>
              <View style={styles.fields}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Gain</Text>
                  <TextInput
                    value={pickedEntry?.gain ?? ""}
                    onChangeText={(gain) => updatePicked({ gain })}
                    placeholder="0"
                    placeholderTextColor={MUTED}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Loss</Text>
                  <TextInput
                    value={pickedEntry?.loss ?? ""}
                    onChangeText={(loss) => updatePicked({ loss })}
                    placeholder="0"
                    placeholderTextColor={MUTED}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
              </View>
              <Pressable style={styles.doneBtn} onPress={() => setPicked(null)}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DayCell({
  day,
  entry,
  compact,
  onPress,
}: {
  day: number | null;
  entry?: DayEntry;
  compact?: boolean;
  onPress?: () => void;
}) {
  if (day == null) {
    return <View style={styles.cell} />;
  }
  const net = netOf(entry);
  const tint =
    net == null || net === 0
      ? styles.tileEmpty
      : net < 0
        ? styles.tileLoss
        : styles.tileGain;
  const valueColor = net == null || net === 0 ? INK : net < 0 ? RED : GREEN;
  return (
    <View style={styles.cell}>
      <Pressable
        onPress={onPress}
        style={[styles.tile, compact ? styles.tileCompact : styles.tileTall, tint]}
      >
        <Text style={styles.dayNum}>{day}</Text>
        {net != null ? (
          <Text style={[styles.dayValue, { color: valueColor }]}>
            {String(Math.abs(net))}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  monthTitle: { color: INK, fontSize: 16, fontWeight: "400" },
  nav: { color: INK, fontSize: 28, lineHeight: 30, paddingHorizontal: 6 },
  weekRow: { flexDirection: "row" },
  weekday: {
    width: "14.285%",
    textAlign: "center",
    color: MUTED,
    fontSize: 11,
    fontWeight: "600",
    paddingBottom: 5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
  cell: {
    width: "14.2857%",
    padding: 2.5,
  },
  tile: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
  },
  tileTall: {
    minHeight: 47,
    paddingVertical: 3,
  },
  tileCompact: {
    minHeight: 24,
    paddingVertical: 2,
  },
  tileEmpty: {
    backgroundColor: "#ffffff",
    borderColor: LINE,
  },
  tileGain: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  tileLoss: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  dayNum: { color: INK, fontSize: 13 },
  dayValue: { fontSize: 10, marginTop: 1 },
  toolbarSlot: {
    paddingHorizontal: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  toolbarSlotTall: { minHeight: 47 },
  toolbarSlotShort: { minHeight: 24 },
  toolbarBelow: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center" },
  modalFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: {
    width: 280,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
  },
  sheetTitle: { color: INK, fontSize: 15, marginBottom: 12, textAlign: "center" },
  fields: { gap: 10 },
  field: { gap: 4 },
  fieldLabel: { color: MUTED, fontSize: 11, fontWeight: "600" },
  input: {
    color: INK,
    fontSize: 16,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  doneBtn: {
    marginTop: 14,
    backgroundColor: INK,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  doneText: { color: "#ffffff", fontSize: 15 },
});
