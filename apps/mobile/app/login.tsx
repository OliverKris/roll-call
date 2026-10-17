import { Redirect } from "expo-router";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { describeError } from "../src/api";
import { useAuth } from "../src/auth";
import { Banner, Button, Chip, ChipRow, Field, Muted } from "../src/components";
import { colors } from "../src/theme";
import { Ionicons } from "@expo/vector-icons";

const TEST_ACCOUNTS = ["alice", "bob", "carol"];

export default function Login() {
    const { token, ready, signIn } = useAuth();
    const [username, setUsername] = useState("alice");
    const [password, setPassword] = useState("alice");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (ready && token) return <Redirect href="/" />;

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            await signIn(username.trim(), password);
        } catch (e) {
            setError(describeError(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.wrap}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.hero}>
                    <View style={styles.logoTile}>
                        <Ionicons name="dice" size={44} color="#FFFFFF" />
                    </View>
                    <Text style={styles.title}>Roll Call</Text>
                    <Muted>Find people near you who want to play.</Muted>
                </View>

                <Banner text={error} />

                <Field
                    label="Username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <Field
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
                <Button label="Sign in" onPress={submit} loading={busy} />

                <View style={styles.test}>
                    <Muted>Test accounts</Muted>
                    <ChipRow>
                        {TEST_ACCOUNTS.map((u) => (
                            <Chip
                                key={u}
                                label={u}
                                selected={username === u}
                                onPress={() => {
                                    setUsername(u);
                                    setPassword(u);
                                }}
                            />
                        ))}
                    </ChipRow>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    wrap: { flex: 1, padding: 24, gap: 14, justifyContent: "center" },
    hero: { alignItems: "center", gap: 6, marginBottom: 16 },
    logoTile: {
        width: 84,
        height: 84,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
        shadowColor: colors.primary,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    title: { fontSize: 30, fontWeight: "700", color: colors.text },
    test: { gap: 8, marginTop: 16 },
});
