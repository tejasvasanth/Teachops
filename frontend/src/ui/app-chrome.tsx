// Shared header actions: notification bell + demo role switcher banner.

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Bell } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/auth/AuthContext";
import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export function HeaderBell() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ unread: number }>("/notifications"),
  });
  const unread = data?.unread ?? 0;
  return (
    <Pressable
      testID="header-bell"
      hitSlop={10}
      onPress={() => router.push("/notifications")}
      style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
    >
      <Bell size={22} color={colors.onSurface} weight="regular" />
      {unread > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: colors.error,
            borderWidth: 1.5,
            borderColor: colors.surface,
          }}
        />
      ) : null}
    </Pressable>
  );
}

const ROLES = ["Teacher", "Coordinator", "Administrator"] as const;

export function DemoSwitcher() {
  const { user, demoLogin } = useAuth();
  const styles = useStyles();
  const current = (user?.role_label?.includes("Coordinator")
    ? "Coordinator"
    : user?.role === "administrator"
      ? "Administrator"
      : "Teacher") as (typeof ROLES)[number];

  return (
    <View style={styles.wrap} testID="demo-switcher">
      <Text style={styles.caption}>Demo. Preview as</Text>
      <View style={styles.seg}>
        {ROLES.map((r) => {
          const active = r === current;
          return (
            <Pressable
              key={r}
              testID={`demo-switch-${r.toLowerCase()}`}
              onPress={() => !active && demoLogin(r)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  caption: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  seg: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillActive: { backgroundColor: colors.brandPrimary },
  pillText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
  pillTextActive: { color: colors.onBrandPrimary, fontFamily: fonts.semibold },
}));
