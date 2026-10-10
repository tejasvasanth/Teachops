import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PaperPlaneRight } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { AppHeader, StateView, StatusPill } from "@/src/ui/kit";

export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [text, setText] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["thread", id],
    queryFn: () => apiFetch<any>(`/conversations/${id}/messages`),
  });

  useEffect(() => {
    if (data) {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
    }
  }, [data]);

  const send = useMutation({
    mutationFn: (t: string) => apiFetch(`/conversations/${id}/messages`, { method: "POST", body: { text: t } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["thread", id] });
    },
  });

  const header = (
    <AppHeader
      title={data?.conversation?.title ?? "Thread"}
      subtitle={data?.conversation?.official ? "Official thread, kept in organisation records" : data?.conversation?.subtitle}
      onBack={() => router.back()}
    />
  );

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
        <StateView variant="error" message="Could not load this thread." onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {data.conversation.official ? (
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <StatusPill label="Official · retained & exportable" kind="n" />
          </View>
        ) : null}
        {data.messages.map((m: any) => (
          <View key={m.id} style={[styles.bubbleWrap, m.mine ? styles.mine : styles.theirs]}>
            <Text style={styles.sender}>
              {m.sender_name} · {m.time}
            </Text>
            <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, m.mine && { color: colors.onBrandPrimary }]}>{m.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            testID="thread-input"
            value={text}
            onChangeText={setText}
            placeholder="Write a reply"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable
            testID="thread-send"
            onPress={() => text.trim() && send.mutate(text.trim())}
            style={styles.sendBtn}
          >
            <PaperPlaneRight size={20} color={colors.onBrandPrimary} weight="fill" />
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  messages: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  bubbleWrap: { marginVertical: 6, maxWidth: "86%" },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  sender: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginBottom: 3, marginHorizontal: 4 },
  bubble: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  bubbleTheirs: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
  bubbleText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 20 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    backgroundColor: colors.surfaceSecondary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
}));
