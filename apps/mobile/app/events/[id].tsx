import { Ionicons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getEvent,
  getMyProfile,
  getMyRsvp,
  getProfile,
  joinEvent,
  leaveEvent,
  type EventSummary,
  type Rsvp,
} from "../../src/api";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import { formatTime, shortDate, startsIn } from "../../src/format";
import { useGames } from "../../src/games";
import { TableView } from "../../src/SeatTokens";
import { colors, space, type } from "../../src/theme";
import {
  Avatar,
  Bar,
  BlockError,
  Body,
  Button,
  Card,
  Meta,
  Notice,
  Pill,
  rowPressedStyle,
  Rule,
  Screen,
  Section,
  SectionLabel,
} from "../../src/ui";

function openInMaps(e: EventSummary) {
  const label = encodeURIComponent(e.location_name);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?ll=${e.latitude},${e.longitude}&q=${label}`
      : `geo:${e.latitude},${e.longitude}?q=${e.latitude},${e.longitude}(${label})`;
  void Linking.openURL(url);
}

/** One cell of the divided strip: a small label over a value. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** The detail answers: can I get a seat at this table, and what am I signing up for? */
export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);
  const { token, userId } = useAuth();
  const handleError = useApiErrorHandler();
  const { byId } = useGames();

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [hostName, setHostName] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [e, r] = await Promise.all([getEvent(eventId), getMyRsvp(token, eventId)]);
      setEvent(e);
      setRsvp(r);
      setError(null);
      setNow(Date.now());
      // Names are nice-to-have; the screen works without them
      getProfile(token, e.host_user_id)
        .then((p) => setHostName(p.display_name))
        .catch(() => setHostName(null));
      getMyProfile(token)
        .then((p) => setMyName(p.display_name))
        .catch(() => setMyName(null));
    } catch (e) {
      setError(handleError(e));
    } finally {
      setLoading(false);
    }
  }, [eventId, token, handleError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!token) return <Redirect href="/login" />;

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      await load();
    } catch (e) {
      setError(handleError(e));
    } finally {
      setBusy(false);
    }
  };

  const join = () =>
    act(async () => {
      const r = await joinEvent(token, eventId);
      return r.status === "going"
        ? "You're in. Your seat is saved."
        : "The table is full, so you're on the waitlist. If a seat opens, it's yours.";
    });

  const leave = () =>
    act(async () => {
      const wasWaiting = rsvp?.status === "waitlisted";
      await leaveEvent(token, eventId);
      return wasWaiting ? "You left the waitlist." : "You gave up your seat. The next player on the waitlist gets it.";
    });

  const game = event ? byId.get(event.game_id) : undefined;
  const isHost = !!event && event.host_user_id === userId;
  const going = rsvp?.status === "going" && !isHost;
  const waiting = rsvp?.status === "waitlisted";
  const full = !!event && event.seats_left <= 0;

  let footer = null;
  if (event) {
    if (isHost) footer = <Meta>{"You're hosting. Players who join show up in your inbox."}</Meta>;
    else if (going) footer = <Button label="Give up my seat" variant="destructive" onPress={leave} loading={busy} />;
    else if (waiting) footer = <Button label="Leave the waitlist" variant="destructive" onPress={leave} loading={busy} />;
    else footer = <Button label={full ? "Join the waitlist" : "Take a seat"} onPress={join} loading={busy} />;
  }

  let tableNote = "";
  if (event) {
    if (isHost) tableNote = full ? "Your table is full. New players join the waitlist." : "You're in seat 1.";
    else if (going) tableNote = "You have a seat.";
    else if (waiting) tableNote = "You're on the waitlist. If a seat opens, it's yours.";
    else if (full) tableNote = "Every seat is taken. Join the waitlist and you move up as seats open.";
  }

  const status = isHost
    ? { label: "Hosting", tone: "neutral" as const }
    : going
      ? { label: "Going", tone: "positive" as const }
      : waiting
        ? { label: "Waitlist", tone: "waiting" as const }
        : null;

  return (
    <Screen refreshing={loading && !!event} onRefresh={load} footer={footer}>
      <Notice text={notice} tone="positive" />

      {error && !event ? (
        <Card>
          <BlockError text={`Couldn't load this game night. ${error}`} onRetry={load} />
        </Card>
      ) : null}
      {error && event ? <Notice text={error} /> : null}

      {!event && !error ? (
        <View style={styles.head}>
          <Bar width={90} height={13} />
          <Bar width="80%" height={28} />
          <Bar width="60%" height={15} />
        </View>
      ) : null}

      {event ? (
        <>
          <View style={styles.head}>
            <Text style={styles.game}>{game?.name ?? "Board game"}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {event.title}
            </Text>
            <Text style={styles.when}>
              {shortDate(event.starts_at)} · {formatTime(event.starts_at)}
            </Text>
            {status ? <Pill label={status.label} tone={status.tone} /> : null}
          </View>

          <Card padded>
            <View style={styles.seatFigure}>
              <Text style={[styles.figure, full && styles.figureFull]}>{full ? "Full" : event.seats_left}</Text>
              <Text style={styles.figureUnit}>
                {full
                  ? `all ${event.capacity} seats taken`
                  : `of ${event.capacity} seats open`}
              </Text>
            </View>
            <TableView
              taken={event.seats_taken}
              capacity={event.capacity}
              centre={game?.name}
              hostName={isHost ? (myName ?? hostName) : hostName}
              myName={going ? myName : null}
            />
            {tableNote ? <Meta>{tableNote}</Meta> : null}
          </Card>

          <Card>
            <View style={styles.facts}>
              <Fact label="Starts" value={now === null ? "—" : startsIn(event.starts_at, now)} />
              <View style={styles.factRule} />
              <Fact label="Players" value={game ? `${game.min_players}–${game.max_players}` : "—"} />
              <View style={styles.factRule} />
              <Fact label="Plays in" value={game ? `${game.play_time_minutes} min` : "—"} />
            </View>
          </Card>

          <Card>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${event.location_name}. Open in Maps`}
              onPress={() => openInMaps(event)}
              style={({ pressed }) => [styles.row, pressed && rowPressedStyle]}
            >
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{event.location_name}</Text>
                <Meta>Open in Maps</Meta>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.faint} />
            </Pressable>
            <Rule inset={space.lg} />
            <View style={styles.row}>
              <Avatar name={(isHost ? myName : hostName) ?? "?"} size={36} />
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{isHost ? "You" : (hostName ?? "Host")}</Text>
                <Meta>Host</Meta>
              </View>
            </View>
          </Card>

          {event.description ? (
            <Section>
              <SectionLabel label="From the host" />
              <Card padded>
                <Body>{event.description}</Body>
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: 6, paddingTop: space.xs },
  game: { ...type.label, color: colors.muted, fontWeight: "500" },
  title: { ...type.title, color: colors.text },
  when: { ...type.body, ...type.tabular, color: colors.text },
  seatFigure: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginBottom: space.xs },
  figure: { ...type.figure, color: colors.seat },
  figureFull: { color: colors.text },
  figureUnit: { ...type.body, color: colors.muted },
  facts: { flexDirection: "row", paddingVertical: space.md },
  fact: { flex: 1, paddingHorizontal: space.lg, gap: 2 },
  factRule: { width: 1, backgroundColor: colors.rule },
  factLabel: { ...type.label, color: colors.muted },
  factValue: { ...type.heading, ...type.tabular, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 64 },
  rowTitle: { ...type.body, fontWeight: "500", color: colors.text },
});
