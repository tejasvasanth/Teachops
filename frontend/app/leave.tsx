import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { apiFetch } from "@/src/lib/api";
import { fonts, hexA, makeStyles, useTheme } from "@/src/theme";
import { useGoBack } from "@/src/ui/app-chrome";
import { AppHeader, PrimaryButton, Segmented } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function atNoon(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

function localISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function datesBetween(start: Date, end: Date) {
  const out: string[] = [];
  const cursor = atNoon(start);
  const last = atNoon(end);
  while (cursor <= last) {
    out.push(localISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function buildMonth(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= count; day++) cells.push(new Date(year, month, day, 12));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<Date | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function Leave() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const goBack = useGoBack();
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = atNoon(new Date());
  const todayIso = localISO(today);

  const [type, setType] = useState<"Casual" | "Sick" | "Training">("Casual");
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [reason, setReason] = useState("");

  const weeks = useMemo(() => buildMonth(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const startIso = localISO(start);
  const endIso = localISO(end);
  const count = datesBetween(start, end).length;
  const atCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      if (next.getFullYear() < today.getFullYear() || (next.getFullYear() === today.getFullYear() && next.getMonth() < today.getMonth())) {
        return current;
      }
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const pickDay = (day: Date) => {
    const iso = localISO(day);
    if (iso < todayIso) return;
    if (!awaitingEnd) {
      setStart(day);
      setEnd(day);
      setAwaitingEnd(true);
      return;
    }
    if (iso < startIso) {
      setEnd(start);
      setStart(day);
    } else {
      setEnd(day);
    }
    setAwaitingEnd(false);
  };

  const submit = useMutation({
    mutationFn: () => {
      const dates = datesBetween(start, end);
      return apiFetch("/requests/leave", {
        method: "POST",
        body: { leave_type: type, dates, start_date: dates[0], end_date: dates[dates.length - 1], reason },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["my-day"] });
      toast("Leave request sent for approval");
      router.replace("/(tabs)/inbox");
    },
    onError: (e: any) => toast(e?.message ?? "Could not send request"),
  });

  const onSubmit = () => {
    if (!reason.trim()) {
      toast("Add a short reason");
      return;
    }
    submit.mutate();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Request leave" subtitle="Goes to your coordinator for approval" onBack={goBack} />
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

        <Text style={styles.label}>Dates</Text>
        <View style={styles.calendar}>
          <View style={styles.monthRow}>
            <Pressable testID="leave-prev-month" disabled={atCurrentMonth} onPress={() => shiftMonth(-1)} hitSlop={8} style={atCurrentMonth && styles.monthDisabled}>
              <CaretLeft size={18} color={colors.onSurface} weight="bold" />
            </Pressable>
            <Text style={styles.monthTitle}>{monthLabel(cursor.year, cursor.month)}</Text>
            <Pressable testID="leave-next-month" onPress={() => shiftMonth(1)} hitSlop={8}>
              <CaretRight size={18} color={colors.onSurface} weight="bold" />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((name) => (
              <Text key={name} style={styles.weekday}>
                {name}
              </Text>
            ))}
          </View>
          {weeks.map((week, row) => (
            <View key={row} style={styles.weekRow}>
              {week.map((day, col) => {
                if (!day) return <View key={col} style={styles.dayCell} />;
                const iso = localISO(day);
                const disabled = iso < todayIso;
                const selected = iso === startIso || iso === endIso;
                const inRange = iso > startIso && iso < endIso;
                return (
                  <Pressable
                    key={col}
                    testID={`leave-day-${iso}`}
                    disabled={disabled}
                    onPress={() => pickDay(day)}
                    style={[styles.dayCell, inRange && styles.dayInRange, selected && styles.daySelected, disabled && styles.dayDisabled]}
                  >
                    <Text style={[styles.dayText, selected && styles.dayTextSelected, day.getDay() === 0 && !selected && styles.daySunday]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={styles.hint}>{awaitingEnd ? "Now tap the last day." : "Tap the first day, then the last day."}</Text>
        <Text style={styles.count}>
          {formatDate(start)}
          {startIso === endIso ? "" : ` – ${formatDate(end)}`}
          {count === 1 ? " · 1 day" : ` · ${count} days`}
        </Text>

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
        <PrimaryButton
          title={count > 1 ? `Request ${count} days` : "Send request"}
          testID="leave-submit"
          onPress={onSubmit}
          loading={submit.isPending}
          style={{ marginTop: 16 }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13, marginTop: 18, marginBottom: 8 },
  calendar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.surface,
  },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 16 },
  monthDisabled: { opacity: 0.3 },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", color: colors.muted, fontFamily: fonts.medium, fontSize: 11, paddingVertical: 6 },
  dayCell: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  dayInRange: { backgroundColor: hexA(colors.brand, 0.16), borderRadius: 0 },
  daySelected: { backgroundColor: colors.brandPrimary, borderRadius: 8 },
  dayDisabled: { opacity: 0.28 },
  dayText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14, fontVariant: ["tabular-nums"] },
  dayTextSelected: { color: colors.onBrandPrimary, fontFamily: fonts.semibold },
  daySunday: { color: colors.error },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 10 },
  count: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14, marginTop: 4 },
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
