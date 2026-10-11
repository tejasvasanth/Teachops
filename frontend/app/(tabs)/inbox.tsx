import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/src/auth/AuthContext";
import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { HeaderBell } from "@/src/ui/app-chrome";
import { AppHeader, Avatar, PrimaryButton, SecondaryButton, StateView, StatusPill } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

const STATUS_KIND: Record<string, any> = {
  Pending: "warn",
  Approved: "ok",
  Rejected: "bad",
  "Changes Requested": "n",
};

export default function Inbox() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["inbox", user?.id],
    queryFn: () => apiFetch<{ items: any[]; can_decide: boolean }>("/inbox"),
    enabled: !!user,
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; decision: string; reason?: string }) =>
      apiFetch(`/requests/${v.id}/decision`, { method: "POST", body: { decision: v.decision, reason: v.reason } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["inbox", user?.id] });
      qc.invalidateQueries({ queryKey: ["my-day", user?.id] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast(v.decision === "Rejected" ? "Rejected. The requester has been notified." : "Approved. The requester has been notified.");
    },
    onError: (e: any) => toast(e?.message ?? "Could not process"),
  });

  const submitReject = () => {
    if (!reason.trim()) {
      toast("A reason is required to reject");
      return;
    }
    decide.mutate({ id: rejecting.id, decision: "Rejected", reason: reason.trim() });
    setRejecting(null);
    setReason("");
  };

  const isTeacher = user?.role === "teacher";
  const header = (
    <AppHeader
      title={isTeacher ? "My requests" : "Inbox"}
      subtitle={isTeacher ? "Leave, plans, and claims" : "Approvals and tasks"}
      right={<HeaderBell />}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="loading" title="Loading inbox…" />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <StateView variant="error" message="Could not load the inbox." onRetry={refetch} />
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
          data.items.map((r) => {
            const canDecide = data.can_decide && r.status === "Pending";
            return (
              <View key={r.id} style={styles.card} testID={`request-${r.id}`}>
                <View style={styles.cardTop}>
                  <Avatar initials={r.requester_initials ?? "?"} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{r.title}</Text>
                    <Text style={styles.sub}>
                      {r.kind} · {r.requester_name}
                    </Text>
                    <Text style={styles.detail}>{r.detail}</Text>
                  </View>
                  <StatusPill label={r.status} kind={STATUS_KIND[r.status] ?? "n"} />
                </View>
                {canDecide ? (
                  <View style={styles.actions}>
                    <PrimaryButton
                      title="Approve"
                      testID={`approve-${r.id}`}
                      onPress={() => decide.mutate({ id: r.id, decision: "Approved" })}
                      style={{ flex: 1 }}
                    />
                    <SecondaryButton
                      title="Reject with reason"
                      testID={`reject-${r.id}`}
                      onPress={() => {
                        setRejecting(r);
                        setReason("");
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                ) : null}
                {r.status !== "Pending" && r.decision_reason ? (
                  <Text style={styles.reason}>Reason: {r.decision_reason}</Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <StateView variant="empty" title="You're all caught up." message="Requests will appear here." />
        )}
        <View style={{ height: 8 }} />
      </ScrollView>

      <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <View style={styles.sheetWrap}>
        <Pressable style={styles.scrim} onPress={() => setRejecting(null)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <View style={styles.sheet} testID="reject-sheet">
            <Text style={styles.sheetTitle}>Reject request</Text>
            <Text style={styles.sheetSub}>{rejecting?.title}</Text>
            <TextInput
              testID="reject-reason"
              value={reason}
              onChangeText={setReason}
              placeholder="Required: explain why this is rejected"
              placeholderTextColor={colors.muted}
              multiline
              style={styles.reasonInput}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SecondaryButton title="Cancel" onPress={() => setRejecting(null)} style={{ flex: 1 }} />
              <PrimaryButton title="Reject" testID="reject-confirm" onPress={submitReject} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 14.5 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
  detail: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: 13, marginTop: 5, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  reason: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 10 },
  scrim: { ...StyleSheetAbsolute(), backgroundColor: "rgba(0,0,0,0.4)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    gap: 10,
  },
  sheetTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 18 },
  sheetSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 84,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    textAlignVertical: "top",
    marginVertical: 4,
  },
}));

function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
