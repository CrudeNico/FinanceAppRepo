import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path } from "react-native-svg";
import { deleteCard, listCards, persistLogo, upsertCard, type CardKind } from "./db";
import type { ListedStock } from "./stockList";

const INK = "#111111";
const MUTED = "#9CA3AF";
const RED = "#DC2626";
const ACTION = 68;

export function HomeScreen({
  navigation,
}: {
  navigation: { navigate: (name: string, params?: object) => void };
}) {
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <CardSection
          title="Cashflow"
          kind="cashflow"
          locked
          onOpenItem={(stock) =>
            navigation.navigate("Cashflow", {
              stock: {
                id: stock.id,
                ticker: stock.ticker,
                name: stock.name,
                image: stock.image ?? null,
                letter: stock.letter ?? null,
                color: stock.color ?? null,
                saved: true,
              },
            })
          }
        />
        <View style={styles.sectionGap} />
        <CardSection
          title="Trading"
          kind="trading"
          onOpenItem={(stock) =>
            navigation.navigate("Trading", {
              stock: {
                id: stock.id,
                ticker: stock.ticker,
                name: stock.name,
                image: stock.image ?? null,
                letter: stock.letter ?? null,
                color: stock.color ?? null,
                saved: true,
              },
            })
          }
        />
        <View style={styles.sectionGap} />
        <CardSection
          title="Stocks"
          kind="stock"
          onOpenItem={(stock) =>
            navigation.navigate("Stock", {
              stock: {
                id: stock.id,
                ticker: stock.ticker,
                name: stock.name,
                image: stock.image ?? null,
                letter: stock.letter ?? null,
                color: stock.color ?? null,
                saved: true,
              },
            })
          }
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CardSection({
  title,
  kind,
  locked,
  onOpenItem,
}: {
  title: string;
  kind: CardKind;
  locked?: boolean;
  onOpenItem: (stock: ListedStock) => void;
}) {
  const [items, setItems] = useState<ListedStock[]>([]);
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);

  useEffect(() => {
    listCards(kind).then(setItems).catch(() => setItems([]));
  }, [kind]);

  function addItem() {
    setItems((current) => {
      if (current.some((item) => !item.saved)) return current;
      return [
        ...current,
        {
          id: `s${Date.now()}`,
          ticker: "",
          name: "",
          image: null,
          saved: false,
        },
      ];
    });
    setOpenSwipe(null);
  }

  function confirmItem(id: string) {
    setItems((current) => {
      const next = current.map((item) => {
        if (item.id !== id) return item;
        if (!item.ticker.trim() && !item.name.trim()) return item;
        return { ...item, saved: true };
      });
      const saved = next.find((item) => item.id === id && item.saved);
      if (saved) upsertCard(kind, saved);
      return next;
    });
  }

  function updateItem(id: string, patch: Partial<ListedStock>) {
    setItems((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, ...patch } : item));
      const saved = next.find((item) => item.id === id && item.saved);
      if (saved) upsertCard(kind, saved);
      return next;
    });
  }

  function askRemove(item: ListedStock) {
    Alert.alert("Delete", `Remove ${item.ticker || "this card"}?`, [
      { text: "Cancel", style: "cancel", onPress: () => setOpenSwipe(null) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (item.saved) deleteCard(item.id);
          setItems((current) => current.filter((entry) => entry.id !== item.id));
          setOpenSwipe(null);
        },
      },
    ]);
  }

  async function pickImage(id: string) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const image = await persistLogo(id, result.assets[0].uri);
      updateItem(id, { image });
    }
  }

  return (
    <View>
      <View style={styles.sectionBar}>
        <Text style={styles.section}>{title}</Text>
        {locked ? null : (
          <Pressable onPress={addItem} hitSlop={10}>
            <Text style={styles.plus}>+</Text>
          </Pressable>
        )}
      </View>

      {items.map((item) => (
        <StockCard
          key={item.id}
          stock={item}
          locked={locked}
          open={!locked && openSwipe === item.id}
          onOpen={() => {
            if (!locked) setOpenSwipe(item.id);
          }}
          onClose={() => setOpenSwipe((current) => (current === item.id ? null : current))}
          onDelete={() => {
            if (!locked) askRemove(item);
          }}
          onPickImage={() => pickImage(item.id)}
          onChange={(patch) => updateItem(item.id, patch)}
          onConfirm={() => confirmItem(item.id)}
          onOpenStock={() => {
            if (!item.saved) return;
            onOpenItem(item);
          }}
        />
      ))}
    </View>
  );
}

