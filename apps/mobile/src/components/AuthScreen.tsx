import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { deviceTz, useProgress } from "@/lib/progress";
import { colors, radii, spacing, styles } from "@/theme";

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { adoptAuth } = useProgress();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const tokens =
        mode === "register" ? await api.register(email, password, deviceTz()) : await api.login(email, password);
      await adoptAuth(tokens);
      router.dismissTo("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  const inputStyle = {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 17,
    backgroundColor: colors.bg,
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.card, { margin: spacing.md, gap: spacing.sm }]}>
        <Text style={styles.subtitle}>{mode === "register" ? "Create your account" : "Welcome back"}</Text>
        {mode === "register" && (
          <Text style={styles.muted}>Your guest progress carries over automatically.</Text>
        )}
        <TextInput
          style={inputStyle}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={inputStyle}
          placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <Pressable style={[styles.btnPrimary, busy && styles.btnPrimaryDisabled]} disabled={busy} onPress={submit}>
          <Text style={styles.btnPrimaryText}>{busy ? "…" : mode === "register" ? "Sign up" : "Log in"}</Text>
        </Pressable>
        <Text style={styles.muted}>
          {mode === "register" ? (
            <>
              Already have an account? <Link href="/login" style={{ color: colors.accent }}>Log in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/register" style={{ color: colors.accent }}>Create an account</Link>
            </>
          )}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
