import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentProps, type ComponentRef, type ReactNode, type Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { initials } from "./format";
import { colors, fonts, pieceFor, radius, space, type } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export type Tone = "neutral" | "positive" | "waiting" | "danger";

const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.paper, fg: colors.slate },
  positive: { bg: colors.positiveSoft, fg: colors.positive },
  waiting: { bg: colors.waitingSoft, fg: colors.waiting },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

// ---------- layout ----------

/**
 * A scrolling screen. `topInset` adds the status-bar safe area for screens
 * without a navigation header. `footer` stays pinned above the home indicator.
 */
export function Screen({
  children,
  footer,
  topInset = false,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  footer?: ReactNode;
  topInset?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={topInset ? ["top"] : []}>
      <ScrollView
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
      {footer ? (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          {footer}
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

export function LargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.largeTitle}>
      <Text style={styles.display} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.heading} accessibilityRole="header">
          {title}
        </Text>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A white group with hairline separators between its children. */
export function Group({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

// ---------- text ----------

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text style={styles.caption}>{children}</Text>;
}

// ---------- controls ----------

const buttonVariants = {
  primary: { bg: colors.ink, fg: colors.surface, border: colors.ink },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.lineStrong },
  destructive: { bg: colors.surface, fg: colors.danger, border: colors.lineStrong },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: keyof typeof buttonVariants;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.inline}>
          {icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
          <Text style={[styles.buttonLabel, { color: v.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Pill({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  const fg = selected ? colors.surface : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, selected && styles.pillOn, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={15} color={fg} /> : null}
      <Text style={[styles.pillLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A single row of pills that scrolls sideways. */
export function PillScroller({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillScroller}
      style={styles.bleed}
    >
      {children}
    </ScrollView>
  );
}

/** Pills that wrap onto several lines. */
export function PillWrap({ children }: { children: ReactNode }) {
  return <View style={styles.pillWrap}>{children}</View>;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** What a ref to one of our text fields points at (React Native 0.88 types). */
export type TextInputHandle = ComponentRef<typeof TextInput>;

type FieldProps = TextInputProps & { label: string; hint?: string; ref?: Ref<TextInputHandle> };

export function Field({ label, hint, ref, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.faint}
        {...props}
        style={[styles.input, focused && styles.inputFocused, props.multiline && styles.inputMultiline]}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />
      {hint ? <Text style={styles.caption}>{hint}</Text> : null}
    </View>
  );
}

export function PasswordField(props: Omit<FieldProps, "hint">) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Field {...props} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        style={styles.reveal}
      >
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.slate} />
      </Pressable>
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => step(-1)}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel="One fewer seat"
        style={[styles.stepButton, value <= min && styles.disabled]}
      >
        <Ionicons name="remove" size={20} color={colors.ink} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPress={() => step(1)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel="One more seat"
        style={[styles.stepButton, value >= max && styles.disabled]}
      >
        <Ionicons name="add" size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

// ---------- feedback ----------

export function Notice({ text, tone = "danger" }: { text: string | null; tone?: Tone }) {
  if (!text) return null;
  const t = toneColors[tone];
  const icon: IconName =
    tone === "danger" ? "alert-circle" : tone === "positive" ? "checkmark-circle" : "information-circle";
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <Ionicons name={icon} size={18} color={t.fg} />
      <Text style={[styles.noticeText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function Tag({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = toneColors[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      <Text style={[styles.tagLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={32} color={colors.faint} />
      <Text style={styles.heading}>{title}</Text>
      <Text style={[styles.secondary, styles.center]}>{body}</Text>
      {action ? (
        <View style={styles.emptyAction}>
          <Button label={action.label} variant="secondary" onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

// ---------- people ----------

export function Avatar({ name, id, size = 56 }: { name: string; id: string | null; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: pieceFor(id) },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

/** A tappable row for settings-style lists. */
export function ListRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const fg = destructive ? colors.danger : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[styles.body, styles.flex, { color: fg }]}>{label}</Text>
      {destructive ? null : <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  screenContent: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xl },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  largeTitle: { gap: space.xs, paddingTop: space.lg },
  display: { ...type.display, color: colors.ink },
  subtitle: { ...type.secondary, color: colors.slate },
  section: { gap: space.md },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionAction: { ...type.secondary, color: colors.ink, fontWeight: "600" },
  heading: { ...type.heading, color: colors.ink },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    overflow: "hidden",
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  body: { ...type.body, color: colors.ink },
  secondary: { ...type.secondary, color: colors.slate },
  muted: { color: colors.slate },
  caption: { ...type.caption, color: colors.slate },
  center: { textAlign: "center" },
  flex: { flex: 1 },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  buttonLabel: { fontSize: 17, fontWeight: "600" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillLabel: { fontSize: 15, fontWeight: "500" },
  pillScroller: { gap: space.sm, paddingHorizontal: space.lg },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  bleed: { marginHorizontal: -space.lg, flexGrow: 0 },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#E3E6E0",
    borderRadius: radius.sm + 2,
    padding: 2,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: radius.sm },
  segmentOn: {
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentLabel: { fontSize: 14, fontWeight: "500", color: colors.slate },
  segmentLabelOn: { color: colors.ink, fontWeight: "600" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 15, fontWeight: "600", color: colors.ink },
  input: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.ink, borderWidth: 1.5 },
  inputMultiline: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  reveal: { position: "absolute", right: 14, bottom: 15 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
  },
  stepButton: { width: 48, height: 46, alignItems: "center", justifyContent: "center" },
  stepValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    minWidth: 36,
    textAlign: "center",
    color: colors.ink,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  noticeText: { ...type.secondary, flex: 1 },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  tagLabel: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyAction: { alignSelf: "stretch", marginTop: space.sm },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, color: "#FFFFFF" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  rowPressed: { backgroundColor: colors.paper },
});
