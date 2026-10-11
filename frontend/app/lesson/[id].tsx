import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useAuth } from "@/src/auth/AuthContext";
import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useGoBack } from "@/src/ui/app-chrome";
import { AppHeader, PrimaryButton, SecondaryButton, StateView, StatusPill } from "@/src/ui/kit";
import type { StatusKind } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

const STATUS_KIND: Record<string, StatusKind> = {
  Draft: "n",
  Submitted: "warn",
  Approved: "ok",
  "Changes requested": "bad",
};

export default function LessonPlan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const goBack = useGoBack();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lesson", user?.id, id],
    queryFn: () => apiFetch<any>(`/sessions/${id}/lesson`),
    enabled: !!user && !!id,
  });

  const [objective, setObjective] = useState("");
  const [activities, setActivities] = useState("");
  const [materials, setMaterials] = useState("");
  const [homework, setHomework] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (data?.plan && !ready) {
      setObjective(data.plan.objective ?? "");
      setActivities(data.plan.activities ?? "");
      setMaterials(data.plan.materials ?? "");
      setHomework(data.plan.homework ?? "");
      setReady(true);
    }
  }, [data, ready]);

  const body = { objective, activities, materials, homework };

  const save = useMutation({
    mutationFn: () => apiFetch(`/sessions/${id}/lesson`, { method: "PUT", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson", user?.id, id] });
      toast("Lesson plan saved");
    },
    onError: (e: any) => toast(e?.message ?? "Could not save"),
  });

  const submit = useMutation({
    mutationFn: async () => {
      await apiFetch(`/sessions/${id}/lesson`, { method: "PUT", body });
      return apiFetch(`/sessions/${id}/lesson/submit`, { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson", user?.id, id] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      toast("Sent to your coordinator");
      setReady(false);
    },
    onError: (e: any) => toast(e?.message ?? "Could not submit"),
  });

  const header = (
    <AppHeader
      title="Lesson plan"
      subtitle={data?.session ? `${data.session.title} · ${data.session.start}` : undefined}
      onBack={goBack}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading lesson plan…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load this lesson plan." onRetry={refetch} />
      </View>
    );
  }

  const status = data.plan?.status ?? "Draft";
  const locked = !data.editable;

  return (
    <View style={styles.screen}>
      {header}
      <KeyboardAwareScrollView contentContainerStyle={styles.content} bottomOffset={16} keyboardShouldPersistTaps="handled">
        <View style={{ alignSelf: "flex-start" }}>
          <StatusPill label={status} kind={STATUS_KIND[status] ?? "n"} />
        </View>
        {data.plan?.review_note ? <Text style={styles.note}>Coordinator: {data.plan.review_note}</Text> : null}
        <Field label="Objective" value={objective} onChange={setObjective} editable={!locked} testID="lesson-objective" placeholder="What students should be able to do" colors={colors} styles={styles} />
        <Field label="Activities" value={activities} onChange={setActivities} editable={!locked} testID="lesson-activities" placeholder="Warm-up, main task, close" colors={colors} styles={styles} tall />
        <Field label="Materials" value={materials} onChange={setMaterials} editable={!locked} testID="lesson-materials" placeholder="What you need in the room" colors={colors} styles={styles} />
        <Field label="Homework" value={homework} onChange={setHomework} editable={!locked} testID="lesson-homework" placeholder="Optional follow-up" colors={colors} styles={styles} />
        {locked ? (
          <Text style={styles.note}>
            {status === "Approved" ? "Approved. This plan is locked." : "With your coordinator. You can edit it again if they ask for changes."}
          </Text>
        ) : (
          <View style={styles.actions}>
            <SecondaryButton title="Save draft" testID="lesson-save" onPress={() => save.mutate()} disabled={save.isPending || submit.isPending} style={{ flex: 1 }} />
            <PrimaryButton title="Submit for approval" testID="lesson-submit" onPress={() => submit.mutate()} loading={submit.isPending} style={{ flex: 1 }} />
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  editable,
  testID,
  placeholder,
  colors,
  styles,
  tall,
}: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        style={[styles.input, tall && { minHeight: 110 }, !editable && { opacity: 0.7 }]}
      />
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13, marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 72,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
  },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
}));
