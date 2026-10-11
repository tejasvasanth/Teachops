import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/src/auth/AuthContext";
import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles } from "@/src/theme";
import { useGoBack } from "@/src/ui/app-chrome";
import { AppHeader, StateView, StatusPill } from "@/src/ui/kit";

export default function Notifications() {
  const styles = useStyles();
  const router = useRouter();
  const goBack = useGoBack();
  const qc = useQueryClient();
  const { user } = useAuth();
  const armed = useRef(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => apiFetch<{ items: any[] }>("/notifications"),
    enabled: !!user,
  });

  const readAll = useMutation({
    mutationFn: () => apiFetch("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  // Mark all read when the user actually leaves, not on the dev double-mount.
  useEffect(() => {
    const arm = setTimeout(() => {
      armed.current = true;
    }, 400);
    return () => {
      clearTimeout(arm);
      if (armed.current) readAll.mutate();
    };
  }, []);

  const go = (action: string) => {
    if (action === "pay") router.replace("/(tabs)/me");
    else if (action === "chat") router.replace("/(tabs)/chat");
    else if (action === "inbox") router.replace("/(tabs)/inbox");
    else goBack();
  };

  const header = <AppHeader title="Notifications" subtitle="Salary, approvals, replies" onBack={goBack} />;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load notifications." onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {data.items.length ? (
          <View style={styles.list}>
            {data.items.map((n, i) => (
              <Pressable key={n.id} testID={`notif-${i}`} onPress={() => go(n.action)} style={[styles.row, i > 0 && styles.border]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.sub}>{n.detail}</Text>
                </View>
                {n.unread ? <StatusPill label="New" kind="n" /> : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <StateView variant="empty" title="No notifications" message="You're all caught up." />
        )}
        <Text style={styles.foot}>Simulated notifications are labelled. No email or SMS is sent.</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  title: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14.5 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  foot: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, textAlign: "center", marginTop: 16 },
}));
