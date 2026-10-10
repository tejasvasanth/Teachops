import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import {
  CalendarBlank,
  ChatCircleText,
  House,
  Tray,
  UserCircle,
} from "phosphor-react-native";
import { Platform } from "react-native";

import { apiFetch } from "@/src/lib/api";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  const { data: inbox } = useQuery({
    queryKey: ["inbox"],
    queryFn: () => apiFetch<{ items: any[] }>("/inbox"),
  });
  const { data: convos } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<{ items: { unread: number }[] }>("/conversations"),
  });

  const pending = (inbox?.items ?? []).filter((r) => r.status === "Pending").length;
  const unreadChats = (convos?.items ?? []).reduce((a, c) => a + (c.unread || 0), 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "My Day",
          tabBarIcon: ({ color, focused }) => <House size={22} color={color} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, focused }) => (
            <CalendarBlank size={22} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarBadge: unreadChats > 0 ? unreadChats : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brandPrimary, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <ChatCircleText size={22} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brandPrimary, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => <Tray size={22} color={color} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          tabBarIcon: ({ color, focused }) => (
            <UserCircle size={22} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
    </Tabs>
  );
}
