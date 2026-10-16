import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import {
    ApiError,
    describeError,
    getMyProfile,
    listGames,
    login,
    onRequest,
    setMyGames,
    type Game,
    type LogEntry,
    type Profile,
} from "./src/api";
import { API_URL, KEYCLOAK_URL } from "./src/config";

export default function App() {
    const [username, setUsername] = useState("alice");
    const [password, setPassword] = useState("alice");
    const [token, setToken] = useState<string | null>(null);
    const [games, setGames] = useState<Game[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);
    const [log, setLog] = useState<LogEntry[]>([]);

    useEffect(() => {
        onRequest((entry) => setLog((prev) => [entry, ...prev].slice(0, 20)));
    }, []);

    async function run(label: string, fn: () => Promise<void>) {
        setBusy(true);
        setStatus(`${label}…`);
        try {
            await fn();
            setStatus(`✓ ${label}`);
        } catch (e) {
            setStatus(`✗ ${label}: ${describeError(e)}`);
        } finally {
            setBusy(false);
        }
    }

    const loadGames = () =>
        run("Load games (public)", async () => {
            setGames(await listGames());
        });

    const expectStatus = (
        label: string,
        code: number,
        fn: () => Promise<unknown>,
    ) =>
        run(label, async () => {
            try {
                await fn();
            } catch (e) {
                if (e instanceof ApiError && e.status === code) return;
                throw e;
            }
            throw new Error(`Expected ${code}, but the request succeeded`);
        });

    const doLogin = () =>
        run("Log in and load profile", async () => {
            const t = await login(username, password);
            setToken(t);
            const p = await getMyProfile(t);
            setProfile(p);
            setSelected(new Set(p.game_ids));
            if (games.length === 0) setGames(await listGames());
        });

    const saveGames = () =>
        run("Save my games", async () => {
            if (!token) throw new Error("Log in first");
            const p = await setMyGames(token, [...selected]);
            setProfile(p);
            setSelected(new Set(p.game_ids));
        });

    const logout = () => {
        setToken(null);
        setProfile(null);
        setSelected(new Set());
        setStatus("Logged out");
    };

    const toggle = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
        >
            <StatusBar style="auto" />
            <Text style={styles.title}>Roll Call: gateway test</Text>
            <Text style={styles.muted}>API: {API_URL}</Text>
            <Text style={styles.muted}>Auth: {KEYCLOAK_URL}</Text>

            {status ? <Text style={styles.status}>{status}</Text> : null}

            <Section title="1. Public endpoint">
                <Button
                    label="Load games"
                    onPress={loadGames}
                    disabled={busy}
                />
                <Button
                    label="Profile without token (expect 401)"
                    onPress={() =>
                        expectStatus(
                            "Gateway blocks anonymous request",
                            401,
                            () => getMyProfile(),
                        )
                    }
                    disabled={busy}
                />
            </Section>

            <Section title="2. Log in through Keycloak">
                {token ? (
                    <>
                        <Text>
                            Signed in as {profile?.display_name ?? username}
                        </Text>
                        <Text style={styles.muted}>
                            user_id: {profile?.user_id}
                        </Text>
                        <Button
                            label="Log out"
                            onPress={logout}
                            disabled={busy}
                        />
                    </>
                ) : (
                    <>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            placeholder="username"
                        />
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholder="password"
                        />
                        <Button
                            label="Log in"
                            onPress={doLogin}
                            disabled={busy}
                        />
                    </>
                )}
            </Section>

            <Section title="3. Games I own (tap to toggle)">
                {games.length === 0 ? (
                    <Text style={styles.muted}>Load games first.</Text>
                ) : null}
                {games.map((g) => {
                    const on = selected.has(g.id);
                    return (
                        <Pressable
                            key={g.id}
                            onPress={() => toggle(g.id)}
                            style={[styles.game, on && styles.gameOn]}
                        >
                            <Text style={on ? styles.gameTextOn : undefined}>
                                {on ? "● " : "○ "}
                                {g.name}
                            </Text>
                            <Text style={styles.muted}>
                                {g.min_players}–{g.max_players} players ·{" "}
                                {g.play_time_minutes} min
                            </Text>
                        </Pressable>
                    );
                })}
                <Button
                    label="Save my games"
                    onPress={saveGames}
                    disabled={busy || !token}
                />
                <Button
                    label="Save unknown game (expect 422)"
                    onPress={() =>
                        expectStatus("Profile rejects unknown game", 422, () =>
                            setMyGames(token ?? "", [999]),
                        )
                    }
                    disabled={busy || !token}
                />
            </Section>

            <Section title="Request log">
                {log.length === 0 ? (
                    <Text style={styles.muted}>No requests yet.</Text>
                ) : null}
                {log.map((e, i) => (
                    <Text key={i} style={styles.logLine}>
                        {e.method} {e.url.replace(/^https?:\/\/[^/]+/, "")} →{" "}
                        {e.status} ({e.ms} ms)
                    </Text>
                ))}
            </Section>
        </ScrollView>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

function Button({
    label,
    onPress,
    disabled,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.button,
                (pressed || disabled) && styles.buttonDim,
            ]}
        >
            <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#f6f5f2" },
    content: { padding: 16, paddingTop: 64, gap: 12 },
    title: { fontSize: 22, fontWeight: "600" },
    muted: { color: "#6b6b6b", fontSize: 12 },
    status: {
        padding: 10,
        backgroundColor: "#fff",
        borderRadius: 8,
        fontSize: 13,
    },
    section: { backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 8 },
    sectionTitle: { fontWeight: "600", marginBottom: 4 },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 10,
    },
    button: {
        backgroundColor: "#2f5bd3",
        borderRadius: 8,
        padding: 12,
        alignItems: "center",
    },
    buttonDim: { opacity: 0.5 },
    buttonText: { color: "#fff", fontWeight: "600" },
    game: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
    gameOn: { borderColor: "#2f5bd3", backgroundColor: "#eef2fc" },
    gameTextOn: { fontWeight: "600" },
    logLine: { fontFamily: "Courier", fontSize: 11 },
});
