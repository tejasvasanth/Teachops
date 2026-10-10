import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles } from "@/src/theme";
import { AppHeader, SecondaryButton, SectionHeader, StateView, StatusPill } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

export default function PayStatement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const router = useRouter();
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pay", id],
    queryFn: () => apiFetch<any>(`/pay/${id}`),
  });

  const header = <AppHeader title={data?.period ?? "Statement"} subtitle="Salary statement" onBack={() => router.back()} />;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading statement…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load this statement." onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Net payable</Text>
            <Text style={styles.heroSub}>
              Recorded as paid {data.paid_on} · bank ref {data.reference}
            </Text>
          </View>
          <Text style={styles.heroValue}>{data.net_display}</Text>
        </View>
        <View style={{ alignSelf: "flex-start", marginTop: 10 }}>
          <StatusPill label="Paid" kind="ok" />
        </View>

        <SectionHeader title="Calculation" />
        <View style={styles.list}>
          {data.lines.map((l: any, i: number) => (
            <View key={i} style={[styles.row, i > 0 && styles.border]}>
              <Text style={styles.rowLabel}>{l.label}</Text>
              <Text style={styles.rowAmount}>₹{l.amount}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Payment status is entered by your finance team. TeachOps records payment status only — it does not transfer money.
          This is demo data.
        </Text>
        <SecondaryButton
          title="Download statement (PDF)"
          testID="pay-download"
          onPress={() => toast("PDF export opens in the full app")}
          style={{ marginTop: 14 }}
        />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
  },
  heroLabel: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15 },
  heroSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  heroValue: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 24, fontVariant: ["tabular-nums"] },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 13 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowLabel: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: 14 },
  rowAmount: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 14.5, fontVariant: ["tabular-nums"] },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 14, lineHeight: 18 },
}));
