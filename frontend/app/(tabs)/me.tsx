import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowRight, SignOut } from "phosphor-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/src/auth/AuthContext";
import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { HeaderBell } from "@/src/ui/app-chrome";
import { AppHeader, Avatar, PrimaryButton, SectionHeader, StatusPill } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

export default function Me() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { data: bal } = useQuery({
    queryKey: ["leave-balances"],
    queryFn: () => apiFetch<any>("/leave/balances"),
    enabled: user?.role === "teacher",
  });
  const { data: pay } = useQuery({
    queryKey: ["pay"],
    queryFn: () => apiFetch<{ items: any[] }>("/pay"),
  });

  const isTeacher = user?.role === "teacher";

  return (
    <View style={styles.screen}>
      <AppHeader title="Me" subtitle={`${user?.name} · ${user?.role_label}`} right={<HeaderBell />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profile}>
          <Avatar initials={user?.initials ?? "?"} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.meta}>
              {user?.role_label}
              {user?.centre ? ` · ${user.centre}` : ""}
            </Text>
            <Text style={styles.meta}>{user?.organisation}</Text>
          </View>
        </View>

        {isTeacher ? (
          <>
            <SectionHeader title="Leave balance" />
            <View style={styles.list}>
              <Row label="Casual leave" sub={`Resets ${bal?.resets ?? "1 April"}`} value={bal?.casual ?? "–"} />
              <Row label="Sick leave" sub={`Resets ${bal?.resets ?? "1 April"}`} value={bal?.sick ?? "–"} border />
              <Row label="Training leave" sub={`Resets ${bal?.resets ?? "1 April"}`} value={bal?.training ?? "–"} border />
            </View>
            <PrimaryButton title="Request leave" testID="me-request-leave" onPress={() => router.push("/leave")} style={{ marginTop: 12 }} />
          </>
        ) : null}

        <SectionHeader title="Pay" right={isTeacher ? undefined : "All teachers"} />
        <View style={styles.list}>
          {(pay?.items ?? []).slice(0, 8).map((p, i) => (
            <Pressable
              key={p.id}
              testID={`pay-${i}`}
              onPress={() => router.push(`/pay/${p.id}`)}
              style={[styles.payRow, i > 0 && styles.border]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {isTeacher ? `${p.period} statement` : `${p.teacher_name} · ${p.period}`}
                </Text>
                <Text style={styles.rowSub}>
                  {p.net_display} · paid {p.paid_on}
                </Text>
              </View>
              <StatusPill label={p.status} kind="ok" />
            </Pressable>
          ))}
          {!pay?.items?.length ? (
            <View style={styles.payRow}>
              <Text style={styles.rowSub}>No statements yet.</Text>
            </View>
          ) : null}
        </View>

        <SectionHeader title="Expenses" />
        <Pressable testID="me-expense" onPress={() => toast("The expense claim form opens in the full app")} style={styles.list}>
          <View style={styles.payRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Submit a travel claim</Text>
              <Text style={styles.rowSub}>Reimbursed with your next pay period</Text>
            </View>
            <ArrowRight size={18} color={colors.muted} />
          </View>
        </Pressable>

        <Pressable testID="logout" onPress={logout} style={styles.logout}>
          <SignOut size={18} color={colors.error} weight="bold" />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
        <Text style={styles.foot}>Demo data. TeachOps records payment status only; it does not move money.</Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, sub, value, border }: { label: string; sub: string; value: string | number; border?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.payRow, border && styles.border]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={styles.num}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
  },
  name: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 18 },
  meta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  payRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14.5 },
  rowSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  num: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 20, fontVariant: ["tabular-nums"] },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { color: colors.error, fontFamily: fonts.semibold, fontSize: 14.5 },
  foot: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 17 },
}));
