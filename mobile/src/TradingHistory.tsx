import { useMemo, useState } from "react";
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
import type { TradeRow } from "./models";
import { formatCompact } from "./assetData";
import { useTheme } from "./theme";
import { modalCenter } from "./modalCenter";
import { useLockBackGesture } from "./useLockBackGesture";
import { useRevealSwipe } from "./useRevealSwipe";

const INK = "#111111";
const MUTED = "#9CA3AF";
const LINE = "#E8E8E8";
const RED = "#DC2626";
const ACTION = 68;
const START_ID = "t-start";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type { TradeRow };

function todayMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function yearOf(month: string) {
  return Number(month.slice(0, 4));
}

function monthLabel(month: string) {
  const index = Number(month.slice(5, 7)) - 1;
  return MONTHS[index] ?? month;
}

function isStart(entry: TradeRow) {
  return entry.id === START_ID;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function netLabel(positive: string, negative: string) {
  const empty = positive.trim() === "" && negative.trim() === "";
  if (empty) return "—";
  const net = toNumber(positive) - toNumber(negative);
  if (net < 0) return `−${formatCompact(Math.abs(net))}`;
  return formatCompact(net);
}

function profitLabel(entry: TradeRow) {
  return netLabel(entry.gain, entry.loss);
}

function flowLabel(entry: TradeRow) {
  return netLabel(entry.deposit, entry.withdrawal);
}

export function TradingHistory({
  entries,
  onChange,
  onAdded,
  ready = true,
  onSwipe,
}: {
  entries: TradeRow[];
  onChange: (entries: TradeRow[]) => void;
  onAdded?: () => void;
  ready?: boolean;
  onSwipe?: (active: boolean) => void;
}) {
  const { colors: c } = useTheme();
  const latestYear = Math.max(2026, ...entries.map((entry) => yearOf(entry.month)));
  const [openYears, setOpenYears] = useState<number[]>([latestYear]);
  const [monthFor, setMonthFor] = useState<string | null>(null);
  const [flowFor, setFlowFor] = useState<string | null>(null);
  const [profitFor, setProfitFor] = useState<string | null>(null);
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const [swipeOn, setSwipeOn] = useState(true);
  const [startAmount, setStartAmount] = useState("");
  const back = useLockBackGesture();
  const startRow = entries.find(isStart) ?? null;
  const rest = entries.filter((entry) => !isStart(entry));
  const askStart = ready && !startRow && rest.length === 0;

  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => yearOf(entry.month)));
    set.add(2026);
    return [...set].sort((a, b) => b - a);
  }, [entries]);

  const endings = useMemo(() => {
    const chronological = [...entries].sort((a, b) => {
      const byMonth = a.month.localeCompare(b.month);
      if (byMonth !== 0) return byMonth;
      if (isStart(a) !== isStart(b)) return isStart(a) ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    const map: Record<string, number> = {};
    let running = 0;
    chronological.forEach((entry) => {
      running +=
        toNumber(entry.gain) -
        toNumber(entry.loss) +
        toNumber(entry.deposit) -
        toNumber(entry.withdrawal);
      map[entry.id] = running;
    });
    return map;
  }, [entries]);

  function toggleYear(year: number) {
    setOpenYears((current) =>
      current.includes(year) ? current.filter((item) => item !== year) : [...current, year],
    );
  }

  function monthComplete(entry: TradeRow) {
    if (isStart(entry)) return entry.deposit.trim() !== "";
    const profitDone = entry.gain.trim() !== "" || entry.loss.trim() !== "";
    const flowDone = entry.deposit.trim() !== "" || entry.withdrawal.trim() !== "";
    return profitDone && flowDone;
  }

  function addRow() {
    if (!startRow || (startRow.deposit ?? "").trim() === "") return;
    if (rest.some((entry) => !monthComplete(entry))) return;
    const month = todayMonth();
    if (rest.some((entry) => entry.month === month)) return;
    const id = `t${Date.now()}`;
    onChange([
      { id, month, gain: "", loss: "", deposit: "", withdrawal: "" },
      ...entries,
    ]);
    const year = yearOf(month);
    setOpenYears((current) => (current.includes(year) ? current : [year, ...current]));
    setOpenSwipe(null);
    setSwipeOn(false);
    setTimeout(() => setSwipeOn(true), 400);
    onAdded?.();
  }

  function update(id: string, patch: Partial<TradeRow>) {
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
    const month = todayMonth();
    onChange([
      {
        id: START_ID,
        month,
        gain: "",
        loss: "",
        deposit: amount,
        withdrawal: "",
      },
      ...rest,
    ]);
    setStartAmount("");
    const year = yearOf(month);
    setOpenYears((current) => (current.includes(year) ? current : [year, ...current]));
  }

  const picker = entries.find((entry) => entry.id === monthFor) ?? null;
  const flowRow = entries.find((entry) => entry.id === flowFor) ?? null;
  const profitRow = entries.find((entry) => entry.id === profitFor) ?? null;

  return (
    <>
      <View style={styles.sectionBar}>
        <Text style={[styles.section, { color: c.ink }]}>History</Text>
        <Pressable onPress={addRow} hitSlop={10}>
          <Text style={[styles.plus, { color: c.ink }]}>+</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
        {askStart
          ? null
          : years.map((year) => {
          const open = openYears.includes(year);
          const rows = entries
            .filter((entry) => yearOf(entry.month) === year)
            .sort((a, b) => {
              const byMonth = b.month.localeCompare(a.month);
              if (byMonth !== 0) return byMonth;
              if (isStart(a) !== isStart(b)) return isStart(a) ? 1 : -1;
              return b.id.localeCompare(a.id);
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
                    <Text style={[styles.headCell, styles.monthCol, { color: c.muted }]}>Mo</Text>
                    <Text style={[styles.headCell, styles.numCol, styles.colLine, { color: c.muted, borderLeftColor: c.line }]}>P/L</Text>
                    <Text style={[styles.headCell, styles.numCol, styles.colLine, { color: c.muted, borderLeftColor: c.line }]}>D/W</Text>
                    <Text style={[styles.headCell, styles.endCol, styles.colLine, { color: c.muted, borderLeftColor: c.line }]}>End</Text>
                  </View>
                  {rows.length === 0 ? (
                    <Text style={[styles.empty, { color: c.muted }]}>No months yet</Text>
                  ) : (
                    rows.map((entry, index) => (
                      <TradeHistoryRow
                        key={entry.id}
                        entry={entry}
                        end={endings[entry.id] != null ? formatCompact(endings[entry.id]) : "0.00"}
                        last={index === rows.length - 1}
                        locked={isStart(entry)}
                        enabled={swipeOn}
                        open={openSwipe === entry.id}
                        onOpen={() => setOpenSwipe(entry.id)}
                        onClose={() =>
                          setOpenSwipe((current) => (current === entry.id ? null : current))
                        }
                        onDelete={() => remove(entry.id)}
                        onMonth={() => setMonthFor(entry.id)}
                        onProfit={() => {
                          if (!isStart(entry)) setProfitFor(entry.id);
                        }}
                        onFlow={() => setFlowFor(entry.id)}
                        onSwipe={onSwipe}
                      />
                    ))
                  )}
                </View>
              ) : null}
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
        visible={Boolean(profitRow)}
        transparent
        animationType="fade"
        onRequestClose={() => setProfitFor(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[modalCenter.bg, { backgroundColor: c.overlay }]}
        >
          <Pressable style={modalCenter.bg} onPress={() => setProfitFor(null)}>
            <Pressable style={[modalCenter.sheet, { backgroundColor: c.modal }]} onPress={() => undefined}>
              <Text style={[styles.pickerTitle, { color: c.ink }]}>Profit / Loss</Text>
              <View style={styles.flowFields}>
                <View style={styles.flowField}>
                  <Text style={[styles.flowLabel, { color: c.muted }]}>Gain</Text>
                  <TextInput
                    value={profitRow?.gain ?? ""}
                    onChangeText={(gain) => {
                      if (profitRow) update(profitRow.id, { gain });
                    }}
                    placeholder="0"
                    placeholderTextColor={c.muted}
                    keyboardType="decimal-pad"
                    style={[styles.flowInput, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
                  />
                </View>
                <View style={styles.flowField}>
                  <Text style={[styles.flowLabel, { color: c.muted }]}>Loss</Text>
                  <TextInput
                    value={profitRow?.loss ?? ""}
                    onChangeText={(loss) => {
                      if (profitRow) update(profitRow.id, { loss });
                    }}
                    placeholder="0"
                    placeholderTextColor={c.muted}
                    keyboardType="decimal-pad"
                    style={[styles.flowInput, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
                  />
                </View>
              </View>
              <Pressable style={[styles.doneBtn, { backgroundColor: c.ink }]} onPress={() => setProfitFor(null)}>
                <Text style={[styles.doneText, { color: c.bg }]}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(flowRow)}
        transparent
        animationType="fade"
        onRequestClose={() => setFlowFor(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[modalCenter.bg, { backgroundColor: c.overlay }]}
        >
        <Pressable style={modalCenter.bg} onPress={() => setFlowFor(null)}>
          <Pressable style={[modalCenter.sheet, { backgroundColor: c.modal }]} onPress={() => undefined}>
            <Text style={[styles.pickerTitle, { color: c.ink }]}>Deposit / Withdrawal</Text>
            <View style={styles.flowFields}>
              <View style={styles.flowField}>
                <Text style={[styles.flowLabel, { color: c.muted }]}>Deposit</Text>
                <TextInput
                  value={flowRow?.deposit ?? ""}
                  onChangeText={(deposit) => {
                    if (flowRow) update(flowRow.id, { deposit });
                  }}
                  placeholder="0"
                  placeholderTextColor={c.muted}
                  keyboardType="decimal-pad"
                  style={[styles.flowInput, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
                />
              </View>
              <View style={styles.flowField}>
                <Text style={[styles.flowLabel, { color: c.muted }]}>Withdrawal</Text>
                <TextInput
                  value={flowRow?.withdrawal ?? ""}
                  onChangeText={(withdrawal) => {
                    if (flowRow) update(flowRow.id, { withdrawal });
                  }}
                  placeholder="0"
                  placeholderTextColor={c.muted}
                  keyboardType="decimal-pad"
                  style={[styles.flowInput, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
                />
              </View>
            </View>
            <Pressable style={[styles.doneBtn, { backgroundColor: c.ink }]} onPress={() => setFlowFor(null)}>
              <Text style={[styles.doneText, { color: c.bg }]}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(picker)}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthFor(null)}
      >
        <Pressable style={[modalCenter.bg, { backgroundColor: c.overlay }]} onPress={() => setMonthFor(null)}>
          <Pressable style={[modalCenter.sheet, { backgroundColor: c.modal }]} onPress={() => undefined}>
            <Text style={[styles.pickerTitle, { color: c.ink }]}>Month</Text>
            <View style={styles.monthGrid}>
              {MONTHS.map((label, index) => {
                const value = `${picker ? yearOf(picker.month) : latestYear}-${String(index + 1).padStart(2, "0")}`;
                const on = picker?.month === value;
                return (
                  <Pressable
                    key={label}
                    onPress={() => {
                      if (picker) update(picker.id, { month: value });
                      setMonthFor(null);
                    }}
                    style={[styles.monthCell, { borderColor: c.line }, on && { backgroundColor: c.ink, borderColor: c.ink }]}
                  >
                    <Text style={[styles.monthCellText, { color: on ? c.bg : c.ink }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function TradeHistoryRow({
  entry,
  end,
  last,
  locked,
  enabled,
  open,
  onOpen,
  onClose,
  onDelete,
  onMonth,
  onProfit,
  onFlow,
  onSwipe,
}: {
  entry: TradeRow;
  end: string;
  last: boolean;
  locked?: boolean;
  enabled: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onMonth: () => void;
  onProfit: () => void;
  onFlow: () => void;
  onSwipe?: (active: boolean) => void;
}) {
  const { colors: c } = useTheme();
  const back = useLockBackGesture();
  const { pan, handlers, style: swipeStyle, nodeRef } = useRevealSwipe({
    open,
    enabled: enabled && !locked,
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
      if (x < 52) onMonth();
      else if (x < 160) {
        if (!locked) onProfit();
      } else onFlow();
    },
  });

  return (
    <View style={[styles.rowWrap, !last && styles.rowLine, !last && { borderBottomColor: c.line }]}>
      {locked ? null : (
      <View style={styles.deleteLane} pointerEvents={open ? "auto" : "none"}>
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <TrashIcon color="#ffffff" />
        </Pressable>
      </View>
      )}
      <Animated.View
        style={[
          styles.tableRow,
          { backgroundColor: c.card, transform: [{ translateX: pan }] },
          swipeStyle,
        ]}
      >
        <Pressable onPress={open ? onClose : onMonth} style={styles.monthCol}>
          <Text style={[styles.monthText, { color: c.ink }]}>{monthLabel(entry.month)}</Text>
        </Pressable>
        <Pressable
          onPress={locked ? undefined : open ? onClose : onProfit}
          style={[styles.numCol, styles.colLine, styles.flowCell, { borderLeftColor: c.line }]}
        >
          <Text style={[styles.flowText, { color: profitLabel(entry) === "—" ? c.muted : c.ink }]}>
            {profitLabel(entry)}
          </Text>
        </Pressable>
        <Pressable
          onPress={open ? onClose : onFlow}
          style={[styles.numCol, styles.colLine, styles.flowCell, { borderLeftColor: c.line }]}
        >
          <Text style={[styles.flowText, { color: flowLabel(entry) === "—" ? c.muted : c.ink }]}>
            {flowLabel(entry)}
          </Text>
        </Pressable>
        <Text style={[styles.endText, styles.endCol, styles.colLine, { color: c.ink, borderLeftColor: c.line }]}>{end}</Text>
        {locked ? null : (
        <View
          ref={nodeRef}
          collapsable={false}
          style={[StyleSheet.absoluteFill, swipeStyle]}
          {...handlers}
        />
        )}
      </Animated.View>
    </View>
  );
}

function TrashIcon({ color = "#ffffff" }: { color?: string }) {
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

const styles = StyleSheet.create({
  sectionBar: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: { color: INK, fontSize: 17, fontWeight: "400" },
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
    minHeight: 36,
    backgroundColor: "#ffffff",
    zIndex: 1,
  },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  colLine: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: LINE,
  },
  monthCol: { width: 52, paddingHorizontal: 6, justifyContent: "center" },
  numCol: { flex: 1 },
  endCol: { width: 64 },
  monthText: { color: INK, fontSize: 13 },
  input: { color: INK, fontSize: 13, paddingVertical: 8, paddingHorizontal: 6 },
  flowCell: { justifyContent: "center", paddingVertical: 8, paddingHorizontal: 6 },
  flowText: { color: INK, fontSize: 12 },
  flowEmpty: { color: MUTED },
  modalFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  flowFields: { gap: 10 },
  flowField: { gap: 4 },
  flowLabel: { color: MUTED, fontSize: 11, fontWeight: "600" },
  flowInput: {
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
  sheetTitle: { color: INK, fontSize: 15, marginBottom: 12, textAlign: "center" },
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
  endText: { color: INK, fontSize: 13, paddingHorizontal: 6, paddingVertical: 8 },
  empty: { color: MUTED, fontSize: 12, paddingVertical: 8, paddingHorizontal: 8 },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
  },
  picker: {
    width: 280,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
  },
  pickerTitle: { color: INK, fontSize: 15, marginBottom: 10, textAlign: "center" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  monthCell: {
    width: "25%",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  monthOn: { backgroundColor: INK },
  monthCellText: { color: INK, fontSize: 13 },
  monthOnText: { color: "#ffffff" },
});
