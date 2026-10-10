import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowRight } from "phosphor-react-native";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { DemoSwitcher, HeaderBell } from "@/src/ui/app-chrome";
import {
  AppHeader,
  Card,
  MetricTile,
  SectionHeader,
  StateView,
  StatusPill,
  TimelineRail,
} from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

export default function MyDay() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { toast } = useToast();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["my-day"],
    queryFn: () => apiFetch<any>("/my-day"),
  });

  const header = (
    <AppHeader title={data?.greeting ?? "My Day"} subtitle={data?.date_label} right={<HeaderBell />} />
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading My Day…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load your day." onRetry={refetch} />
      </View>
    );
  }

  const isTeacher = data.role === "teacher";

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      >
        <DemoSwitcher />

        {isTeacher ? (
          <TeacherDay data={data} onOpen={(id) => router.push(`/session/${id}`)} onLesson={() => toast("Lesson plan opens in the full app")} router={router} toast={toast} />
        ) : (
          <AdminDay data={data} router={router} onOpen={(id) => router.push(`/session/${id}`)} />
        )}
      </ScrollView>
    </View>
  );
}

function TeacherDay({ data, onOpen, onLesson, router, toast }: any) {
  const styles = useStyles();
  const next = data.next;
  return (
    <View>
      {next ? (
        <View style={styles.nextCard}>
          <Text style={styles.nextKicker}>Next class</Text>
          <Text style={styles.nextTitle}>{next.title}</Text>
          <Text style={styles.nextWhere}>
            {next.where} · {next.start}–{next.end}
          </Text>
          <View style={styles.nextRow}>
            <Pressable testID="open-session" onPress={() => onOpen(next.id)} style={styles.nextBtn}>
              <Text style={styles.nextBtnText}>Open session</Text>
            </Pressable>
            <Pressable testID="open-lesson" onPress={onLesson} style={[styles.nextBtn, styles.nextBtnGhost]}>
              <Text style={styles.nextBtnGhostText}>Lesson plan</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <SectionHeader title="Today's timetable" right={`${data.timeline.length} sessions`} />
      {data.timeline.length ? (
        <TimelineRail items={data.timeline} onPress={onOpen} />
      ) : (
        <Card>
          <Text style={styles.rowTitle}>No sessions today</Text>
          <Text style={styles.rowSub}>Add a makeup class from the Schedule tab.</Text>
        </Card>
      )}

      <SectionHeader title="Pay and leave" />
      <Card style={{ padding: 0 }}>
        {data.pay ? (
          <Pressable testID="pay-shortcut" onPress={() => router.push(`/pay/${data.pay.id}`)} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{data.pay.period} salary credited</Text>
              <Text style={styles.rowSub}>
                {data.pay.net_display} · paid {data.pay.paid_on}
              </Text>
            </View>
            <StatusPill label="Paid" kind="ok" />
          </Pressable>
        ) : null}
        <Pressable testID="leave-shortcut" onPress={() => router.push("/leave")} style={[styles.listRow, styles.rowBorder]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Request leave</Text>
            {data.leave ? (
              <Text style={styles.rowSub}>
                Casual {data.leave.casual} days left · Sick {data.leave.sick} days left
              </Text>
            ) : null}
          </View>
          <ArrowRight size={18} color={styles.rowSub.color as string} />
        </Pressable>
      </Card>

      <SectionHeader title="Needs your attention" />
      <Card style={{ padding: 0 }}>
        {data.pending.length ? (
          data.pending.map((p: any, i: number) => (
            <Pressable
              key={i}
              testID={`attention-${i}`}
              onPress={() => toast("Opens the related record in the full app")}
              style={[styles.listRow, i > 0 && styles.rowBorder]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.title}</Text>
                <Text style={styles.rowSub}>{p.sub}</Text>
              </View>
              <StatusPill label={p.tag} kind={p.kind} />
            </Pressable>
          ))
        ) : (
          <View style={styles.listRow}>
            <Text style={styles.rowSub}>{"You're all caught up."}</Text>
          </View>
        )}
      </Card>
      <View style={{ height: 8 }} />
    </View>
  );
}

function AdminDay({ data, router, onOpen }: any) {
  const styles = useStyles();
  const go = (filter: string) => {
    if (filter === "inbox") router.push("/(tabs)/inbox");
    else router.push("/(tabs)/schedule");
  };
  return (
    <View>
      <SectionHeader title="Operational overview" right="This week" />
      {data.metrics.map((m: any) => (
        <MetricTile
          key={m.key}
          testID={`metric-${m.key}`}
          label={m.label}
          sub={m.sub}
          value={m.value}
          onPress={() => go(m.filter)}
        />
      ))}

      <SectionHeader title="Today" right={`${data.timeline.length} sessions`} />
      {data.timeline.length ? (
        <TimelineRail items={data.timeline} onPress={onOpen} />
      ) : (
        <Card>
          <Text style={styles.rowSub}>No sessions scheduled today.</Text>
        </Card>
      )}
      <View style={{ height: 8 }} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  nextCard: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
  },
  nextKicker: { color: colors.onBrandPrimary, opacity: 0.85, fontFamily: fonts.medium, fontSize: 13 },
  nextTitle: { color: colors.onBrandPrimary, fontFamily: fonts.bold, fontSize: 22, marginTop: 4, letterSpacing: -0.3 },
  nextWhere: { color: colors.onBrandPrimary, opacity: 0.85, fontFamily: fonts.regular, fontSize: 13.5, marginTop: 4 },
  nextRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  nextBtn: {
    backgroundColor: colors.surface,
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  nextBtnText: { color: colors.brandPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  nextBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  nextBtnGhostText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14.5 },
  rowSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
}));
