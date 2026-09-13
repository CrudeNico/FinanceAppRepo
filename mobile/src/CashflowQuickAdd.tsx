import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { todayIso, toAmount } from "./assetData";
import type { CategoryGroup, CategoryItem } from "./cashflowCategories";
import { CategoryIcon } from "./categoryIcons";
import { CategoryPicker } from "./CashflowCategorySheet";
import {
  loadCashflowEntries,
  loadCategoryGroups,
  saveCashflowEntries,
} from "./db";
import { modalCenter } from "./modalCenter";
import { useTheme } from "./theme";

export function CashflowQuickAdd({
  cardId,
  visible,
  onClose,
  onSaved,
}: {
  cardId: string | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors: c } = useTheme();
  const [amount, setAmount] = useState("");
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [picked, setPicked] = useState<{ item: CategoryItem; group: CategoryGroup } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setAmount("");
      setPicked(null);
      setPickOpen(false);
      setSaving(false);
      return;
    }
    loadCategoryGroups().then(setGroups).catch(() => setGroups([]));
  }, [visible]);

  async function commit(
    nextAmount = amount,
    nextPick = picked,
    closeAfter = true,
  ) {
    const trimmed = nextAmount.trim();
    if (!cardId || !nextPick || trimmed === "" || saving) return;
    if (!Number.isFinite(Number(trimmed.replace(/\s/g, "").replace(",", ".")))) return;
    setSaving(true);
    try {
      const entries = await loadCashflowEntries(cardId);
      await saveCashflowEntries(cardId, [
        {
          id: `c${Date.now()}`,
          date: todayIso(),
          kind: nextPick.group.kind,
          amount: trimmed,
          label: nextPick.item.name,
        },
        ...entries,
      ]);
      onSaved();
      if (closeAfter) onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={[modalCenter.bg, { backgroundColor: c.overlay }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (amount.trim() && picked) commit();
              else onClose();
            }}
          />
          <Pressable style={[modalCenter.sheet, { backgroundColor: c.modal }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: c.ink }]}>Entry</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              onEndEditing={() => {
                if (picked) commit();
              }}
              onSubmitEditing={() => {
                if (picked) commit();
              }}
              placeholder="0.00"
              placeholderTextColor={c.muted}
              keyboardType={Platform.OS === "web" ? "default" : "decimal-pad"}
              inputMode="decimal"
              autoFocus
              editable={!saving}
              style={[
                styles.amount,
                { color: c.ink, backgroundColor: c.lift },
                picked && toAmount(amount) !== 0 && picked.group.kind === "expense" && styles.expense,
                picked && toAmount(amount) !== 0 && picked.group.kind === "income" && styles.income,
              ]}
            />
            <Pressable
              onPress={() => {
                if (!saving) setPickOpen(true);
              }}
              style={[styles.category, { backgroundColor: c.lift }]}
            >
              {picked ? (
                <View style={styles.categoryRow}>
                  <CategoryIcon group={picked.group} />
                  <Text style={[styles.categoryText, { color: c.ink }]} numberOfLines={1}>
                    {picked.item.name}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.categoryText, { color: c.muted }]}>Category</Text>
              )}
            </Pressable>
            {saving ? <ActivityIndicator style={styles.spin} color={c.muted} /> : null}
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      <CategoryPicker
        visible={pickOpen}
        groups={groups}
        onClose={() => setPickOpen(false)}
        onPick={(item, group) => {
          const next = { item, group };
          setPicked(next);
          setPickOpen(false);
          if (amount.trim()) commit(amount, next);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  amount: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  expense: { color: "#DC2626" },
  income: { color: "#16A34A" },
  category: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryText: { fontSize: 15 },
  spin: { marginTop: 10 },
});
