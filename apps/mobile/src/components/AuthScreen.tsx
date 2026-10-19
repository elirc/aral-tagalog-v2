import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { deviceTz, useProgress } from "@/lib/progress";
import { font, spacing, useTheme } from "@/theme";

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, styles } = useTheme();
  const { adoptAuth } = useProgress();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const isRegister = mode === "register";

  const submit = async () => {
    // the keyboard's "go" key bypasses the disabled button
    if (busy) return;
    setBusy(true);
    setError(null);
    // autofill and some keyboards append a trailing space to emails
    const addr = email.trim();
    try {
      const tokens = isRegister ? await api.register(addr, password, deviceTz()) : await api.login(addr, password);
      await adoptAuth(tokens);
      router.dismissTo("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={{ paddingHorizontal: spacing.sm }}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, { alignSelf: "flex-start" }, pressed && styles.pressed]}
        >
          <Text style={{ fontSize: 22, color: colors.textMuted, paddingHorizontal: spacing.sm }}>‹ Back</Text>
        </Pressable>
      </View>

      {/* iOS: pad the scroll area by the keyboard height so Submit stays
          reachable. Android resizes the window itself (adjustResize). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          // taps on Submit/links must land while the keyboard is still up
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: spacing.md,
            paddingBottom: spacing.md + insets.bottom,
          }}
        >
          <Text
            style={{
              fontSize: font.sizeXl,
              fontWeight: "800",
              color: colors.primary,
              textAlign: "center",
              marginBottom: spacing.md,
            }}
            accessibilityRole="header"
          >
            Aral
          </Text>
          <View style={[styles.card, { gap: spacing.sm }]}>
            <Text style={styles.subtitle} accessibilityRole="header">
              {isRegister ? "Create your account" : "Welcome back"}
            </Text>
            {isRegister && <Text style={styles.muted}>Your guest progress carries over automatically.</Text>}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              // keep the keyboard up while focus hops to the password field
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!busy}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder={isRegister ? "Password (8+ characters)" : "Password"}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={isRegister ? "new-password" : "current-password"}
              textContentType={isRegister ? "newPassword" : "password"}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              editable={!busy}
              value={password}
              onChangeText={setPassword}
            />
            {error && (
              <Text style={{ color: colors.danger }} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.btnPrimary,
                busy && styles.btnPrimaryDisabled,
                pressed && !busy && styles.pressed,
              ]}
              disabled={busy}
              onPress={() => void submit()}
              accessibilityRole="button"
              accessibilityLabel={isRegister ? "Sign up" : "Log in"}
              accessibilityState={{ disabled: busy, busy }}
            >
              {busy ? (
                <ActivityIndicator color={colors.textMuted} />
              ) : (
                <Text style={styles.btnPrimaryText}>{isRegister ? "Sign up" : "Log in"}</Text>
              )}
            </Pressable>
            {/* whole line is the tap target; replace (not push) so toggling
                login <-> register doesn't pile screens onto the back stack */}
            <Pressable
              onPress={() => router.replace(isRegister ? "/login" : "/register")}
              accessibilityRole="link"
              disabled={busy}
              style={({ pressed }) => [
                { minHeight: 44, justifyContent: "center", alignItems: "center" },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.muted, { textAlign: "center" }]}>
                {isRegister ? "Already have an account? " : "New here? "}
                <Text style={{ color: colors.accent, fontWeight: "700" }}>
                  {isRegister ? "Log in" : "Create an account"}
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
