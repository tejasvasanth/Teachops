import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/src/auth/AuthContext";
import { apiFetch } from "@/src/lib/api";
import { useGoBack } from "@/src/ui/app-chrome";
import { fonts, makeStyles } from "@/src/theme";
import { AppHeader, Avatar, SectionHeader, StateView, StatusPill } from "@/src/ui/kit";
import type { StatusKind } from "@/src/ui/kit";

const MARK_KIND: Record<string, StatusKind> = {
  P: "ok",
  A: "bad",
  L: "warn",
  E: "n",
};

function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function ClassView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const goBack = useGoBack();
  const router = useRouter();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["class", user?.id, id],
    queryFn: () => apiFetch<any>(`/classes/${id}`),
    enabled: !!user && !!id,
  });

  const header = (
    <AppHeader
      title={data?.code ? `Class ${data.code}` : "Class"}
      subtitle={data ? `${data.programme} · ${data.centre}` : undefined}
      onBack={goBack}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading class…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load this class." onRetry={refetch} />
      </View>
    );
  }

  const summary = data.has_class_today
    ? `${data.absent_today} absent today · ${data.unmarked_today} not marked`
    : "No session today";

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{data.students.length} students</Text>
          <Text style={styles.summarySub}>
            Class teacher · {data.class_teacher}
            {data.room ? ` · ${data.room}` : ""}
          </Text>
          <Text style={styles.summarySub}>{summary}</Text>
        </View>

        <SectionHeader title="Roll" right="This week" />
        <View style={styles.list}>
          {data.students.map((s: any, i: number) => {
            const bits = [];
            if (s.absent_this_week) bits.push(`Absent ${s.absent_this_week} this week`);
            if (s.late_this_week) bits.push(`Late ${s.late_this_week}`);
            if (s.follow_up) bits.push("Follow up");
            return (
              <View key={s.id} style={[styles.row, i > 0 && styles.border]}>
                <Avatar initials={s.initials} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {s.name}
                  </Text>
                  {bits.length ? <Text style={styles.sub}>{bits.join(" · ")}</Text> : null}
                </View>
                {data.has_class_today ? (
                  <StatusPill label={s.today_label} kind={MARK_KIND[s.today] ?? "n"} />
                ) : null}
              </View>
            );
          })}
        </View>

        <SectionHeader title="This week's sessions" />
        {data.sessions.length ? (
          <View style={styles.list}>
            {data.sessions.map((s: any, i: number) => (
              <View key={s.id} style={[styles.row, i > 0 && styles.border]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {dayLabel(s.date)} · {s.start}–{s.end}
                  </Text>
                  <Text style={styles.sub}>{s.title}</Text>
                </View>
                <Text style={styles.link} onPress={() => router.push(`/session/${s.id}`)}>
                  Open
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sub}>No sessions scheduled this week.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
  summary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  summaryTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 16 },
  summarySub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  name: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14.5 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
  link: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 13.5 },
}));
