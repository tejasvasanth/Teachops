import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/src/auth/AuthContext";
import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { HeaderBell } from "@/src/ui/app-chrome";
import { AppHeader, Card, SectionHeader, StateView, TimelineRail } from "@/src/ui/kit";

export default function Schedule() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["schedule", user?.id],
    queryFn: () => apiFetch<any>("/schedule"),
    enabled: !!user,
  });

  const header = <AppHeader title="Schedule" subtitle="This week" right={<HeaderBell />} />;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading schedule…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load the schedule." onRetry={refetch} />
      </View>
    );
  }

  const todayInWeek = data.week.some((w: any) => w.date === data.today);
  const active = selected ?? (todayInWeek ? data.today : data.week[0]?.date);
  const dayItems = data.days[active] ?? [];
  const activeLabel = data.week.find((w: any) => w.date === active);

  return (
    <View style={styles.screen}>
      {header}
      {/* day chips row — horizontal scroller, part of the sticky header area */}
      <View style={styles.chipBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {data.week.map((w: any) => {
            const isActive = w.date === active;
            const isToday = w.date === data.today;
            return (
              <Pressable
                key={w.date}
                testID={`day-${w.dow}`}
                onPress={() => setSelected(w.date)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipDow, isActive && styles.chipTextActive]}>{w.dow}</Text>
                <Text style={[styles.chipDom, isActive && styles.chipTextActive]}>{w.dom}</Text>
                {isToday && !isActive ? <View style={styles.todayDot} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      >
        <SectionHeader
          title={activeLabel ? `${activeLabel.dow}, ${activeLabel.dom}` : "Day"}
          right={`${dayItems.length} sessions`}
        />
        {dayItems.length ? (
          <TimelineRail items={dayItems} onPress={(id) => router.push(`/session/${id}`)} />
        ) : (
          <Card>
            <Text style={styles.empty}>No classes scheduled.</Text>
            <Text style={styles.emptySub}>Add a makeup class or recurring session here.</Text>
          </Card>
        )}

        {data.conflicts
          .filter((c: any) => c.date === active)
          .map((c: any, i: number) => (
            <Card key={i} style={styles.conflict} testID={`conflict-${i}`}>
              <Text style={styles.conflictTitle}>Resolve travel conflict</Text>
              <Text style={styles.conflictText}>{c.detail}</Text>
            </Card>
          ))}
        <View style={{ height: 8 }} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  chipBar: { borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface },
  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    flexShrink: 0,
    width: 52,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipDow: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
  chipDom: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 17, marginTop: 1, fontVariant: ["tabular-nums"] },
  chipTextActive: { color: colors.onBrandPrimary },
  todayDot: {
    position: "absolute",
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brandPrimary,
  },
  empty: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14.5 },
  emptySub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  conflict: { marginTop: 8, backgroundColor: colors.surfaceSecondary },
  conflictTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 14.5 },
  conflictText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 4, lineHeight: 19 },
}));
