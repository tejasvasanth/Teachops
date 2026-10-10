import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Check } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { apiFetch } from "@/src/lib/api";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { AppHeader, PrimaryButton } from "@/src/ui/kit";
import { useToast } from "@/src/ui/toast";

const RECIPIENTS = ["Administration office", "Suresh Kannan (Adyar coordinator)", "Adyar centre (group)"];

export default function Compose() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [to, setTo] = useState(RECIPIENTS[0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [official, setOfficial] = useState(true);

  const send = useMutation({
    mutationFn: () => apiFetch("/conversations", { method: "POST", body: { to, subject, text: body, official } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast("Message sent in TeachOps");
      router.replace(`/thread/${r.id}`);
    },
    onError: (e: any) => toast(e?.message ?? "Could not send"),
  });

  const submit = () => {
    if (!subject.trim() || !body.trim()) {
      toast("Add a subject and a message");
      return;
    }
    send.mutate();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="New message" subtitle="Use this instead of email" onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={styles.content} bottomOffset={16} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>To</Text>
        <View style={styles.options}>
          {RECIPIENTS.map((r) => {
            const active = r === to;
            return (
              <Pressable key={r} testID={`to-${r}`} onPress={() => setTo(r)} style={[styles.option, active && styles.optionActive]}>
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{r}</Text>
                {active ? <Check size={16} color={colors.brandPrimary} weight="bold" /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Subject</Text>
        <TextInput
          testID="compose-subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="What is this about?"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Message</Text>
        <TextInput
          testID="compose-body"
          value={body}
          onChangeText={setBody}
          placeholder="Write your message"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.textarea]}
        />

        <View style={styles.officialRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.officialTitle}>Official</Text>
            <Text style={styles.officialSub}>Keep a record and allow export</Text>
          </View>
          <Switch
            testID="compose-official"
            value={official}
            onValueChange={setOfficial}
            trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
          />
        </View>

        <PrimaryButton title="Send message" testID="compose-send" onPress={submit} loading={send.isPending} style={{ marginTop: 16 }} />
        <Text style={styles.foot}>Stays inside TeachOps. No email or SMS is sent.</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: 13, marginTop: 14, marginBottom: 6 },
  options: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  optionActive: { backgroundColor: colors.brandSecondary },
  optionText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: 14 },
  optionTextActive: { fontFamily: fonts.semibold },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    backgroundColor: colors.surface,
  },
  textarea: { minHeight: 120, textAlignVertical: "top" },
  officialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
  },
  officialTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 14.5 },
  officialSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
  foot: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, textAlign: "center", marginTop: 14 },
}));
