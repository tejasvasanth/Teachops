// TeachOps shared UI kit — restrained, premium, hairline borders, tabular
// numerals, no emoji, no gradients.

import { CaretLeft } from "phosphor-react-native";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, hexA, makeStyles, useTheme } from "@/src/theme";

export type StatusKind = "ok" | "warn" | "bad" | "n" | "info";

function statusColor(kind: StatusKind, colors: ReturnType<typeof useTheme>["colors"]) {
  switch (kind) {
    case "ok":
      return colors.success;
    case "warn":
      return colors.warning;
    case "bad":
      return colors.error;
    case "info":
      return colors.info;
    default:
      return colors.brand;
  }
}

export function StatusPill({
  label,
  kind = "n",
  testID,
}: {
  label: string;
  kind?: StatusKind;
  testID?: string;
}) {
  const { colors } = useTheme();
  const c = statusColor(kind, colors);
  return (
    <View
      testID={testID}
      style={{
        alignSelf: "flex-start",
        backgroundColor: hexA(c, 0.14),
        borderColor: hexA(c, 0.32),
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: c, fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 0.1 }}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: colors.brandTertiary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.onBrandTertiary, fontFamily: fonts.semibold, fontSize: size * 0.34 }}>
        {initials}
      </Text>
    </View>
  );
}

export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  const styles = useKit();
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  testID,
  style,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const styles = useKit();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btnPri,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onBrandPrimary} />
      ) : (
        <Text style={styles.btnPriText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  disabled,
  testID,
  style,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  const styles = useKit();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btnSec, disabled && { opacity: 0.5 }, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={styles.btnSecText}>{title}</Text>
    </Pressable>
  );
}

// Generic equal-width segmented control.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const styles = useKit();
  return (
    <View style={styles.seg} testID={testID}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, i > 0 && styles.segDivider, active && styles.segItemActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ATT = [
  { code: "P", color: "success" as const },
  { code: "A", color: "error" as const },
  { code: "L", color: "warning" as const },
  { code: "E", color: "brand" as const },
];

export function AttendanceControl({
  value,
  onChange,
  disabled,
  testID,
}: {
  value?: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useKit();
  return (
    <View style={styles.att} testID={testID}>
      {ATT.map((a, i) => {
        const active = value === a.code;
        const fill = colors[a.color];
        return (
          <Pressable
            key={a.code}
            testID={testID ? `${testID}-${a.code}` : undefined}
            disabled={disabled}
            onPress={() => onChange(a.code)}
            style={[
              styles.attItem,
              i > 0 && styles.segDivider,
              active && { backgroundColor: fill },
            ]}
          >
            <Text
              style={[
                styles.attText,
                active && { color: "#FFFFFF", fontFamily: fonts.bold },
              ]}
            >
              {a.code}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: string }) {
  const styles = useKit();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

export function MetricTile({
  label,
  sub,
  value,
  onPress,
  testID,
}: {
  label: string;
  sub?: string;
  value: string | number;
  onPress?: () => void;
  testID?: string;
}) {
  const styles = useKit();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.metric, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </Pressable>
  );
}

export type TimelineItem = {
  id: string;
  title: string;
  start: string;
  where: string;
  status: string;
  status_kind: StatusKind;
};

export function TimelineRail({
  items,
  onPress,
}: {
  items: TimelineItem[];
  onPress?: (id: string) => void;
}) {
  const styles = useKit();
  const { colors } = useTheme();
  return (
    <View>
      {items.map((it, idx) => {
        const last = idx === items.length - 1;
        return (
          <Pressable
            key={it.id}
            testID={`timeline-${it.id}`}
            onPress={() => onPress?.(it.id)}
            style={({ pressed }) => [styles.slot, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.slotTime}>{it.start}</Text>
            <View style={styles.railCol}>
              {!last ? <View style={styles.railLine} /> : null}
              <View
                style={[
                  styles.railDot,
                  { borderColor: statusColor(it.status_kind, colors) },
                  it.status_kind === "n" && { backgroundColor: statusColor(it.status_kind, colors) },
                ]}
              />
              <Card style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.slotTitle}>{it.title}</Text>
                <Text style={styles.slotWhere}>{it.where}</Text>
                <View style={{ marginTop: 6 }}>
                  <StatusPill label={it.status} kind={it.status_kind} />
                </View>
              </Card>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StateView({
  variant,
  title,
  message,
  onRetry,
}: {
  variant: "loading" | "empty" | "error";
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useKit();
  if (variant === "loading") {
    return (
      <View style={styles.stateWrap} testID="state-loading">
        <ActivityIndicator color={colors.brand} />
        {title ? <Text style={styles.stateTitle}>{title}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.stateWrap} testID={`state-${variant}`}>
      <Text style={styles.stateTitle}>{title ?? (variant === "empty" ? "Nothing here yet" : "Something went wrong")}</Text>
      {message ? <Text style={styles.stateMsg}>{message}</Text> : null}
      {variant === "error" && onRetry ? (
        <SecondaryButton title="Retry" onPress={onRetry} testID="state-retry" style={{ marginTop: 12 }} />
      ) : null}
    </View>
  );
}

// Sticky app header. Lives above the screen ScrollView so it stays fixed.
export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const styles = useKit();
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      {onBack ? (
        <Pressable testID="header-back" onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <CaretLeft size={20} color={colors.onSurface} weight="bold" />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const useKit = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  btnPri: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPriText: { color: colors.onBrandPrimary, fontFamily: fonts.semibold, fontSize: 15 },
  btnSec: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14 },
  seg: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  segItem: { flex: 1, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  segItemActive: { backgroundColor: colors.brandPrimary },
  segDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  segText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  segTextActive: { color: colors.onBrandPrimary, fontFamily: fonts.semibold },
  att: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  attItem: { width: 36, height: 34, alignItems: "center", justifyContent: "center" },
  attText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15 },
  sectionRight: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  metricLabel: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: 14.5 },
  metricSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
  metricValue: {
    color: colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  slot: { flexDirection: "row", paddingBottom: 14 },
  slotTime: {
    width: 46,
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    paddingTop: 2,
  },
  railCol: { flex: 1, flexDirection: "row", position: "relative" },
  railLine: {
    position: "absolute",
    left: 4,
    top: 14,
    bottom: -14,
    width: 1,
    backgroundColor: colors.border,
  },
  railDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: colors.surface,
    marginTop: 6,
  },
  slotTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15 },
  slotWhere: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.2 },
  headerSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 1 },
  stateWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 6 },
  stateTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: 15, textAlign: "center" },
  stateMsg: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, textAlign: "center", paddingHorizontal: 24 },
}));

export { ScrollView };
