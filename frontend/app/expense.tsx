import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useGoBack } from "@/src/ui/app-chrome";
import { AppHeader, PrimaryButton } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

function localISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function recentDays(n: number) {
  const out: { iso: string; dow: string; dom: number; mon: string }[] = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push({
      iso: localISO(d),
      dow: d.toLocaleDateString("en-IN", { weekday: "short" }),
      dom: d.getDate(),
      mon: d.toLocaleDateString("en-IN", { month: "short" }),
    });
  }
  return out;
}

export default function Expense() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const goBack = useGoBack();
  const { toast } = useToast();
  const qc = useQueryClient();
  const days = useMemo(() => recentDays(21), []);

  const [travelDate, setTravelDate] = useState(days[days.length - 1].iso);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      apiFetch("/requests/expense", {
        method: "POST",
        body: {
          travel_date: travelDate,
          origin,
          destination,
          amount: Number(amount),
          purpose,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      toast("Travel claim sent for approval");
      router.replace("/(tabs)/me");
    },
    onError: (e: any) => toast(e?.message ?? "Could not send the claim"),
  });

  const onSubmit = () => {
    const rupees = Number(amount);
    if (!origin.trim() || !destination.trim()) {
      toast("Add where you travelled from and to");
      return;
    }
    if (!Number.isFinite(rupees) || rupees < 1) {
      toast("Enter the amount in rupees");
      return;
    }
    if (!purpose.trim()) {
      toast("Add a short purpose");
      return;
    }
    submit.mutate();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Travel claim" subtitle="Reimbursed with your next pay period" onBack={goBack} />
      <KeyboardAwareScrollView contentContainerStyle={styles.content} bottomOffset={16} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
          {days.map((d) => {
            const active = d.iso === travelDate;
            return (
              <Pressable
                key={d.iso}
                testID={`expense-day-${d.iso}`}
                onPress={() => setTravelDate(d.iso)}
                style={[styles.dayChip, active && styles.dayChipActive]}
              >
                <Text style={[styles.dayDow, active && styles.dayActive]}>{d.dow}</Text>
                <Text style={[styles.dayDom, active && styles.dayActive]}>{d.dom}</Text>
                <Text style={[styles.dayMon, active && styles.dayActive]}>{d.mon}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>From</Text>
        <TextInput testID="expense-from" value={origin} onChangeText={setOrigin} placeholder="Adyar" placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.label}>To</Text>
        <TextInput testID="expense-to" value={destination} onChangeText={setDestination} placeholder="Velachery" placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.label}>Amount (₹)</Text>
        <TextInput
          testID="expense-amount"
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
          placeholder="450"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text style={styles.label}>Purpose</Text>
        <TextInput
          testID="expense-purpose"
          value={purpose}
          onChangeText={setPurpose}
          placeholder="Cover class at the other centre"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.reason}
        />
        <Text style={styles.note}>Your coordinator approves the claim. Finance adds it to the next salary statement.</Text>
        <PrimaryButton title="Send claim" testID="expense-submit" onPress={onSubmit} loading={submit.isPending} style={{ marginTop: 16 }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13, marginTop: 18, marginBottom: 8 },
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
  reason: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 88,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
  },
  dayRow: { gap: 8, paddingVertical: 2 },
  dayChip: {
    flexShrink: 0,
    width: 54,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  dayChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  dayDow: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11 },
  dayDom: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 17, fontVariant: ["tabular-nums"] },
  dayMon: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
  dayActive: { color: colors.onBrandPrimary },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 14, lineHeight: 18 },
}));