function StockCard({
  stock,
  locked,
  open,
  onOpen,
  onClose,
  onDelete,
  onPickImage,
  onChange,
  onConfirm,
  onOpenStock,
}: {
  stock: ListedStock;
  locked?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onPickImage: () => void;
  onChange: (patch: Partial<ListedStock>) => void;
  onConfirm: () => void;
  onOpenStock: () => void;
}) {
  const pan = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const openRef = useRef(onOpen);
  const closeRef = useRef(onClose);
  openRef.current = onOpen;
  closeRef.current = onClose;

  function snap(shouldOpen: boolean) {
    pan.stopAnimation();
    if (shouldOpen) {
      offset.current = ACTION;
      Animated.timing(pan, {
        toValue: ACTION,
        duration: 120,
        useNativeDriver: true,
      }).start();
      openRef.current();
      return;
    }
    offset.current = 0;
    Animated.timing(pan, {
      toValue: 0,
      duration: 80,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue(0);
    });
    closeRef.current();
  }

  useEffect(() => {
    if (!open) {
      offset.current = 0;
      pan.setValue(0);
    }
  }, [open, pan]);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        pan.stopAnimation((value) => {
          offset.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        if (offset.current < ACTION && gesture.dx > 8) {
          snap(true);
          return;
        }
        pan.setValue(Math.max(0, Math.min(ACTION, offset.current + gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        const goingLeft = gesture.dx < -4 || gesture.vx < -0.05;
        if (goingLeft) {
          snap(false);
          return;
        }
        if (gesture.dx > 4 || gesture.vx > 0.04) snap(true);
        else snap(false);
      },
    }),
  ).current;

  const letter = stock.letter ?? (stock.ticker.trim()[0] || "+");
  const saved = Boolean(stock.saved);

  return (
    <View>
    <View style={styles.rowWrap}>
      {locked ? null : (
        <View style={styles.deleteLane}>
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <TrashIcon />
          </Pressable>
        </View>
      )}
      <Animated.View
        style={[styles.card, { transform: [{ translateX: locked ? 0 : pan }] }]}
        {...(locked ? {} : responder.panHandlers)}
      >
        <Pressable onPress={onPickImage} style={styles.logo}>
          {stock.image ? (
            <Image source={{ uri: stock.image }} style={styles.logoImage} />
          ) : stock.color ? (
            <View style={[styles.logoFill, { backgroundColor: stock.color }]}>
              <Text style={styles.logoMark}>{letter}</Text>
            </View>
          ) : (
            <View style={styles.logoEmpty}>
              <Text style={styles.logoHint}>{letter}</Text>
            </View>
          )}
        </Pressable>
        {saved ? (
          <TouchableOpacity
            style={styles.copy}
            activeOpacity={0.7}
            onPress={() => {
              if (open) onClose();
              else onOpenStock();
            }}
          >
            <Text style={styles.tickerInput}>{stock.ticker}</Text>
            <Text style={styles.nameInput} numberOfLines={1}>
              {stock.name}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.copy}>
            <TextInput
              value={stock.ticker}
              onChangeText={(ticker) => onChange({ ticker })}
              placeholder="ABBR"
              placeholderTextColor={MUTED}
              autoCapitalize="characters"
              style={styles.tickerInput}
            />
            <TextInput
              value={stock.name}
              onChangeText={(name) => onChange({ name })}
              placeholder="Complete name"
              placeholderTextColor={MUTED}
              style={styles.nameInput}
            />
          </View>
        )}
      </Animated.View>
    </View>
    {!saved ? (
      <Pressable onPress={onConfirm} style={[styles.rowWrap, styles.card, styles.confirmCard]}>
        <Text style={styles.confirmText}>Add</Text>
      </Pressable>
    ) : null}
    </View>
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
  screen: { flex: 1, backgroundColor: "#E6E6E6" },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  sectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  section: { color: INK, fontSize: 17, fontWeight: "400" },
  plus: { color: INK, fontSize: 24, lineHeight: 26, fontWeight: "300" },
  sectionGap: { height: 36 },
  rowWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
    marginBottom: 10,
  },
  deleteLane: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: ACTION + 20,
    backgroundColor: RED,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  deleteBtn: {
    width: ACTION,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F3F3F3",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: "hidden",
  },
  logoFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmpty: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEFEF",
  },
  logoImage: { width: 36, height: 36 },
  logoMark: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
  logoHint: { color: MUTED, fontSize: 16 },
  copy: { flex: 1, minWidth: 0 },
  tickerInput: { color: MUTED, fontSize: 11, padding: 0 },
  nameInput: { color: INK, fontSize: 14, fontWeight: "600", padding: 0, marginTop: 1 },
  confirmCard: {
    justifyContent: "center",
    marginBottom: 10,
  },
  confirmText: { color: INK, fontSize: 16, textAlign: "center", width: "100%" },
});
