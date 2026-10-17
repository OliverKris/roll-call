import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
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

import { colors, radius } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

const tones: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: "#EFEDE8", fg: colors.muted },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    primary: { bg: colors.primarySoft, fg: colors.primary },
};

export function Screen({
    children,
    refreshing = false,
    onRefresh,
}: {
    children: ReactNode;
    refreshing?: boolean;
    onRefresh?: () => void;
}) {
    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.screenContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={
                onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                    />
                ) : undefined
            }
        >
            {children}
        </ScrollView>
    );
}

export function Card({
    children,
    onPress,
}: {
    children: ReactNode;
    onPress?: () => void;
}) {
    if (!onPress) return <View style={styles.card}>{children}</View>;
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
            {children}
        </Pressable>
    );
}

const buttonVariants = {
    primary: { bg: colors.primary, fg: "#fff", border: colors.primary },
    secondary: { bg: colors.card, fg: colors.text, border: colors.border },
    danger: { bg: colors.card, fg: colors.danger, border: colors.dangerSoft },
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
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.button,
                { backgroundColor: v.bg, borderColor: v.border },
                (pressed || disabled) && styles.dim,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={v.fg} />
            ) : (
                <View style={styles.row}>
                    {icon ? (
                        <Ionicons name={icon} size={18} color={v.fg} />
                    ) : null}
                    <Text style={[styles.buttonText, { color: v.fg }]}>
                        {label}
                    </Text>
                </View>
            )}
        </Pressable>
    );
}

export function Chip({
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
    return (
        <Pressable
            onPress={onPress}
            style={[styles.chip, selected && styles.chipOn]}
        >
            {icon ? (
                <Ionicons
                    name={icon}
                    size={14}
                    color={selected ? colors.primary : colors.muted}
                />
            ) : null}
            <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {label}
            </Text>
        </Pressable>
    );
}

export function ChipRow({ children }: { children: ReactNode }) {
    return <View style={styles.chipRow}>{children}</View>;
}

export function Badge({
    label,
    tone = "neutral",
}: {
    label: string;
    tone?: Tone;
}) {
    const t = tones[tone];
    return (
        <View style={[styles.badge, { backgroundColor: t.bg }]}>
            <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
        </View>
    );
}

export function Banner({
    text,
    tone = "danger",
}: {
    text: string | null;
    tone?: Tone;
}) {
    if (!text) return null;
    const t = tones[tone];
    return (
        <View style={[styles.banner, { backgroundColor: t.bg }]}>
            <Text style={{ color: t.fg }}>{text}</Text>
        </View>
    );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                placeholderTextColor={colors.muted}
                style={styles.input}
                {...props}
            />
        </View>
    );
}

export function SectionTitle({ children }: { children: ReactNode }) {
    return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
    return <Text style={styles.muted}>{children}</Text>;
}

export function SeatsBar({
    taken,
    capacity,
}: {
    taken: number;
    capacity: number;
}) {
    const pct = Math.min(100, Math.round((taken / capacity) * 100));
    return (
        <View style={styles.barTrack}>
            <View
                style={[
                    styles.barFill,
                    {
                        width: `${pct}%`,
                        backgroundColor:
                            taken >= capacity ? colors.warning : colors.success,
                    },
                ]}
            />
        </View>
    );
}

export function EmptyState({
    icon,
    title,
    body,
}: {
    icon: IconName;
    title: string;
    body: string;
}) {
    return (
        <View style={styles.empty}>
            <Ionicons name={icon} size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>{title}</Text>
            <Text style={[styles.muted, styles.center]}>{body}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    screenContent: { padding: 16, gap: 12, paddingBottom: 40 },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: 14,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    pressed: { opacity: 0.85 },
    button: {
        borderRadius: radius.md,
        paddingVertical: 13,
        alignItems: "center",
        borderWidth: 1,
    },
    dim: { opacity: 0.5 },
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    buttonText: { fontWeight: "600", fontSize: 15 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },
    chipOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    chipText: { color: colors.text, fontSize: 13 },
    chipTextOn: { color: colors.primary, fontWeight: "600" },
    badge: {
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    badgeText: { fontSize: 12, fontWeight: "600" },
    banner: { padding: 12, borderRadius: radius.md },
    field: { gap: 6 },
    label: { fontSize: 13, color: colors.muted, fontWeight: "500" },
    input: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 15,
        color: colors.text,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.muted,
        marginTop: 8,
    },
    muted: { color: colors.muted, fontSize: 13 },
    center: { textAlign: "center" },
    barTrack: {
        height: 8,
        borderRadius: 999,
        backgroundColor: "#EFEDE8",
        overflow: "hidden",
    },
    barFill: { height: 8, borderRadius: 999 },
    empty: {
        alignItems: "center",
        gap: 8,
        paddingVertical: 40,
        paddingHorizontal: 24,
    },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
});
