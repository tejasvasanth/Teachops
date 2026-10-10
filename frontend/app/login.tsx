import { useRouter } from "expo-router";
import { GraduationCap } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

const DEMO_ROLES = ["Teacher", "Coordinator", "Administrator"] as const;

export default function Login() {
  const { user, login, demoLogin } = useAuth();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("anjali@teachops.demo");
  const [password, setPassword] = useState("Demo@12345");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace("/(tabs)");
  }, [user]);

  const doLogin = async () => {
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      toast(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const doDemo = async (role: (typeof DEMO_ROLES)[number]) => {
    setBusy(true);
    try {
      await demoLogin(role);
    } catch (e: any) {
      toast(e?.message ?? "Could not start demo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
      bottomOffset={16}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <GraduationCap size={24} color={colors.onBrandPrimary} weight="fill" />
        </View>
        <Text style={styles.wordmark}>TeachOps</Text>
      </View>
      <Text style={styles.tagline}>Run every class, centre and payslip from one place.</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          testID="login-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@organisation.in"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          testID="login-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <PrimaryButton title="Sign in" onPress={doLogin} loading={busy} testID="login-submit" style={{ marginTop: 6 }} />
      </View>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or explore the demo</Text>
        <View style={styles.line} />
      </View>

      <View style={styles.demoWrap}>
        {DEMO_ROLES.map((r) => (
          <Pressable
            key={r}
            testID={`demo-${r.toLowerCase()}`}
            onPress={() => doDemo(r)}
            disabled={busy}
            style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.demoBtnText}>Enter as {r}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.foot}>Demo data. Fictional organisation, INR, Asia/Kolkata.</Text>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { paddingHorizontal: 24 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.5 },
  tagline: { color: colors.muted, fontFamily: fonts.regular, fontSize: 15, marginTop: 14, lineHeight: 21 },
  form: { marginTop: 30, gap: 8 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 15,
    backgroundColor: colors.surface,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 26 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5 },
  demoWrap: { gap: 10 },
  demoBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  demoBtnText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14.5 },
  foot: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, textAlign: "center", marginTop: 24 },
}));
