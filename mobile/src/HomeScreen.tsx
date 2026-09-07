import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { confirmAction } from "./confirmAction";
import { useRevealSwipe } from "./useRevealSwipe";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path } from "react-native-svg";
import { cashflowStats, stockStats, tradingStats } from "./assetData";
import {
  deleteCard,
  listCards,
  loadCashflowEntries,
  loadStockHistory,
  loadTradingMonths,
  persistLogo,
  upsertCard,
  type CardKind,
} from "./db";
import { HomeNetWorth } from "./HomeNetWorth";
import type { ListedStock } from "./stockList";
import { useTheme } from "./theme";

const INK = "#111111";
const MUTED = "#9CA3AF";
const RED = "#DC2626";
const ACTION = 68;

async function cardValue(kind: CardKind, id: string) {
  if (kind === "trading") return tradingStats(await loadTradingMonths(id)).value;
  if (kind === "stock") return stockStats(await loadStockHistory(id)).value;
  return cashflowStats(await loadCashflowEntries(id)).value;
}

async function sectionValue(kind: CardKind) {
  const cards = await listCards(kind);
  const values = await Promise.all(
    cards.filter((card) => card.saved).map((card) => cardValue(kind, card.id)),
  );
  return values.reduce((sum, value) => sum + value, 0);
}

async function loadSortedCards(kind: CardKind) {
  const cards = await listCards(kind);
  const ranked = await Promise.all(
    cards.map(async (card) => ({
      card,
      value: card.saved ? await cardValue(kind, card.id) : Number.NEGATIVE_INFINITY,
    })),
  );
  ranked.sort((a, b) => {
    if (a.card.saved !== b.card.saved) return a.card.saved ? -1 : 1;
    return b.value - a.value;
  });
  return ranked.map((item) => item.card);
}

export function HomeScreen({
  navigation,
}: {
  navigation: { navigate: (name: string, params?: object) => void };
}) {
  const [lockScroll, setLockScroll] = useState(false);
  const [tradeFirst, setTradeFirst] = useState(true);
  const { colors: c } = useTheme();

  useFocusEffect(
    useCallback(() => {
      Promise.all([sectionValue("trading"), sectionValue("stock")])
        .then(([trading, stocks]) => setTradeFirst(trading >= stocks))
        .catch(() => setTradeFirst(true));
    }, []),
  );

  const trading = (
    <CardSection
      key="trading"
      title="Trading"
      kind="trading"
      onSwipe={setLockScroll}
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
  );
  const stocks = (
    <CardSection
      key="stock"
      title="Stocks"
      kind="stock"
      onSwipe={setLockScroll}
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
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: c.bgHome }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!lockScroll}
      >
        <HomeNetWorth
          onScrubbing={setLockScroll}
          onProfile={() => navigation.navigate("Settings")}
        />
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
        {tradeFirst ? trading : stocks}
        <View style={styles.sectionGap} />
        {tradeFirst ? stocks : trading}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CardSection({
  title,
  kind,
  locked,
  onOpenItem,
  onSwipe,
}: {
  title: string;
  kind: CardKind;
  locked?: boolean;
  onOpenItem: (stock: ListedStock) => void;
  onSwipe?: (active: boolean) => void;
}) {
  const [items, setItems] = useState<ListedStock[]>([]);
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSortedCards(kind).then(setItems).catch(() => setItems([]));
    }, [kind]),
  );

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
    loadSortedCards(kind).then(setItems).catch(() => undefined);
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
    confirmAction("Delete", `Remove ${item.ticker || "this card"}?`, () => {
      if (item.saved) deleteCard(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setOpenSwipe(null);
    });
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

  const { colors: c } = useTheme();
  return (
    <View>
      <View style={styles.sectionBar}>
        <Text style={[styles.section, { color: c.ink }]}>{title}</Text>
        {locked ? null : (
          <Pressable onPress={addItem} hitSlop={10}>
            <Text style={[styles.plus, { color: c.ink }]}>+</Text>
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
          onSwipe={onSwipe}
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
  onSwipe,
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
  onSwipe?: (active: boolean) => void;
}) {
  const { colors: c } = useTheme();
  const { pan, handlers, style: swipeStyle, nodeRef } = useRevealSwipe({
    open,
    enabled: !locked,
    width: ACTION,
    onOpen,
    onClose,
    onLock: () => onSwipe?.(true),
    onUnlock: () => onSwipe?.(false),
    onTap: (x) => {
      if (open) onClose();
      else if (x < 50) onPickImage();
      else if (stock.saved) onOpenStock();
    },
  });

  const letter = stock.letter ?? (stock.ticker.trim()[0] || "+");
  const saved = Boolean(stock.saved);

  return (
    <View>
    <View style={styles.rowWrap}>
      <Animated.View
        ref={!locked && !saved ? nodeRef : undefined}
        collapsable={false}
        style={[styles.card, { backgroundColor: c.cardSoft, transform: [{ translateX: locked ? 0 : pan }] }, swipeStyle]}
        {...(!locked && !saved ? handlers : {})}
      >
        <Pressable onPress={onPickImage} style={styles.logo}>
          {stock.image ? (
            <Image source={{ uri: stock.image }} style={styles.logoImage} />
          ) : stock.color ? (
            <View style={[styles.logoFill, { backgroundColor: stock.color }]}>
              <Text style={styles.logoMark}>{letter}</Text>
            </View>
          ) : (
            <View style={[styles.logoEmpty, { borderColor: c.line, backgroundColor: c.lift }]}>
              <Text style={[styles.logoHint, { color: c.muted }]}>{letter}</Text>
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
            <Text style={[styles.tickerInput, { color: c.muted }]}>{stock.ticker}</Text>
            <Text style={[styles.nameInput, { color: c.ink }]} numberOfLines={1}>
              {stock.name}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.copy}>
            <TextInput
              value={stock.ticker}
              onChangeText={(ticker) => onChange({ ticker })}
              placeholder="ABBR"
              placeholderTextColor={c.muted}
              autoCapitalize="characters"
              style={[styles.tickerInput, { color: c.muted }]}
            />
            <TextInput
              value={stock.name}
              onChangeText={(name) => onChange({ name })}
              placeholder="Complete name"
              placeholderTextColor={c.muted}
              style={[styles.nameInput, { color: c.ink }]}
            />
          </View>
        )}
        {locked || !saved ? null : (
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
    {!saved ? (
      <Pressable onPress={onConfirm} style={[styles.rowWrap, styles.card, styles.confirmCard, { backgroundColor: c.cardSoft }]}>
        <Text style={[styles.confirmText, { color: c.ink }]}>Add</Text>
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
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 88,
    paddingBottom: 40,
  },
  sectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  section: { color: INK, fontSize: 17, fontWeight: "400" },
  plus: { color: INK, fontSize: 24, lineHeight: 26, fontWeight: "300" },
  sectionGap: { height: 16 },
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
    zIndex: 2,
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
