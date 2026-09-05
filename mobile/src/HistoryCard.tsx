import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  INITIAL_HISTORY,
  TODAY,
  formatDayMonth,
  yearOf,
  type HistoryEntry,
} from "./assetData";

const INK = "#111111";
const MUTED = "#9CA3AF";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function HistoryCard() {
  const [entries, setEntries] = useState<HistoryEntry[]>(INITIAL_HISTORY);
  const latestYear = Math.max(yearOf(TODAY), ...entries.map((entry) => yearOf(entry.date)));
  const [openYears, setOpenYears] = useState<number[]>([latestYear]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calendarFor, setCalendarFor] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => yearOf(entry.date)));
    set.add(yearOf(TODAY));
    return [...set].sort((a, b) => b - a);
  }, [entries]);

  function toggleYear(year: number) {
    setOpenYears((current) =>
      current.includes(year) ? current.filter((item) => item !== year) : [...current, year],
    );
  }

  function addRow() {
    const id = `h${Date.now()}`;
    setEntries((current) => [
      { id, date: TODAY, amount: "", price: "", fx: "" },
      ...current,
    ]);
    setOpenYears((current) => (current.includes(latestYear) ? current : [latestYear, ...current]));
    setSelectedId(null);
  }

  function update(id: string, patch: Partial<HistoryEntry>) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  function removeSelected() {
    if (!selectedId) return;
    setEntries((current) => current.filter((entry) => entry.id !== selectedId));
    setSelectedId(null);
  }

  const calendarEntry = entries.find((entry) => entry.id === calendarFor) ?? null;

  return (
    <>
      <View style={styles.sectionBar}>
        <Text style={styles.section}>History</Text>
        <View style={styles.actions}>
          {selectedId ? (
            <Pressable onPress={removeSelected} hitSlop={10} style={styles.actionBtn}>
              <TrashIcon />
            </Pressable>
          ) : null}
          <Pressable onPress={addRow} hitSlop={10} style={styles.actionBtn}>
            <Text style={styles.plus}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        {years.map((year) => {
          const open = openYears.includes(year);
          const rows = entries
            .filter((entry) => yearOf(entry.date) === year)
            .sort((a, b) => (a.date < b.date ? 1 : -1));
          return (
            <View key={year} style={styles.yearBlock}>
              <Pressable onPress={() => toggleYear(year)} style={styles.yearHead}>
                <Text style={styles.year}>{year}</Text>
                {open ? <ChevronUp /> : <ChevronDown />}
              </Pressable>
              {open ? (
                <View>
                  <View style={styles.tableHead}>
                    <Text style={[styles.headCell, styles.dateCol]}>Date</Text>
                    <Text style={[styles.headCell, styles.numCol]}>Amt</Text>
                    <Text style={[styles.headCell, styles.numCol]}>Px</Text>
                    <Text style={[styles.headCell, styles.fxCol]}>FX</Text>
                  </View>
                  {rows.length === 0 ? (
                    <Text style={styles.empty}>No buys yet</Text>
                  ) : (
                    rows.map((entry) => (
                      <Pressable
                        key={entry.id}
                        delayLongPress={2000}
                        onLongPress={() =>
                          setSelectedId((current) => (current === entry.id ? null : entry.id))
                        }
                        style={[styles.tableRow, selectedId === entry.id && styles.tableRowOn]}
                      >
                        <Pressable onPress={() => setCalendarFor(entry.id)} style={styles.dateCol}>
                          <Text style={styles.dateText}>{formatDayMonth(entry.date)}</Text>
                        </Pressable>
                        <Field
                          value={entry.amount}
                          onChange={(amount) => update(entry.id, { amount })}
                          style={styles.numCol}
                        />
                        <Field
                          value={entry.price}
                          onChange={(price) => update(entry.id, { price })}
                          style={styles.numCol}
                        />
                        <Field
                          value={entry.fx}
                          onChange={(fx) => update(entry.id, { fx })}
                          style={styles.fxCol}
                        />
                      </Pressable>
                    ))
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
        <Pressable style={styles.modalBg} onPress={() => setCalendarFor(null)}>
          <Pressable style={styles.calendar} onPress={() => undefined}>
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

function Field({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  style: object;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="—"
      placeholderTextColor={MUTED}
      keyboardType="decimal-pad"
      style={[styles.input, style]}
    />
  );
}

function MiniCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
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
        <Pressable
          onPress={() => setCursor(new Date(year, month - 1, 1))}
          hitSlop={8}
        >
          <Text style={styles.calNav}>‹</Text>
        </Pressable>
        <Text style={styles.calTitle}>
          {MONTHS[month]} {year}
        </Text>
        <Pressable
          onPress={() => setCursor(new Date(year, month + 1, 1))}
          hitSlop={8}
        >
          <Text style={styles.calNav}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.weekDay}>
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
              <View style={[styles.dayInner, on && styles.dayOn]}>
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ChevronDown() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
        stroke={MUTED}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronUp() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="m4.5 15.75 7.5-7.5 7.5 7.5"
        stroke={MUTED}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
        stroke={INK}
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
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  tableHead: { flexDirection: "row", alignItems: "center", paddingBottom: 4 },
  headCell: { color: MUTED, fontSize: 10, fontWeight: "600" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  tableRowOn: { backgroundColor: "#EEEEEE" },
  dateCol: { width: 58 },
  numCol: { flex: 1 },
  fxCol: { width: 48 },
  dateText: { color: INK, fontSize: 13 },
  input: { color: INK, fontSize: 13, paddingVertical: 2, paddingHorizontal: 0 },
  empty: { color: MUTED, fontSize: 12, paddingVertical: 8 },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  calendar: {
    width: 280,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
  },
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
  dayOn: { backgroundColor: INK },
  dayText: { color: INK, fontSize: 13 },
  dayTextOn: { color: "#ffffff" },
});
