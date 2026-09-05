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
import { INITIAL_STOCKS, type ListedStock } from "./stockList";

const INK = "#111111";
const MUTED = "#9CA3AF";
const RED = "#DC2626";
const ACTION = 68;

export function HomeScreen({
  navigation,
}: {
  navigation: { navigate: (name: string, params?: object) => void };
}) {
  const [stocks, setStocks] = useState<ListedStock[]>(INITIAL_STOCKS);
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);

  function addStock() {
    setStocks((current) => [
      ...current,
      {
        id: `s${Date.now()}`,
        ticker: "",
        name: "",
        image: null,
      },
    ]);
    setOpenSwipe(null);
  }

  function updateStock(id: string, patch: Partial<ListedStock>) {
    setStocks((current) =>
      current.map((stock) => (stock.id === id ? { ...stock, ...patch } : stock)),
    );
  }

  function askRemove(stock: ListedStock) {
    Alert.alert("Delete stock", `Remove ${stock.ticker || "this stock"}?`, [
      { text: "Cancel", style: "cancel", onPress: () => setOpenSwipe(null) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setStocks((current) => current.filter((item) => item.id !== stock.id));
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
      updateStock(id, { image: result.assets[0].uri });
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionBar}>
          <Text style={styles.section}>Stocks</Text>
          <Pressable onPress={addStock} hitSlop={10}>
            <Text style={styles.plus}>+</Text>
          </Pressable>
        </View>

        {stocks.map((stock) => (
          <StockCard
            key={stock.id}
            stock={stock}
            open={openSwipe === stock.id}
            onOpen={() => setOpenSwipe(stock.id)}
            onClose={() => setOpenSwipe((current) => (current === stock.id ? null : current))}
            onDelete={() => askRemove(stock)}
            onPickImage={() => pickImage(stock.id)}
            onChange={(patch) => updateStock(stock.id, patch)}
            onOpenStock={() => {
              if (!stock.ticker.trim() && !stock.name.trim()) return;
              navigation.navigate("Stock", { stock });
            }}
          />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StockCard({
  stock,
  open,
  onOpen,
  onClose,
  onDelete,
  onPickImage,
  onChange,
  onOpenStock,
}: {
  stock: ListedStock;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onPickImage: () => void;
  onChange: (patch: Partial<ListedStock>) => void;
  onOpenStock: () => void;
}) {
  const pan = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const openRef = useRef(onOpen);
  const closeRef = useRef(onClose);
  openRef.current = onOpen;
  closeRef.current = onClose;

  function snap(shouldOpen: boolean) {
    const toValue = shouldOpen ? ACTION : 0;
    offset.current = toValue;
    Animated.timing(pan, { toValue, duration: 120, useNativeDriver: true }).start();
    if (shouldOpen) openRef.current();
    else closeRef.current();
  }

  useEffect(() => {
    if (!open) {
      offset.current = 0;
      Animated.timing(pan, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    }
  }, [open, pan]);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        pan.stopAnimation((value) => {
          offset.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue(Math.max(0, Math.min(ACTION, offset.current + gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 8 || gesture.vx > 0.12) snap(true);
        else if (gesture.dx < -8 || gesture.vx < -0.12) snap(false);
        else snap(offset.current + gesture.dx > ACTION / 2);
      },
    }),
  ).current;

  const letter = stock.letter ?? (stock.ticker.trim()[0] || "+");
  const saved = Boolean(stock.ticker.trim() && stock.name.trim());

  return (
    <View style={styles.rowWrap}>
      <View style={styles.deleteLane}>
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <TrashIcon />
        </Pressable>
      </View>
      <Animated.View
        style={[styles.card, { transform: [{ translateX: pan }] }]}
        {...responder.panHandlers}
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
    width: ACTION,
    backgroundColor: RED,
    alignItems: "center",
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
});
