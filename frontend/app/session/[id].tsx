import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import {
  AppHeader,
  AttendanceControl,
  Avatar,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StateView,
  StatusPill,
} from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

const LOCKED = ["Completed", "Verified"];

export default function Session() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["session", id],
    queryFn: () => apiFetch<any>(`/sessions/${id}`),
  });

  const [marks, setMarks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [savedLabel, setSavedLabel] = useState("Draft saved automatically");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (data && !hydrated.current) {
      setMarks(data.marks ?? {});
      setNotes(data.notes ?? "");
      hydrated.current = true;
    }
  }, [data]);

  const locked = data && LOCKED.includes(data.record_status);

  const save = useMutation({
    mutationFn: (payload: { marks: Record<string, string>; notes: string }) =>
      apiFetch(`/sessions/${id}/attendance`, {
        method: "POST",
        body: { marks: Object.entries(payload.marks).map(([student_id, code]) => ({ student_id, code })), notes: payload.notes },
      }),
    onSuccess: () => setSavedLabel("Draft saved automatically"),
  });

  const scheduleSave = (nextMarks: Record<string, string>, nextNotes: string) => {
    if (locked) return;
    setSavedLabel("Saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save.mutate({ marks: nextMarks, notes: nextNotes }), 700);
  };

  const submit = useMutation({
    mutationFn: async () => {
      await apiFetch(`/sessions/${id}/attendance`, {
        method: "POST",
        body: { marks: Object.entries(marks).map(([student_id, code]) => ({ student_id, code })), notes },
      });
      return apiFetch(`/sessions/${id}/submit`, { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", id] });
      qc.invalidateQueries({ queryKey: ["my-day"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast("Session record submitted");
      router.back();
    },
    onError: (e: any) => toast(e?.message ?? "Could not submit"),
  });

  const header = <AppHeader title={data?.session?.title ?? "Session"} subtitle={data?.session?.where} onBack={() => router.back()} />;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading session…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load this session." onRetry={refetch} />
      </View>
    );
  }

  const markCount = Object.keys(marks).length;
  const total = data.roster.length;

  const setMark = (sid: string, code: string) => {
    const next = { ...marks, [sid]: code };
    setMarks(next);
    scheduleSave(next, notes);
  };
  const markAll = () => {
    const next: Record<string, string> = {};
    data.roster.forEach((s: any) => (next[s.id] = "P"));
    setMarks(next);
    scheduleSave(next, notes);
  };

  return (
    <View style={styles.screen}>
      {header}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={120}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statusRow}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <Text style={styles.counter}>
            {markCount} of {total} marked
          </Text>
          <StatusPill label={data.record_status} kind={locked ? "ok" : "warn"} />
        </View>

        <View style={styles.list}>
          {data.roster.map((s: any, i: number) => (
            <View key={s.id} style={[styles.studentRow, i > 0 && styles.border]}>
              <Avatar initials={s.initials} size={34} />
              <Text style={styles.studentName} numberOfLines={1}>
                {s.name}
              </Text>
              <AttendanceControl
                testID={`att-${i}`}
                value={marks[s.id]}
                disabled={locked}
                onChange={(code) => setMark(s.id, code)}
              />
            </View>
          ))}
        </View>

        {!locked ? (
          <SecondaryButton title="Mark all present" testID="mark-all" onPress={markAll} style={{ marginTop: 12 }} />
        ) : null}

        <SectionHeader title="What was covered" />
        <TextInput
          testID="session-notes"
          value={notes}
          onChangeText={(t) => {
            setNotes(t);
            scheduleSave(marks, t);
          }}
          editable={!locked}
          multiline
          placeholder="Activities, learning outcomes, unfinished content"
          placeholderTextColor={colors.muted}
          style={styles.notes}
        />
        <View style={{ height: 20 }} />
      </KeyboardAwareScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.footText}>
          {locked ? "Submitted. Request a correction to edit." : savedLabel}
        </Text>
        <PrimaryButton
          title="Submit record"
          testID="submit-record"
          disabled={locked}
          loading={submit.isPending}
          onPress={() => submit.mutate()}
          style={{ paddingHorizontal: 20 }}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15 },
  counter: { flex: 1, color: colors.muted, fontFamily: fonts.regular, fontSize: 13, fontVariant: ["tabular-nums"] },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  studentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  studentName: { flex: 1, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14.5 },
  notes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 96,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footText: { flex: 1, color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
}));
