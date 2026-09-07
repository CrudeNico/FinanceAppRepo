import { forwardRef, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  formatDayMonth,
  todayIso,
  yearOf,
  type AssetEntry,
  type AssetKind,
} from "./assetData";
import { useTheme } from "./theme";
import { modalCenter } from "./modalCenter";
import { TableBody } from "./TableBody";
import { useLockBackGesture } from "./useLockBackGesture";
import { useRevealSwipe } from "./useRevealSwipe";

const INK = "#111111";
const MUTED = "#9CA3AF";
const LINE = "#E8E8E8";
const RED = "#DC2626";
const GREEN = "#16A34A";
const ACTION = 68;
const START_ID = "a-start";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isStart(entry: AssetEntry) {
  return entry.id === START_ID || entry.kind === "start";
}

function kindLabel(kind: AssetKind) {
  if (kind === "start") return "Value";
  if (kind === "dec") return "Dec";
  return "Inc";
}

export function AssetHistory({
  entries,
  onChange,
  onAdded,
  onSwipe,
}: {
  entries: AssetEntry[];
  onChange: (entries: AssetEntry[]) => void;
  onAdded?: () => void;
  onSwipe?: (active: boolean) => void;
}) {
  const { colors: c } = useTheme();
  const latestYear = Math.max(yearOf(todayIso()), ...entries.map((entry) => yearOf(entry.date)));
  const [openYears, setOpenYears] = useState<number[]>([latestYear]);
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const [calendarFor, setCalendarFor] = useState<string | null>(null);
  const [swipeOn, setSwipeOn] = useState(true);

  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => yearOf(entry.date)));
    set.add(yearOf(todayIso()));
    return [...set].sort((a, b) => b - a);
  }, [entries]);

  function toggleYear(year: number) {
    setOpenYears((current) =>
      current.includes(year) ? current.filter((item) => item !== year) : [...current, year],
    );
  }

  function addRow() {
    const start = entries.find(isStart);
    if (!start) {
      onChange([{ id: START_ID, date: todayIso(), amount: "", kind: "start" }, ...entries]);
    } else {
      if (start.amount.trim() === "") return;
      if (entries.some((entry) => entry.amount.trim() === "")) return;
      onChange([{ id: `h${Date.now()}`, date: todayIso(), amount: "", kind: "inc" }, ...entries]);
    }
    setOpenYears((current) => (current.includes(latestYear) ? current : [latestYear, ...current]));
    setOpenSwipe(null);
    setSwipeOn(false);
    setTimeout(() => setSwipeOn(true), 400);
    onAdded?.();
  }

  function update(id: string, patch: Partial<AssetEntry>) {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function remove(id: string) {
    const row = entries.find((entry) => entry.id === id);
    if (!row || isStart(row)) return;
    onChange(entries.filter((entry) => entry.id !== id));
    setOpenSwipe(null);
  }

  const calendarEntry = entries.find((entry) => entry.id === calendarFor) ?? null;
  const back = useLockBackGesture();

  return (
    <>
      <View style={styles.sectionBar}>
        <Text style={[styles.section, { color: c.ink }]}>History</Text>
        <Pressable onPress={addRow} hitSlop={10} style={styles.actionBtn}>
          <Text style={[styles.plus, { color: c.ink }]}>+</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
        {years.map((year) => {
          const open = openYears.includes(year);
          const rows = entries
            .filter((entry) => yearOf(entry.date) === year)
            .sort((a, b) => {
              if (a.date !== b.date) return a.date < b.date ? 1 : -1;
              if (isStart(a) !== isStart(b)) return isStart(a) ? 1 : -1;
              return a.id < b.id ? 1 : -1;
            });
          return (
            <View key={year} style={styles.yearBlock}>
              <Pressable onPress={() => toggleYear(year)} style={styles.yearHead}>
                <Text style={[styles.year, { color: c.ink }]}>{year}</Text>
                {open ? <ChevronUp /> : <ChevronDown />}
              </Pressable>
              {open ? (
                <View
                  style={[styles.table, { borderColor: c.line }]}
                  onTouchStart={back.lock}
                  onTouchEnd={back.unlock}
                  onTouchCancel={back.unlock}
                >
                  <View style={[styles.tableHead, { backgroundColor: c.table, borderBottomColor: c.line }]}>
                    <Text style={[styles.headCell, styles.dateCol, { color: c.muted }]}>Date</Text>
                    <Text style={[styles.headCell, styles.typeCol, styles.colLine, { color: c.muted, borderLeftColor: c.line }]}>
                      Type
                    </Text>
                    <Text style={[styles.headCell, styles.numCol, styles.colLine, { color: c.muted, borderLeftColor: c.line }]}>
                      Amt
                    </Text>
                  </View>
                  {rows.length === 0 ? (
                    <Text style={[styles.empty, { color: c.muted }]}>No entries yet</Text>
                  ) : (
                    <TableBody rows={rows.length} onLock={onSwipe}>
                      {rows.map((entry, index) => (
                        <AssetRow
                          key={entry.id}
                          entry={entry}
                          last={index === rows.length - 1}
                          open={!isStart(entry) && openSwipe === entry.id}
                          enabled={swipeOn && !isStart(entry)}
                          onOpen={() => {
                            if (!isStart(entry)) setOpenSwipe(entry.id);
                          }}
                          onClose={() => setOpenSwipe((current) => (current === entry.id ? null : current))}
                          onDelete={() => remove(entry.id)}
                          onDate={() => setCalendarFor(entry.id)}
                          onUpdate={(patch) => update(entry.id, patch)}
                          onSwipe={onSwipe}
                        />
                      ))}
                    </TableBody>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Modal
        visible={Boolean(calendarEntry)}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarFor(null)}
      >
        <Pressable style={[modalCenter.bg, { backgroundColor: c.overlay }]} onPress={() => setCalendarFor(null)}>
          <Pressable style={[modalCenter.sheet, { backgroundColor: c.modal }]} onPress={() => undefined}>
            {calendarEntry ? (
              <MiniCalendar
                value={calendarEntry.date}
                onChange={(date) => {
                  update(calendarEntry.id, { date });
                  setCalendarFor(null);
                  const year = yearOf(date);
                  setOpenYears((current) => (current.includes(year) ? current : [...current, year]));
                }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function AssetRow({
  entry,
  last,
  open,
  enabled,
  onOpen,
  onClose,
  onDelete,
  onDate,
  onUpdate,
  onSwipe,
}: {
  entry: AssetEntry;
  last: boolean;
  open: boolean;
  enabled: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDate: () => void;
  onUpdate: (patch: Partial<AssetEntry>) => void;
  onSwipe?: (active: boolean) => void;
}) {
  const { colors: c } = useTheme();
  const rowWidth = useRef(0);
  const amountRef = useRef<TextInput>(null);
  const start = isStart(entry);
  const back = useLockBackGesture();
  const { pan, handlers, style: swipeStyle, nodeRef } = useRevealSwipe({
    open,
    enabled,
    width: ACTION,
    onOpen,
    onClose,
    onLock: () => {
      back.lock();
      onSwipe?.(true);
    },
    onUnlock: () => {
      back.unlock();
      onSwipe?.(false);
    },
    onTap: (x) => {
      const dateW = 62;
      const typeW = 64;
      if (x < dateW) onDate();
      else if (x < dateW + typeW) {
        if (!start) onUpdate({ kind: entry.kind === "dec" ? "inc" : "dec" });
      } else amountRef.current?.focus();
    },
  });

  return (
    <View style={[styles.rowWrap, !last && styles.rowLine, !last && { borderBottomColor: c.line }]}>
      <View style={styles.deleteLane} pointerEvents={open ? "auto" : "none"}>
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <TrashIcon color="#ffffff" />
        </Pressable>
      </View>
      <Animated.View
        style={[
          styles.tableRow,
          { backgroundColor: c.card, transform: [{ translateX: pan }] },
          swipeStyle,
        ]}
        onLayout={(event) => {
          rowWidth.current = event.nativeEvent.layout.width;
        }}
      >
        <Pressable onPress={open ? onClose : onDate} style={styles.dateCol}>
          <Text style={[styles.dateText, { color: c.ink }]}>{formatDayMonth(entry.date)}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (start) return;
            onUpdate({ kind: entry.kind === "dec" ? "inc" : "dec" });
          }}
          style={[styles.typeCol, styles.colLine, { borderLeftColor: c.line }]}
        >
          <Text
            style={[
              styles.typeText,
              { color: start ? c.ink : entry.kind === "dec" ? RED : GREEN },
            ]}
          >
            {kindLabel(entry.kind)}
          </Text>
        </Pressable>
        <Field
          ref={amountRef}
          value={entry.amount}
          onChange={(amount) => onUpdate({ amount })}
          style={[styles.numCol, styles.colLine, { borderLeftColor: c.line }]}
        />
        <View
          ref={nodeRef}
          collapsable={false}
          style={[StyleSheet.absoluteFill, swipeStyle]}
          {...handlers}
        />
      </Animated.View>
    </View>
  );
}

const Field = forwardRef<
  TextInput,
  {
    value: string;
    onChange: (value: string) => void;
    style: object | object[];
  }
>(function Field({ value, onChange, style }, ref) {
  const { colors: c } = useTheme();
  return (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={onChange}
      placeholder="—"
      placeholderTextColor={c.muted}
      keyboardType={Platform.OS === "web" ? "default" : "decimal-pad"}
      inputMode="decimal"
      style={[styles.input, { color: c.ink }, style]}
    />
  );
});

function MiniCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const { colors: c } = useTheme();
  const selected = new Date(`${value}T00:00:00`);
  const [cursor, setCursor] = useState(new Date(selected));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const startPad = first === 0 ? 6 : first - 1;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <View>
      <View style={styles.calHead}>
        <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={8}>
          <Text style={[styles.calNav, { color: c.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.calTitle, { color: c.ink }]}>
          {MONTHS[month]} {year}
        </Text>
        <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={8}>
          <Text style={[styles.calNav, { color: c.ink }]}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <Text key={`${day}-${index}`} style={[styles.weekDay, { color: c.muted }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`e${index}`} style={styles.dayCell} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const on = iso === value;
          return (
            <Pressable key={iso} onPress={() => onChange(iso)} style={styles.dayCell}>
              <View style={[styles.dayInner, on && { backgroundColor: c.ink }]}>
                <Text style={[styles.dayText, { color: on ? c.bg : c.ink }]}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ChevronDown() {
  const { colors: c } = useTheme();
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
        stroke={c.muted}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronUp() {
  const { colors: c } = useTheme();
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="m4.5 15.75 7.5-7.5 7.5 7.5"
        stroke={c.muted}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon({ color = INK }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  sectionBar: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: { color: INK, fontSize: 17, fontWeight: "400" },
  actionBtn: { paddingHorizontal: 2, paddingVertical: 2 },
  plus: { color: INK, fontSize: 24, lineHeight: 26, fontWeight: "300" },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  yearBlock: { paddingVertical: 6 },
  yearHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  year: { color: INK, fontSize: 15, fontWeight: "400" },
  table: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headCell: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "600",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  rowWrap: { position: "relative", overflow: "hidden" },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  deleteLane: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: ACTION,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  deleteBtn: {
    width: ACTION,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    minHeight: 36,
    zIndex: 1,
  },
  colLine: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: LINE,
  },
  dateCol: { width: 62, paddingHorizontal: 6, justifyContent: "center" },
  typeCol: { width: 64, paddingHorizontal: 6, justifyContent: "center" },
  numCol: { flex: 1 },
  dateText: { color: INK, fontSize: 13 },
  typeText: { fontSize: 13, fontWeight: "600" },
  input: { color: INK, fontSize: 13, paddingVertical: 8, paddingHorizontal: 6 },
  empty: { color: MUTED, fontSize: 12, paddingVertical: 8, paddingHorizontal: 8 },
  calHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calTitle: { color: INK, fontSize: 15 },
  calNav: { color: INK, fontSize: 22, paddingHorizontal: 6 },
  weekRow: { flexDirection: "row" },
  weekDay: { width: "14.285%", textAlign: "center", color: MUTED, fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayInner: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayText: { color: INK, fontSize: 13 },
});
