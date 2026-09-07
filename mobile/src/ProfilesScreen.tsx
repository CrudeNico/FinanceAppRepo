import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  addProfile,
  deleteProfile,
  listProfiles,
  type UserProfile,
} from "./profiles";
import { dark as darkColors, light as lightColors } from "./theme";
import { imageSource } from "./imageSource";

export function ProfilesScreen({
  onEnter,
  dark = false,
}: {
  onEnter: (id: string) => void;
  dark?: boolean;
}) {
  const c = dark ? darkColors : lightColors;
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [manage, setManage] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function reload() {
    listProfiles().then(setProfiles).catch(() => setProfiles([]));
  }

  useEffect(() => {
    reload();
  }, []);

  function closeSheets() {
    setAdding(false);
    setRemoving(null);
    setName("");
    setPassword("");
    setError("");
  }

  async function confirmAdd() {
    const next = name.trim();
    if (!next || !password) return;
    try {
      await addProfile(next, password);
      closeSheets();
      reload();
    } catch {
      setError("Could not add profile");
    }
  }

  async function confirmDelete() {
    if (!removing) return;
    const ok = await deleteProfile(removing.id, password);
    if (!ok) {
      setError("Wrong password");
      return;
    }
    closeSheets();
    reload();
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.grid}>
        {profiles.map((profile) => (
          <View key={profile.id} style={styles.cell}>
            <Pressable
              onPress={() => {
                if (manage) {
                  setPassword("");
                  setError("");
                  setRemoving(profile);
                } else onEnter(profile.id);
              }}
              style={styles.avatarWrap}
            >
              {imageSource(profile.avatar) ? (
                <Image source={imageSource(profile.avatar)} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarEmpty, { backgroundColor: c.lift }]}>
                  <Text style={[styles.initial, { color: c.ink }]}>{profile.name.trim()[0] || "P"}</Text>
                </View>
              )}
              {manage ? (
                <View style={styles.remove}>
                  <Text style={styles.removeText}>×</Text>
                </View>
              ) : null}
            </Pressable>
            <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
              {profile.name}
            </Text>
          </View>
        ))}
        <View style={styles.cell}>
          <Pressable
            onPress={() => {
              setManage(false);
              setPassword("");
              setError("");
              setAdding(true);
            }}
            style={[styles.avatarWrap, styles.add, { borderColor: c.line }]}
          >
            <Text style={[styles.plus, { color: c.muted }]}>+</Text>
          </Pressable>
          <Text style={[styles.name, { color: c.ink }]}>Add</Text>
        </View>
      </View>
      <Pressable onPress={() => setManage((on) => !on)} style={styles.manage}>
        <Text style={[styles.manageText, { color: c.muted }]}>{manage ? "Done" : "Manage Profiles"}</Text>
      </Pressable>

      <Modal visible={adding} transparent animationType="fade">
        <Pressable style={[styles.modalBg, { backgroundColor: c.overlay }]} onPress={closeSheets}>
          <Pressable style={[styles.sheet, { backgroundColor: c.modal }]} onPress={() => undefined}>
            <Text style={[styles.sheetTitle, { color: c.ink }]}>Add profile</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={c.muted}
              autoFocus
              style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
            />
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError("");
              }}
              placeholder="Password"
              placeholderTextColor={c.muted}
              secureTextEntry
              style={[styles.input, styles.inputGap, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={confirmAdd} style={[styles.addBtn, { backgroundColor: c.ink }]}>
              <Text style={[styles.addBtnText, { color: c.bg }]}>Add</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(removing)} transparent animationType="fade">
        <Pressable style={[styles.modalBg, { backgroundColor: c.overlay }]} onPress={closeSheets}>
          <Pressable style={[styles.sheet, { backgroundColor: c.modal }]} onPress={() => undefined}>
            <Text style={[styles.sheetTitle, { color: c.ink }]}>Delete {removing?.name}?</Text>
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError("");
              }}
              placeholder="Password"
              placeholderTextColor={c.muted}
              secureTextEntry
              autoFocus
              style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.input }]}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={confirmDelete} style={[styles.addBtn, { backgroundColor: c.ink }]}>
              <Text style={[styles.addBtnText, { color: c.bg }]}>Delete</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 22,
    maxWidth: 360,
  },
  cell: { width: 92, alignItems: "center" },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 8,
    overflow: "visible",
  },
  avatar: { width: 88, height: 88, borderRadius: 8 },
  avatarEmpty: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: "#333333",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: "#ffffff", fontSize: 32, fontWeight: "600" },
  add: {
    borderWidth: 2,
    borderColor: "#6B7280",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { color: "#9CA3AF", fontSize: 40, lineHeight: 44 },
  name: { color: "#D1D5DB", fontSize: 13, marginTop: 8, textAlign: "center" },
  remove: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: "#ffffff", fontSize: 16, lineHeight: 18 },
  manage: { marginTop: 40, paddingVertical: 10, paddingHorizontal: 16 },
  manageText: {
    color: "#9CA3AF",
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: 280,
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 16,
  },
  sheetTitle: { color: "#F4F4F5", fontSize: 16, marginBottom: 12, textAlign: "center" },
  input: {
    color: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#3F3F46",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  inputGap: { marginTop: 10 },
  error: { color: "#FCA5A5", fontSize: 13, marginTop: 8, textAlign: "center" },
  addBtn: {
    marginTop: 14,
    backgroundColor: "#F4F4F5",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  addBtnText: { color: "#141414", fontSize: 15 },
});
