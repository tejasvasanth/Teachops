import { useQuery } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/src/auth/AuthContext";
import { apiFetch, apiUrl, authHeader } from "@/src/lib/api";
import { fonts, makeStyles } from "@/src/theme";
import { useGoBack } from "@/src/ui/app-chrome";
import { AppHeader, SecondaryButton, SectionHeader, StateView, StatusPill } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

export default function PayStatement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const goBack = useGoBack();
  const { toast } = useToast();
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!id || downloading) return;
    setDownloading(true);
    try {
      const name = `TeachOps-${(data?.period ?? "statement").replace(/\s+/g, "-")}.pdf`;
      if (Platform.OS === "web") {
        const res = await fetch(apiUrl(`/pay/${id}/pdf`), { headers: authHeader() });
        if (!res.ok) throw new Error("Could not build the statement");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
        toast("Statement downloaded");
        return;
      }
      const file = await File.downloadFileAsync(apiUrl(`/pay/${id}/pdf`), new File(Paths.cache, name), {
        headers: authHeader(),
        idempotent: true,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      } else {
        toast("Statement saved on this device");
      }
    } catch (e: any) {
      toast(e?.message ?? "Could not download the statement");
    } finally {
      setDownloading(false);
    }
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pay", user?.id, id],
    queryFn: () => apiFetch<any>(`/pay/${id}`),
    enabled: !!user && !!id,
  });

  const header = <AppHeader title={data?.period ?? "Statement"} subtitle="Salary statement" onBack={goBack} />;

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
          {(data.lines ?? []).map((l: any, i: number) => (
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
          title={downloading ? "Preparing PDF…" : "Download statement (PDF)"}
          testID="pay-download"
          disabled={downloading}
          onPress={download}
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
