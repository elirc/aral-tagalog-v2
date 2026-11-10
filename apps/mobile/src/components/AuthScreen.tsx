import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  AccessibilityInfo,
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
import { api, ApiError } from "@/lib/api";
import { deviceTz, useProgress } from "@/lib/progress";
import { font, spacing, useTheme } from "@/theme";

/** Map transport/server failures to something a learner can act on — the raw
 *  messages ("Network request failed", "invalid body") are developer-speak. */
function friendlyAuthError(err: unknown, isRegister: boolean): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "That email and password don't match.";
    if (err.status === 409) return "That email already has an account. Try logging in instead.";
    if (err.status === 400) {
      return isRegister
        ? "Enter a valid email and a password of at least 8 characters."
        : "Enter a valid email and password.";
    }
    if (err.status === 429) return "Too many attempts. Wait a minute and try again.";
    if (err.status >= 500) return "Aral's server is having trouble. Try again in a moment.";
    return err.message;
  }
  // fetch rejected (offline, server unreachable) or timed out
  return "Can't reach Aral right now. Check your connection and try again. You can keep learning meanwhile — progress is saved on this device.";
}

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, styles, mode: themeMode } = useTheme();
  const { adoptAuth } = useProgress();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const isRegister = mode === "register";

  // a ref, not `busy`: two taps (or the "go" key racing the button) can both
  // run before the re-render that would disable the button
  const inFlight = useRef(false);

  const fail = (message: string) => {
    setError(message);
    // iOS VoiceOver doesn't speak accessibilityRole="alert" on its own
    AccessibilityInfo.announceForAccessibility(message);
  };

  const submit = async () => {
    if (inFlight.current) return;
    // autofill and some keyboards append a trailing space to emails
    const addr = email.trim();
    // catch the obvious cases locally: instant, and works offline
    if (!addr || !password) return fail("Enter your email and password.");
    if (!/^\S+@\S+\.\S+$/.test(addr)) return fail("That doesn't look like an email address.");
    if (isRegister && password.length < 8) return fail("Use a password of at least 8 characters.");
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const tokens = isRegister ? await api.register(addr, password, deviceTz()) : await api.login(addr, password);
      await adoptAuth(tokens);
      router.dismissTo("/");
    } catch (err) {
      fail(friendlyAuthError(err, isRegister));
      inFlight.current = false;
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
              keyboardAppearance={themeMode}
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
              keyboardAppearance={themeMode}
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
                <Text style={{ color: colors.accentText, fontWeight: "700" }}>
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
