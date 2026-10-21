import { Redirect } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, describeError } from "../src/api";
import { useAuth } from "../src/auth";
import { TableView } from "../src/SeatTokens";
import { colors, space, type } from "../src/theme";
import { Button, Field, Notice, PasswordField, Wordmark, type TextInputHandle } from "../src/ui";

function loginError(e: unknown): string {
  // Keycloak answers a wrong username or password with 400 or 401
  if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
    return "That username and password don't match. Check them and try again.";
  }
  return describeError(e);
}

export default function Login() {
  const { token, ready, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputHandle>(null);

  if (ready && token) return <Redirect href="/" />;

  const canSubmit = username.trim().length > 0 && password.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
    } catch (e) {
      setError(loginError(e));
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
        <View style={styles.brand}>
          <Wordmark size={40} />
          <Text style={styles.tagline}>{"Find a seat at a board-game night near you, or host your own."}</Text>
          <View style={styles.table}>
            <TableView taken={5} capacity={6} />
          </View>
        </View>

        <View style={styles.form}>
          <Notice text={error} />
          <Field
            label="Username or email"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <PasswordField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Button label="Sign in" onPress={submit} loading={busy} disabled={!canSubmit} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  wrap: { flex: 1, paddingHorizontal: space.xl, justifyContent: "center", gap: 40 },
  brand: { gap: space.md },
  tagline: { ...type.body, color: colors.muted },
  table: { marginTop: space.lg },
  form: { gap: space.lg },
});
