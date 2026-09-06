import { useMemo, useState } from "react";
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
import Svg, { Path } from "react-native-svg";

const INK = "#111111";
const MUTED = "#9CA3AF";
const LINE = "#E8E8E8";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type TradeRow = {
  id: string;
  month: string;
  gain: string;
  loss: string;
  deposit: string;
  withdrawal: string;
};

const INITIAL: TradeRow[] = [
  { id: "t1", month: "2026-08", gain: "120", loss: "", deposit: "500", withdrawal: "" },
  { id: "t2", month: "2026-07", gain: "80", loss: "", deposit: "", withdrawal: "" },
];

function yearOf(month: string) {
  return Number(month.slice(0, 4));
}

function monthLabel(month: string) {
  const index = Number(month.slice(5, 7)) - 1;
  return MONTHS[index] ?? month;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function netLabel(positive: string, negative: string) {
  const empty = positive.trim() === "" && negative.trim() === "";
  if (empty) return "—";
  const net = toNumber(positive) - toNumber(negative);
  if (net < 0) return `−${Math.abs(net)}`;
  return String(net);
}

function profitLabel(entry: TradeRow) {
  return netLabel(entry.gain, entry.loss);
}

function flowLabel(entry: TradeRow) {
  return netLabel(entry.deposit, entry.withdrawal);
}

export function TradingHistory({ onAdded }: { onAdded?: () => void }) {
  const [entries, setEntries] = useState<TradeRow[]>(INITIAL);
  const latestYear = Math.max(2026, ...entries.map((entry) => yearOf(entry.month)));
  const [openYears, setOpenYears] = useState<number[]>([latestYear]);
  const [monthFor, setMonthFor] = useState<string | null>(null);
  const [flowFor, setFlowFor] = useState<string | null>(null);
  const [profitFor, setProfitFor] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => yearOf(entry.month)));
    set.add(2026);
    return [...set].sort((a, b) => b - a);
  }, [entries]);

  const endings = useMemo(() => {
    const chronological = [...entries].sort((a, b) => a.month.localeCompare(b.month));
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

  function addRow() {
    const id = `t${Date.now()}`;
    setEntries((current) => [
      { id, month: "2026-09", gain: "", loss: "", deposit: "", withdrawal: "" },
      ...current,
    ]);
    setOpenYears((current) => (current.includes(latestYear) ? current : [latestYear, ...current]));
    onAdded?.();
  }

  function update(id: string, patch: Partial<TradeRow>) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  const picker = entries.find((entry) => entry.id === monthFor) ?? null;
  const flowRow = entries.find((entry) => entry.id === flowFor) ?? null;
  const profitRow = entries.find((entry) => entry.id === profitFor) ?? null;

  return (
    <>
      <View style={styles.sectionBar}>
        <Text style={styles.section}>History</Text>
        <Pressable onPress={addRow} hitSlop={10}>
          <Text style={styles.plus}>+</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {years.map((year) => {
          const open = openYears.includes(year);
          const rows = entries
            .filter((entry) => yearOf(entry.month) === year)
            .sort((a, b) => (a.month < b.month ? 1 : -1));
          return (
            <View key={year} style={styles.yearBlock}>
              <Pressable onPress={() => toggleYear(year)} style={styles.yearHead}>
                <Text style={styles.year}>{year}</Text>
                {open ? <ChevronUp /> : <ChevronDown />}
              </Pressable>
              {open ? (
                <View style={styles.table}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.headCell, styles.monthCol]}>Mo</Text>
                    <Text style={[styles.headCell, styles.numCol, styles.colLine]}>P/L</Text>
                    <Text style={[styles.headCell, styles.numCol, styles.colLine]}>D/W</Text>
                    <Text style={[styles.headCell, styles.endCol, styles.colLine]}>End</Text>
                  </View>
                  {rows.length === 0 ? (
                    <Text style={styles.empty}>No months yet</Text>
                  ) : (
                    rows.map((entry, index) => (
                      <View
                        key={entry.id}
                        style={[styles.tableRow, index < rows.length - 1 && styles.rowLine]}
                      >
                        <Pressable onPress={() => setMonthFor(entry.id)} style={styles.monthCol}>
                          <Text style={styles.monthText}>{monthLabel(entry.month)}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setProfitFor(entry.id)}
                          style={[styles.numCol, styles.colLine, styles.flowCell]}
                        >
                          <Text
                            style={[
                              styles.flowText,
                              profitLabel(entry) === "—" && styles.flowEmpty,
                            ]}
                          >
                            {profitLabel(entry)}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setFlowFor(entry.id)}
                          style={[styles.numCol, styles.colLine, styles.flowCell]}
                        >
                          <Text
                            style={[
                              styles.flowText,
                              flowLabel(entry) === "—" && styles.flowEmpty,
                            ]}
                          >
                            {flowLabel(entry)}
                          </Text>
                        </Pressable>
                        <Text style={[styles.endText, styles.endCol, styles.colLine]}>
                          {endings[entry.id]?.toFixed(2) ?? "0.00"}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Modal
        visible={Boolean(profitRow)}
        transparent
        animationType="fade"
        onRequestClose={() => setProfitFor(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBg}
        >
          <Pressable style={styles.modalFill} onPress={() => setProfitFor(null)}>
            <Pressable style={styles.picker} onPress={() => undefined}>
              <Text style={styles.pickerTitle}>Profit / Loss</Text>
              <View style={styles.flowFields}>
                <View style={styles.flowField}>
                  <Text style={styles.flowLabel}>Gain</Text>
                  <TextInput
                    value={profitRow?.gain ?? ""}
                    onChangeText={(gain) => {
                      if (profitRow) update(profitRow.id, { gain });
                    }}
                    placeholder="0"
                    placeholderTextColor={MUTED}
                    keyboardType="decimal-pad"
                    style={styles.flowInput}
                  />
                </View>
                <View style={styles.flowField}>
                  <Text style={styles.flowLabel}>Loss</Text>
                  <TextInput
                    value={profitRow?.loss ?? ""}
                    onChangeText={(loss) => {
                      if (profitRow) update(profitRow.id, { loss });
                    }}
                    placeholder="0"
                    placeholderTextColor={MUTED}
                    keyboardType="decimal-pad"
                    style={styles.flowInput}
                  />
                </View>
              </View>
              <Pressable style={styles.doneBtn} onPress={() => setProfitFor(null)}>
                <Text style={styles.doneText}>Done</Text>
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
          style={styles.modalBg}
        >
        <Pressable style={styles.modalFill} onPress={() => setFlowFor(null)}>
          <Pressable style={styles.picker} onPress={() => undefined}>
            <Text style={styles.pickerTitle}>Deposit / Withdrawal</Text>
            <View style={styles.flowFields}>
              <View style={styles.flowField}>
                <Text style={styles.flowLabel}>Deposit</Text>
                <TextInput
                  value={flowRow?.deposit ?? ""}
                  onChangeText={(deposit) => {
                    if (flowRow) update(flowRow.id, { deposit });
                  }}
                  placeholder="0"
                  placeholderTextColor={MUTED}
                  keyboardType="decimal-pad"
                  style={styles.flowInput}
                />
              </View>
              <View style={styles.flowField}>
                <Text style={styles.flowLabel}>Withdrawal</Text>
                <TextInput
                  value={flowRow?.withdrawal ?? ""}
                  onChangeText={(withdrawal) => {
                    if (flowRow) update(flowRow.id, { withdrawal });
                  }}
                  placeholder="0"
                  placeholderTextColor={MUTED}
                  keyboardType="decimal-pad"
                  style={styles.flowInput}
                />
              </View>
            </View>
            <Pressable style={styles.doneBtn} onPress={() => setFlowFor(null)}>
              <Text style={styles.doneText}>Done</Text>
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
        <Pressable style={[styles.modalBg, styles.modalFill]} onPress={() => setMonthFor(null)}>
          <Pressable style={styles.picker} onPress={() => undefined}>
            <Text style={styles.pickerTitle}>Month</Text>
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
                    style={[styles.monthCell, on && styles.monthOn]}
                  >
                    <Text style={[styles.monthCellText, on && styles.monthOnText]}>{label}</Text>
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
  tableRow: { flexDirection: "row", alignItems: "center", minHeight: 36 },
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
