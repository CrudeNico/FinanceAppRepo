import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { CategoryIcon } from "./categoryIcons";
import { DraftLooks, PALETTE_COLORS } from "./categoryPalettes";
import type { CategoryGroup, CategoryItem, CategoryKind } from "./cashflowCategories";
import { useTheme } from "./theme";

const INK = "#111111";
const MUTED = "#9CA3AF";
const LINE = "#E8E8E8";

function revealBlock(
  block: View | null,
  box: View | null,
  scroll: ScrollView | null,
  offset: number,
) {
  if (!block || !box || !scroll) return;
  block.measureInWindow((_x, y, _w, h) => {
    box.measureInWindow((_sx, sy, _sw, sh) => {
      const gap = 8;
      const top = sy + gap;
      const bottom = sy + sh - gap;
      if (y >= top && y + h <= bottom) return;
      let delta = 0;
      if (y + h > bottom) delta = y + h - bottom;
      else if (y < top) delta = y - top;
      if (Math.abs(delta) < 2) return;
      scroll.scrollTo({ y: Math.max(0, offset + delta), animated: true });
    });
  });
}

export function TagIcon() {
  const { colors: c } = useTheme();
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
        stroke={c.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 6h.008v.008H6V6Z"
        stroke={c.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CategoryPicker({
  visible,
  groups,
  onClose,
  onPick,
}: {
  visible: boolean;
  groups: CategoryGroup[];
  onClose: () => void;
  onPick: (item: CategoryItem, group: CategoryGroup) => void;
}) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollBoxRef = useRef<View>(null);
  const scrollY = useRef(0);
  const groupRefs = useRef<Record<string, View | null>>({});
  const pendingReveal = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) setOpen(null);
  }, [visible]);

  function toggleGroup(id: string) {
    if (open === id) {
      pendingReveal.current = null;
      setOpen(null);
      return;
    }
    pendingReveal.current = id;
    setOpen(id);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalBg, { backgroundColor: c.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.modal }]}>
          <Text style={[styles.title, { color: c.ink }]}>Category</Text>
          <View ref={scrollBoxRef} collapsable={false}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {groups
              .filter((group) => group.saved !== false)
              .map((group) => {
              const expanded = open === group.id;
              return (
                <View
                  key={group.id}
                  ref={(node) => {
                    groupRefs.current[group.id] = node;
                  }}
                  collapsable={false}
                  onLayout={() => {
                    if (pendingReveal.current !== group.id) return;
                    pendingReveal.current = null;
                    revealBlock(
                      groupRefs.current[group.id],
                      scrollBoxRef.current,
                      scrollRef.current,
                      scrollY.current,
                    );
                  }}
                >
                  <Pressable
                    onPress={() => toggleGroup(group.id)}
                    style={styles.groupHead}
                  >
                    {expanded ? <ChevronUp /> : <ChevronDown />}
                    <CategoryIcon group={group} />
                    <Text style={[styles.groupName, { color: c.ink }]}>{group.name}</Text>
                  </Pressable>
                  {expanded
                    ? group.items.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            onPick(item, group);
                            onClose();
                          }}
                          style={styles.itemRow}
                        >
                          <Text style={[styles.itemName, { color: c.ink }]}>{item.name}</Text>
                        </Pressable>
                      ))
                    : null}
                </View>
              );
            })}
          </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function CategoryManager({
  visible,
  groups,
  onChange,
  onClose,
}: {
  visible: boolean;
  groups: CategoryGroup[];
  onChange: (groups: CategoryGroup[]) => void;
  onClose: () => void;
}) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const [lockScroll, setLockScroll] = useState(false);
  const [keyboardH, setKeyboardH] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollBoxRef = useRef<View>(null);
  const scrollY = useRef(0);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const groupRefs = useRef<Record<string, View | null>>({});
  const pendingReveal = useRef<string | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setKeyboardH(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardH(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function revealInput(input: TextInput | null) {
    if (!input) return;
    const run = () => {
      input.measureInWindow((_x, y, _w, h) => {
        scrollBoxRef.current?.measureInWindow((_sx, sy, _sw, sh) => {
          const gap = 12;
          let delta = 0;
          if (y + h > sy + sh - gap) delta = y + h - (sy + sh - gap);
          else if (y < sy + gap) delta = y - (sy + gap);
          if (delta === 0) return;
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollY.current + delta),
            animated: true,
          });
        });
      });
    };
    setTimeout(run, keyboardH > 0 ? 50 : 280);
  }

  function updateGroup(id: string, patch: Partial<CategoryGroup>) {
    onChange(groups.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  }

  function updateItem(groupId: string, itemId: string, name: string) {
    onChange(
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: group.items.map((item) => (item.id === itemId ? { ...item, name } : item)),
            }
          : group,
      ),
    );
  }

  function addGroup() {
    if (groups.some((group) => group.saved === false)) return;
    const id = `g${Date.now()}`;
    onChange([
      {
        id,
        name: "",
        kind: "expense",
        icon: "pricetag-outline",
        color: PALETTE_COLORS[0] ?? "#DC2626",
        saved: false,
        items: [],
      },
      ...groups,
    ]);
    setOpen(id);
    setLockScroll(false);
  }

  function confirmGroup(group: CategoryGroup) {
    if (group.saved !== false) return;
    if (group.name.trim() === "" || !group.icon) return;
    updateGroup(group.id, { name: group.name.trim(), saved: true });
  }

  function addItem(groupId: string) {
    onChange(
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: [...group.items, { id: `i${Date.now()}`, name: "New item" }],
            }
          : group,
      ),
    );
    pendingReveal.current = groupId;
  }

  function askRemoveGroup(group: CategoryGroup) {
    Alert.alert(
      "Delete category",
      `Remove ${group.name.trim() || "this category"} and all of its items?`,
      [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onChange(groups.filter((item) => item.id !== group.id));
        },
      },
    ]);
  }

  function removeItem(groupId: string, itemId: string) {
    onChange(
      groups.map((group) =>
        group.id === groupId
          ? { ...group, items: group.items.filter((item) => item.id !== itemId) }
          : group,
      ),
    );
  }

  function setKind(id: string, kind: CategoryKind) {
    updateGroup(id, { kind });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.modalBg,
          { backgroundColor: c.overlay },
          keyboardH > 0 && { justifyContent: "flex-end", paddingBottom: 12 },
          keyboardH > 0 && { marginBottom: keyboardH },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.modal }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.ink }]}>Categories</Text>
            <Pressable onPress={addGroup} hitSlop={8}>
              <Text style={[styles.plus, { color: c.ink }]}>+</Text>
            </Pressable>
          </View>
          <View ref={scrollBoxRef} collapsable={false}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            scrollEnabled={!lockScroll}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {groups.map((group) => {
              const expanded = open === group.id;
              const draft = group.saved === false;
              const ready = draft && group.name.trim() !== "" && Boolean(group.icon);
              return (
                <View
                  key={group.id}
                  style={styles.groupBlock}
                  ref={(node) => {
                    groupRefs.current[group.id] = node;
                  }}
                  collapsable={false}
                  onLayout={() => {
                    if (pendingReveal.current !== group.id) return;
                    pendingReveal.current = null;
                    revealBlock(
                      groupRefs.current[group.id],
                      scrollBoxRef.current,
                      scrollRef.current,
                      scrollY.current,
                    );
                  }}
                >
                  <View style={styles.groupHead}>
                    <Pressable
                      onPress={() => {
                        if (expanded) {
                          pendingReveal.current = null;
                          setOpen(null);
                          return;
                        }
                        pendingReveal.current = group.id;
                        setOpen(group.id);
                      }}
                      style={styles.groupToggle}
                    >
                      {expanded ? <ChevronUp /> : <ChevronDown />}
                    </Pressable>
                    <CategoryIcon group={group} />
                    {draft ? (
                      <TextInput
                        ref={(node) => {
                          inputRefs.current[group.id] = node;
                        }}
                        value={group.name}
                        onChangeText={(name) => updateGroup(group.id, { name })}
                        placeholder="Name"
                        placeholderTextColor={c.muted}
                        style={[styles.groupInput, { color: c.ink }]}
                        onFocus={() => revealInput(inputRefs.current[group.id])}
                      />
                    ) : (
                      <Text style={[styles.groupName, { color: c.ink }]}>{group.name}</Text>
                    )}
                    {draft ? (
                      <Pressable onPress={() => confirmGroup(group)} hitSlop={8}>
                        <CheckIcon ready={ready} />
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => askRemoveGroup(group)} hitSlop={8}>
                      <Text style={[styles.remove, { color: c.muted }]}>×</Text>
                    </Pressable>
                  </View>
                  {expanded ? (
                    <View style={styles.groupBody}>
                      {draft ? (
                        <>
                          <DraftLooks
                            color={group.color}
                            icon={group.icon}
                            onColor={(color) => updateGroup(group.id, { color })}
                            onIcon={(icon) => updateGroup(group.id, { icon })}
                            onGrab={setLockScroll}
                          />
                        </>
                      ) : null}
                      <View style={styles.kindRow}>
                        <Pressable
                          onPress={() => setKind(group.id, "expense")}
                          style={[styles.kindBtn, { borderColor: c.line }, group.kind === "expense" && styles.kindExpense]}
                        >
                          <Text
                            style={[
                              styles.kindText,
                              group.kind === "expense" && styles.kindExpenseText,
                            ]}
                          >
                            Expense
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setKind(group.id, "income")}
                          style={[styles.kindBtn, { borderColor: c.line }, group.kind === "income" && styles.kindIncome]}
                        >
                          <Text
                            style={[
                              styles.kindText,
                              group.kind === "income" && styles.kindIncomeText,
                            ]}
                          >
                            Income
                          </Text>
                        </Pressable>
                      </View>
                      {(group.items ?? []).map((item) => (
                        <View key={item.id} style={styles.editItem}>
                          <TextInput
                            ref={(node) => {
                              inputRefs.current[item.id] = node;
                            }}
                            value={item.name}
                            onChangeText={(name) => updateItem(group.id, item.id, name)}
                            style={[styles.itemInput, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
                            onFocus={() => revealInput(inputRefs.current[item.id])}
                          />
                          <Pressable onPress={() => removeItem(group.id, item.id)} hitSlop={8}>
                            <Text style={[styles.remove, { color: c.muted }]}>×</Text>
                          </Pressable>
                        </View>
                      ))}
                      <Pressable onPress={() => addItem(group.id)} style={styles.addItem}>
                        <Text style={[styles.addItemText, { color: c.muted }]}>+ Item</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
          </View>
          <Pressable style={[styles.doneBtn, { backgroundColor: c.ink }]} onPress={onClose}>
            <Text style={[styles.doneText, { color: c.bg }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CheckIcon({ ready }: { ready: boolean }) {
  const { colors: c } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: ready ? "#BBF7D0" : "transparent",
        borderWidth: 1.5,
        borderColor: ready ? "#86EFAC" : c.muted,
      }}
    >
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 12.5 10.5 16 17 8.5"
          stroke={ready ? "#16A34A" : c.muted}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
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

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { color: INK, fontSize: 15, textAlign: "center", marginBottom: 8 },
  plus: { color: INK, fontSize: 22, lineHeight: 24 },
  scroll: { minHeight: 240, maxHeight: 420 },
  scrollContent: { paddingBottom: 8 },
  groupBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 6,
  },
  groupToggle: { paddingRight: 4 },
  groupName: { color: INK, fontSize: 14, fontWeight: "600", flex: 1 },
  groupInput: { flex: 1, color: INK, fontSize: 14, fontWeight: "600", padding: 0 },
  chevron: { color: MUTED, fontSize: 16, width: 16, textAlign: "center" },
  itemRow: { paddingVertical: 8, paddingLeft: 18 },
  itemName: { color: INK, fontSize: 13 },
  remove: { color: MUTED, fontSize: 20, lineHeight: 20, paddingHorizontal: 4 },
  groupBody: { paddingBottom: 8, paddingLeft: 8 },
  kindRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  kindBtn: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kindExpense: { backgroundColor: "#FECACA", borderColor: "#FECACA" },
  kindIncome: { backgroundColor: "#BBF7D0", borderColor: "#BBF7D0" },
  kindText: { color: INK, fontSize: 12 },
  kindExpenseText: { color: "#B91C1C" },
  kindIncomeText: { color: "#15803D" },
  editItem: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  itemInput: {
    flex: 1,
    color: INK,
    fontSize: 13,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  addItem: { paddingVertical: 6 },
  addItemText: { color: MUTED, fontSize: 13 },
  doneBtn: {
    marginTop: 12,
    backgroundColor: INK,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  doneText: { color: "#ffffff", fontSize: 15 },
});
