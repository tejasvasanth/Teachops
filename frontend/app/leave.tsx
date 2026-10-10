import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { AppHeader, PrimaryButton, Segmented } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

function nextDays(n: number) {
  const out: { iso: string; dow: string; dom: number; mon: string }[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      dow: d.toLocaleDateString("en-IN", { weekday: "short" }),
      dom: d.getDate(),
      mon: d.toLocaleDateString("en-IN", { month: "short" }),
    });
  }
  return out;
}

export default function Leave() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const days = useMemo(() => nextDays(28), []);

  const [type, setType] = useState<"Casual" | "Sick" | "Training">("Casual");
  const [from, setFrom] = useState(days[0].iso);
  const [to, setTo] = useState(days[0].iso);
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      apiFetch("/requests/leave", { method: "POST", body: { leave_type: type, start_date: from, end_date: to, reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["my-day"] });
      toast("Leave request sent for approval");
      router.replace("/(tabs)/inbox");
    },
    onError: (e: any) => toast(e?.message ?? "Could not send request"),
  });

  const onSubmit = () => {
    if (to < from) {
      toast("End date must be on or after the start date");
      return;
    }
    if (!reason.trim()) {
      toast("Add a short reason");
      return;
    }
    submit.mutate();
  };

  const DayRow = ({ value, onPick, min }: { value: string; onPick: (v: string) => void; min?: string }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
      {days.map((d) => {
        const disabled = min ? d.iso < min : false;
        const active = d.iso === value;
        return (
          <Pressable
            key={d.iso}
            disabled={disabled}
            testID={`day-${d.iso}`}
            onPress={() => onPick(d.iso)}
            style={[styles.dayChip, active && styles.dayChipActive, disabled && { opacity: 0.3 }]}
          >
            <Text style={[styles.dayDow, active && styles.dayActive]}>{d.dow}</Text>
            <Text style={[styles.dayDom, active && styles.dayActive]}>{d.dom}</Text>
            <Text style={[styles.dayMon, active && styles.dayActive]}>{d.mon}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Request leave" subtitle="Goes to your coordinator for approval" onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={styles.content} bottomOffset={16} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Type</Text>
        <Segmented
          testID="leave-type"
          value={type}
          onChange={(v) => setType(v)}
          options={[
            { label: "Casual", value: "Casual" },
            { label: "Sick", value: "Sick" },
            { label: "Training", value: "Training" },
          ]}
        />

        <Text style={styles.label}>From</Text>
        <DayRow value={from} onPick={(v) => { setFrom(v); if (to < v) setTo(v); }} />

        <Text style={styles.label}>To</Text>
        <DayRow value={to} onPick={setTo} min={from} />

        <Text style={styles.label}>Reason</Text>
        <TextInput
          testID="leave-reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Brief reason"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.reason}
        />

        <Text style={styles.note}>Once approved, your classes in this period are flagged for substitute cover.</Text>
        <PrimaryButton title="Send request" testID="leave-submit" onPress={onSubmit} loading={submit.isPending} style={{ marginTop: 16 }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13, marginTop: 18, marginBottom: 8 },
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
  reason: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    textAlignVertical: "top",
  },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 12, lineHeight: 19 },
}));
