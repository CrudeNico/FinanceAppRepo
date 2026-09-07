import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { formatDayMonth, todayIso, yearOf } from "./assetData";
import type { CategoryGroup } from "./cashflowCategories";
import { CategoryManager, CategoryPicker, TagIcon } from "./CashflowCategorySheet";
import { loadCategoryGroups, saveCategoryGroups } from "./db";
import type { CashflowEntry } from "./models";
import { useTheme } from "./theme";
import { modalCenter } from "./modalCenter";
import { useRevealSwipe } from "./useRevealSwipe";

const INK = "#111111";
const MUTED = "#9CA3AF";
const LINE = "#E8E8E8";
const RED = "#DC2626";
const GREEN = "#16A34A";
const ACTION = 68;
const START_ID = "c-start";
const START_LABEL = "Starting balance";
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

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthTitle(key: string) {
  const index = Number(key.slice(5, 7)) - 1;
  return MONTHS[index] ?? key;
}

function isStart(entry: CashflowEntry) {
  return entry.id === START_ID || entry.label === START_LABEL;
}

export function CashflowHistory({
  entries,
  onChange,
  onAdded,
  ready = true,
  onSwipe,
}: {
  entries: CashflowEntry[];
  onChange: (entries: CashflowEntry[]) => void;
  onAdded?: () => void;
  ready?: boolean;
  onSwipe?: (active: boolean) => void;
}) {
  const { colors: c } = useTheme();
  const today = todayIso();
  const latestYear = Math.max(yearOf(today), ...entries.map((entry) => yearOf(entry.date)));
  const latestMonth = monthKey(
    entries.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? today,
  );
  const [openYears, setOpenYears] = useState<number[]>([latestYear]);
  const [openMonths, setOpenMonths] = useState<string[]>([latestMonth]);
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const [calendarFor, setCalendarFor] = useState<string | null>(null);
  const [itemFor, setItemFor] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [startAmount, setStartAmount] = useState("");
  const back = useLockBackGesture();
  const startRow = entries.find(isStart) ?? null;
  const rest = entries.filter((entry) => !isStart(entry));
  const askStart = ready && !startRow && rest.length === 0;

  useEffect(() => {
    loadCategoryGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => yearOf(entry.date)));
    if (set.size === 0) set.add(yearOf(today));
    return [...set].sort((a, b) => b - a);
  }, [entries, today]);

  function toggleYear(year: number) {
    setOpenYears((current) =>
      current.includes(year) ? current.filter((item) => item !== year) : [...current, year],
    );
  }

  function toggleMonth(key: string) {
    setOpenMonths((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function addRow() {
    if (!startRow || (startRow.amount ?? "").trim() === "") return;
    if (
      rest.some((entry) => (entry.label ?? "").trim() === "" || (entry.amount ?? "").trim() === "")
    ) {
      return;
    }
    const id = `c${Date.now()}`;
    const date = todayIso();
    onChange([{ id, date, kind: "expense", amount: "", label: "" }, ...entries]);
    const year = yearOf(date);
    const month = monthKey(date);
    setOpenYears((current) => (current.includes(year) ? current : [year, ...current]));
    setOpenMonths((current) => (current.includes(month) ? current : [month, ...current]));
    setOpenSwipe(null);
    onAdded?.();
  }

  function update(id: string, patch: Partial<CashflowEntry>) {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function remove(id: string) {
    if (id === START_ID || entries.some((entry) => entry.id === id && isStart(entry))) return;
    onChange(entries.filter((entry) => entry.id !== id));
    setOpenSwipe(null);
  }

  function confirmStart() {
    const amount = startAmount.trim();
    if (amount === "") return;
    onChange([
      {
        id: START_ID,
        date: todayIso(),
        kind: "income",
        amount,
        label: START_LABEL,
      },
      ...rest,
    ]);
    setStartAmount("");
    const date = todayIso();
    setOpenYears((current) =>
      current.includes(yearOf(date)) ? current : [yearOf(date), ...current],
    );
    setOpenMonths((current) =>
      current.includes(monthKey(date)) ? current : [monthKey(date), ...current],
    );
  }

  const calendarEntry = entries.find((entry) => entry.id === calendarFor) ?? null;

  return (
    <>
      <View style={styles.sectionBar}>
        <Text style={[styles.section, { color: c.ink }]}>History</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => setManageOpen(true)} hitSlop={10}>
            <TagIcon />
          </Pressable>
          <Pressable onPress={addRow} hitSlop={10}>
            <Text style={[styles.plus, { color: c.ink }]}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
        {askStart
          ? null
          : years.map((year) => {
          const yearOpen = openYears.includes(year);
          const yearRows = entries.filter((entry) => yearOf(entry.date) === year);
          const months = [
            ...new Set(yearRows.map((entry) => monthKey(entry.date))),
          ].sort((a, b) => (a < b ? 1 : -1));
          return (
            <View key={year} style={styles.yearBlock}>
              <Pressable onPress={() => toggleYear(year)} style={styles.yearHead}>
                <Text style={[styles.year, { color: c.ink }]}>{year}</Text>
                {yearOpen ? <ChevronUp /> : <ChevronDown />}
              </Pressable>
              {yearOpen
                ? months.length === 0
                  ? <Text style={[styles.empty, { color: c.muted }]}>No months yet</Text>
                  : months.map((month) => {
                      const monthOpen = openMonths.includes(month);
                      const rows = yearRows
                        .filter((entry) => monthKey(entry.date) === month)
                        .sort((a, b) => {
                          if (isStart(a) !== isStart(b)) return isStart(a) ? 1 : -1;
                          const byDate = b.date.localeCompare(a.date);
                          if (byDate !== 0) return byDate;
                          return b.id.localeCompare(a.id);
                        });
                      return (
                        <View key={month} style={styles.monthBlock}>
                          <Pressable onPress={() => toggleMonth(month)} style={styles.monthHead}>
                            <Text style={[styles.monthName, { color: c.ink }]}>{monthTitle(month)}</Text>
                            {monthOpen ? <ChevronUp /> : <ChevronDown />}
                          </Pressable>
                          {monthOpen ? (
                            <View
                              style={[styles.table, { borderColor: c.line }]}
                              onTouchStart={back.lock}
                              onTouchEnd={back.unlock}
                              onTouchCancel={back.unlock}
                            >
                              <View style={[styles.tableHead, { backgroundColor: c.table, borderBottomColor: c.line }]}>
                                <Text style={[styles.headCell, styles.dateCol, { color: c.muted }]}>Date</Text>
                                <Text style={[styles.headCell, styles.itemCol, styles.colLine, { color: c.muted, borderLeftColor: c.line }]}>
                                  Category
                                </Text>
                                <Text style={[styles.headCell, styles.amtCol, styles.colLine, { color: c.muted, borderLeftColor: c.line }]}>
                                  Amt
                                </Text>
                              </View>
                              {rows.map((entry, index) => (
                                <FlowRow
                                  key={entry.id}
                                  entry={entry}
                                  last={index === rows.length - 1}
                                  locked={isStart(entry)}
                                  open={openSwipe === entry.id}
                                  onOpen={() => setOpenSwipe(entry.id)}
                                  onClose={() =>
                                    setOpenSwipe((current) =>
                                      current === entry.id ? null : current,
                                    )
                                  }
                                  onDelete={() => remove(entry.id)}
                                  onDate={() => setCalendarFor(entry.id)}
                                  onAmount={(amount) => update(entry.id, { amount })}
                                  onItem={() => setItemFor(entry.id)}
                                  onSwipe={onSwipe}
                                />
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                : null}
            </View>
          );
        })}
      </View>

      <Modal visible={askStart} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[modalCenter.bg, { backgroundColor: c.overlay }]}
        >
          <View>
            <View style={[modalCenter.sheet, { backgroundColor: c.modal }]}>
              <Text style={[styles.sheetTitle, { color: c.ink }]}>What is your starting balance?</Text>
              <Text style={[styles.fieldLabel, { color: c.muted }]}>Amount</Text>
              <TextInput
                value={startAmount}
                onChangeText={setStartAmount}
                placeholder="0"
                placeholderTextColor={c.muted}
                keyboardType="decimal-pad"
                autoFocus
                style={[styles.fieldInput, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
              />
              <Pressable style={[styles.doneBtn, { backgroundColor: c.ink }]} onPress={confirmStart}>
                <Text style={[styles.doneText, { color: c.bg }]}>Add</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                  const month = monthKey(date);
                  setOpenYears((current) => (current.includes(year) ? current : [...current, year]));
                  setOpenMonths((current) =>
                    current.includes(month) ? current : [...current, month],
                  );
                }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <CategoryPicker
        visible={Boolean(itemFor)}
        groups={groups}
        onClose={() => setItemFor(null)}
        onPick={(item, group) => {
          if (!itemFor) return;
          update(itemFor, { label: item.name, kind: group.kind });
        }}
      />

      <CategoryManager
        visible={manageOpen}
        groups={groups}
        onChange={(next) => {
          setGroups(next);
          saveCategoryGroups(next).catch(() => undefined);
        }}
        onClose={() => setManageOpen(false)}
      />
    </>
  );
}

function FlowRow({
  entry,
  last,
  locked,
  open,
  onOpen,
  onClose,
  onDelete,
  onDate,
  onAmount,
  onItem,
  onSwipe,
}: {
  entry: CashflowEntry;
  last: boolean;
  locked?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDate: () => void;
  onAmount: (amount: string) => void;
  onItem: () => void;
  onSwipe?: (active: boolean) => void;
}) {
  const { colors: c } = useTheme();
  const back = useLockBackGesture();
  const amountRef = useRef<TextInput>(null);
  const { pan, handlers, style: swipeStyle, nodeRef } = useRevealSwipe({
    open,
    enabled: !locked,
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
      if (x < 62) onDate();
      else if (x < 220) onItem();
      else amountRef.current?.focus();
    },
  });

  const empty = (entry.amount ?? "").trim() === "";

  return (
    <View style={[styles.rowWrap, !last && styles.rowLine, !last && { borderBottomColor: c.line }]}>
      <Animated.View
        style={[styles.tableRow, { backgroundColor: c.card, transform: [{ translateX: pan }] }, swipeStyle]}
      >
        <Pressable onPress={open ? onClose : onDate} style={styles.dateCol}>
          <Text style={[styles.dateText, { color: c.ink }]}>{formatDayMonth(entry.date)}</Text>
        </Pressable>
        <Pressable
          onPress={locked ? undefined : open ? onClose : onItem}
          style={[styles.itemCol, styles.colLine, styles.itemCell, { borderLeftColor: c.line }]}
        >
          <Text style={[styles.itemLabel, { color: entry.label ? c.ink : c.muted }]}>
            {entry.label || "—"}
          </Text>
        </Pressable>
        <TextInput
          ref={amountRef}
          value={entry.amount}
          onChangeText={onAmount}
          placeholder="—"
          placeholderTextColor={c.muted}
          keyboardType="decimal-pad"
          editable={!open}
          style={[
            styles.amtCol,
            styles.colLine,
            styles.amtInput,
            { color: c.ink, borderLeftColor: c.line },
            !empty && entry.kind === "expense" && styles.amtExpense,
            !empty && entry.kind === "income" && styles.amtIncome,
          ]}
        />
        {locked ? null : (
          <View
            ref={nodeRef}
            collapsable={false}
            style={[StyleSheet.absoluteFill, swipeStyle]}
            {...handlers}
          />
        )}
      </Animated.View>
      {locked ? null : (
      <View style={styles.deleteLane} pointerEvents={open ? "auto" : "none"}>
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <TrashIcon />
        </Pressable>
      </View>
      )}
    </View>
  );
}

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

function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
        stroke="#ffffff"
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
  monthBlock: { paddingLeft: 4, paddingBottom: 4 },
  monthHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  monthName: { color: INK, fontSize: 14 },
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
    zIndex: 2,
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
    minHeight: 36,
    backgroundColor: "#ffffff",
  },
  colLine: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: LINE,
  },
  dateCol: { width: 62, paddingHorizontal: 6, justifyContent: "center" },
  itemCol: { flex: 1 },
  amtCol: { width: 72 },
  dateText: { color: INK, fontSize: 13 },
  itemCell: { justifyContent: "center", paddingVertical: 8, paddingHorizontal: 6 },
  itemLabel: { color: INK, fontSize: 13 },
  itemEmpty: { color: MUTED },
  amtInput: {
    color: INK,
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 6,
    textAlign: "left",
  },
  amtIncome: { color: GREEN },
  amtExpense: { color: RED },
  empty: { color: MUTED, fontSize: 12, paddingVertical: 8, paddingHorizontal: 8 },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
  },
  modalFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: {
    width: 280,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
  },
  sheetTitle: { color: INK, fontSize: 15, marginBottom: 12, textAlign: "center" },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  typeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  typeOn: { backgroundColor: INK, borderColor: INK },
  typeText: { color: INK, fontSize: 13 },
  typeOnText: { color: "#ffffff" },
  fieldLabel: { color: MUTED, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  fieldInput: {
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
