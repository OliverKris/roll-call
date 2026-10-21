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
  type DimensionValue,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { initials } from "./format";
import { colors, fonts, radius, space, type } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export type Tone = "neutral" | "positive" | "waiting" | "danger";

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.raised, fg: colors.text },
  positive: { bg: colors.seatSoft, fg: colors.seat },
  waiting: { bg: colors.waitingSoft, fg: colors.waiting },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

// ---------- layout ----------

/**
 * A scrolling screen on the ground colour. `topInset` adds the status-bar
 * safe area for screens without a navigation header. `footer` stays pinned
 * above the home indicator.
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
        indicatorStyle="white"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />
          ) : undefined
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

/** The product's name, set in its own face. Used once, at the top of Discover and on sign-in. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <Text style={[styles.wordmark, { fontSize: size, lineHeight: size * 1.15 }]} accessibilityRole="header">
      Roll Call
    </Text>
  );
}

/** The screen's noun title, the one line that answers its question, and at most one action. */
export function ScreenTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.flex}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <TextButton label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

/** A small grey label over a card, with an optional text action on the right. */
export function SectionLabel({
  label,
  action,
}: {
  label: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionLabelText} accessibilityRole="header">
        {label}
      </Text>
      {action ? <TextButton label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

/** A surface one step lighter than the ground. No border, no shadow. */
export function Card({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.cardPadded]}>{children}</View>;
}

/** A 1px rule between rows of a card. */
export function Rule({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.rule, { marginLeft: inset }]} />;
}

// ---------- text ----------

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function Meta({ children }: { children: ReactNode }) {
  return <Text style={styles.meta}>{children}</Text>;
}

// ---------- controls ----------

const buttonVariants = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.raised, fg: colors.text },
  destructive: { bg: colors.raised, fg: colors.danger },
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
        { backgroundColor: v.bg },
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

export function TextButton({
  label,
  onPress,
  tone = "neutral",
}: {
  label: string;
  onPress: () => void;
  tone?: "neutral" | "danger";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
    >
      <Text style={[styles.textButtonLabel, tone === "danger" && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

/** A filter or choice. Selected chips invert to white; a count sits inside when given. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  count?: number;
}) {
  const fg = selected ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={15} color={fg} /> : null}
      <Text style={[styles.chipLabel, { color: fg }]}>{label}</Text>
      {count !== undefined ? (
        <Text style={[styles.chipCount, { color: selected ? colors.onPrimary : colors.muted }]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

/** One row of chips that scrolls sideways inside its own row, never the page. */
export function ChipScroller({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScroller}
      style={styles.bleed}
    >
      {children}
    </ScrollView>
  );
}

export function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={styles.chipWrap}>{children}</View>;
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
        selectionColor={colors.text}
        keyboardAppearance="dark"
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
      {hint ? <Text style={styles.meta}>{hint}</Text> : null}
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
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  noun = "seat",
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  noun?: string;
}) {
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => step(-1)}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel={`One fewer ${noun}`}
        style={({ pressed }) => [styles.stepButton, value <= min && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPress={() => step(1)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`One more ${noun}`}
        style={({ pressed }) => [styles.stepButton, value >= max && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

// ---------- status and feedback ----------

/** A status beside a value or inside a row: a dark tint with text of the same hue. */
export function Pill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** A confirmation or a problem that isn't tied to one block. */
export function Notice({ text, tone = "danger" }: { text: string | null; tone?: Tone }) {
  if (!text) return null;
  const t = tones[tone];
  const icon: IconName =
    tone === "danger" ? "alert-circle-outline" : tone === "positive" ? "checkmark-circle-outline" : "information-circle-outline";
  return (
    <View style={styles.notice} accessibilityRole="alert">
      <Ionicons name={icon} size={18} color={t.fg} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

/** A block that failed to load: what failed, and a way to try again. Shown inside the block. */
export function BlockError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={styles.blockError} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
      <Text style={styles.blockErrorText}>{text}</Text>
      <TextButton label="Retry" onPress={onRetry} />
    </View>
  );
}

/** An empty block keeps its frame: one sentence, and the next step when there is one. */
export function EmptyBlock({
  text,
  action,
}: {
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}

/** A flat grey bar where a value will land, at the value's real size. */
export function Bar({ width, height = 14 }: { width: DimensionValue; height?: number }) {
  return <View style={[styles.bar, { width, height }]} />;
}

// ---------- people ----------

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}>{initials(name)}</Text>
    </View>
  );
}

/** A tappable row for settings-style lists. */
export function ListRow({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const content = (
    <>
      <Text style={[styles.body, styles.flex, destructive && { color: colors.danger }]}>{label}</Text>
      {value ? <Text style={styles.listValue}>{value}</Text> : null}
      {onPress && !destructive ? <Ionicons name="chevron-forward" size={16} color={colors.faint} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}

export const rowPressedStyle = { backgroundColor: colors.raised };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  screenContent: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xl },
  footer: {
    backgroundColor: colors.ground,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  flex: { flex: 1 },
  wordmark: { fontFamily: fonts.wordmark, color: colors.text, letterSpacing: -0.4 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingTop: space.sm },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted, marginTop: 4 },
  section: { gap: space.sm },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 24,
  },
  sectionLabelText: { ...type.label, color: colors.muted, fontWeight: "500" },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: "hidden" },
  cardPadded: { padding: space.lg, gap: space.md },
  rule: { height: 1, backgroundColor: colors.rule },
  body: { ...type.body, color: colors.text },
  muted: { color: colors.muted },
  meta: { ...type.label, color: colors.muted },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm },
  button: {
    minHeight: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  textButton: { minHeight: 32, justifyContent: "center" },
  textButtonLabel: { ...type.body, fontWeight: "600", color: colors.text },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  chipOn: { backgroundColor: colors.primary },
  chipLabel: { fontSize: 14, fontWeight: "500" },
  chipCount: { fontSize: 14, fontWeight: "500", ...type.tabular },
  chipScroller: { gap: space.sm, paddingHorizontal: space.lg },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  bleed: { marginHorizontal: -space.lg, flexGrow: 0 },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.raised,
    borderRadius: radius.pill,
    padding: 3,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill },
  segmentOn: { backgroundColor: colors.control },
  segmentLabel: { fontSize: 14, fontWeight: "500", color: colors.muted },
  segmentLabelOn: { color: colors.text },
  field: { gap: space.sm },
  fieldLabel: { ...type.label, fontWeight: "500", color: colors.muted },
  input: {
    minHeight: 48,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.raised,
    borderRadius: radius.inner,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: { borderColor: colors.muted },
  inputMultiline: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  reveal: { position: "absolute", right: 14, bottom: 14 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.raised,
    borderRadius: radius.pill,
  },
  stepButton: { width: 48, height: 44, alignItems: "center", justifyContent: "center" },
  stepValue: {
    ...type.heading,
    ...type.tabular,
    minWidth: 32,
    textAlign: "center",
    color: colors.text,
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    minHeight: 22,
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  pillLabel: { ...type.small },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.inner,
    backgroundColor: colors.surface,
  },
  noticeText: { ...type.body, color: colors.text, flex: 1 },
  blockError: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  blockErrorText: { ...type.label, color: colors.text, flex: 1 },
  empty: { padding: space.lg, gap: space.lg },
  emptyText: { ...type.body, color: colors.muted },
  bar: { backgroundColor: colors.raised, borderRadius: 4 },
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: colors.raised },
  avatarText: { color: colors.text, fontWeight: "600" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  listValue: { ...type.body, color: colors.muted },
  rowPressed: rowPressedStyle,
});
