import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Plus } from "phosphor-react-native";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { HeaderBell } from "@/src/ui/app-chrome";
import { AppHeader, Avatar, StateView, StatusPill } from "@/src/ui/kit";

export default function Chat() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<{ items: any[] }>("/conversations"),
  });

  const header = <AppHeader title="Chat" subtitle="Official messages are kept on record" right={<HeaderBell />} />;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading messages…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load conversations." onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      >
        {data.items.length ? (
          <View style={styles.list}>
            {data.items.map((c, i) => (
              <Pressable
                key={c.id}
                testID={`thread-${i}`}
                onPress={() => router.push(`/thread/${c.id}`)}
                style={[styles.row, i > 0 && styles.rowBorder]}
              >
                <Avatar initials={c.title.slice(0, 2).toUpperCase()} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {c.title}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {c.last ? `${c.last.sender}: ${c.last.text}` : c.subtitle}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {c.official ? <StatusPill label="Official" kind="n" /> : null}
                  {c.unread > 0 ? <Text style={styles.unread}>{c.unread} new</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <StateView variant="empty" title="No conversations yet" message="Start a message instead of email." />
        )}
      </ScrollView>

      <Pressable
        testID="compose-fab"
        onPress={() => router.push("/compose")}
        style={[styles.fab, { bottom: 16 }]}
      >
        <Plus size={22} color={colors.onBrandPrimary} weight="bold" />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 90 },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 14.5 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  unread: { color: colors.brandPrimary, fontFamily: fonts.semibold, fontSize: 12.5 },
  fab: {
    position: "absolute",
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
}));
