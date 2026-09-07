import { Image, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { ScreenBack } from "./ScreenBack";
import * as ImagePicker from "expo-image-picker";
import { persistLogo } from "./db";
import { imageSource } from "./imageSource";
import { getActiveProfile } from "./profiles";
import { useSession } from "./SessionContext";
import { useTheme } from "./theme";

export function SettingsScreen({
  navigation,
}: {
  navigation: { goBack: () => void };
}) {
  const { colors: c, dark, setMode, avatar, setAvatar } = useTheme();
  const { logout } = useSession();

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const id = getActiveProfile()?.id ?? "profile";
      const uri = await persistLogo(`avatar-${id}`, result.assets[0].uri);
      setAvatar(uri);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenBack />
      <Text style={[styles.title, { color: c.ink }]}>Settings</Text>

      <Pressable onPress={pickImage} style={styles.photoWrap}>
        {imageSource(avatar) ? (
          <Image source={imageSource(avatar)} style={styles.photo} />
        ) : (
          <View style={[styles.photoEmpty, { borderColor: c.line, backgroundColor: c.lift }]} />
        )}
        <Text style={[styles.photoHint, { color: c.muted }]}>Tap to add a photo</Text>
      </Pressable>

      <Pressable
        onPress={() => setMode(dark ? "light" : "dark")}
        style={[styles.row, { backgroundColor: c.cardSoft }]}
      >
        <Text style={[styles.rowLabel, { color: c.ink }]}>Dark mode</Text>
        <Switch
          value={dark}
          onValueChange={(on) => setMode(on ? "dark" : "light")}
          trackColor={{ false: c.line, true: "#86EFAC" }}
          thumbColor="#ffffff"
        />
      </Pressable>

      <Pressable
        onPress={logout}
        style={[styles.row, { backgroundColor: c.cardSoft, marginTop: 10, zIndex: 2 }]}
      >
        <Text style={[styles.rowLabel, { color: c.ink }]}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 72 },
  back: { position: "absolute", left: 16, top: 56, zIndex: 2 },
  backText: { fontSize: 32, lineHeight: 34 },
  title: { fontSize: 28, fontWeight: "600", textAlign: "center", marginBottom: 28 },
  photoWrap: { alignItems: "center", marginBottom: 32 },
  photo: { width: 96, height: 96, borderRadius: 48 },
  photoEmpty: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  photoHint: { marginTop: 10, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 16 },
});
