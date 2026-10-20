import { Ionicons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getEvent,
  getMyRsvp,
  getProfile,
  joinEvent,
  leaveEvent,
  type EventSummary,
  type Rsvp,
} from "../../src/api";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import { formatWhen, seatsSummary } from "../../src/format";
import { useGames } from "../../src/games";
import { SeatTokens } from "../../src/SeatTokens";
import { colors, space, type } from "../../src/theme";
import {
  Avatar,
  Body,
  Button,
  Caption,
  Group,
  Divider,
  Notice,
  Screen,
  Section,
  Tag,
  type IconName,
} from "../../src/ui";

function openInMaps(e: EventSummary) {
  const label = encodeURIComponent(e.location_name);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?ll=${e.latitude},${e.longitude}&q=${label}`
      : `geo:${e.latitude},${e.longitude}?q=${e.latitude},${e.longitude}(${label})`;
  void Linking.openURL(url);
}

function InfoRow({
  icon,
  primary,
  secondary,
  onPress,
}: {
  icon: IconName;
  primary: string;
  secondary?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Ionicons name={icon} size={20} color={colors.ink} style={styles.infoIcon} />
      <View style={styles.flex}>
        <Text style={styles.infoPrimary}>{primary}</Text>
        {secondary ? <Text style={styles.infoSecondary}>{secondary}</Text> : null}
      </View>
      {onPress ? <Ionicons name="open-outline" size={18} color={colors.faint} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.infoRow}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);
  const { token, userId } = useAuth();
  const handleError = useApiErrorHandler();
  const { byId } = useGames();

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [hostName, setHostName] = useState<string | null>(null);
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [loading, setLoading] = useState(true);
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
      // The host's name is a nice-to-have; the screen still works without it
      getProfile(token, e.host_user_id)
        .then((p) => setHostName(p.display_name))
        .catch(() => setHostName(null));
    } catch (e) {
      setError(handleError(e));
    } finally {
      setLoading(false);
    }
  }, [eventId, token, handleError]);

  // Reload whenever this screen comes into view, e.g. after switching users
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
      return wasWaiting ? "You left the waitlist." : "You gave up your seat.";
    });

  const game = event ? byId.get(event.game_id) : undefined;
  const isHost = !!event && event.host_user_id === userId;
  const full = !!event && event.seats_left <= 0;

  let footer = null;
  if (event) {
    if (isHost) {
      footer = <Caption>{"You're hosting this game night."}</Caption>;
    } else if (rsvp?.status === "going") {
      footer = <Button label="Give up my seat" variant="destructive" onPress={leave} loading={busy} />;
    } else if (rsvp?.status === "waitlisted") {
      footer = <Button label="Leave waitlist" variant="destructive" onPress={leave} loading={busy} />;
    } else {
      footer = (
        <Button
          label={full ? "Join the waitlist" : "Take a seat"}
          onPress={join}
          loading={busy}
        />
      );
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={load} footer={footer}>
      <Notice text={error} />
      <Notice text={notice} tone="positive" />

      {event ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.game}>{game?.name ?? "Board game"}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {event.title}
            </Text>
            {game ? (
              <Caption>
                {game.min_players}–{game.max_players} players, about {game.play_time_minutes} minutes
              </Caption>
            ) : null}
            {rsvp && !isHost ? (
              <Tag
                label={rsvp.status === "going" ? "You're going" : "You're on the waitlist"}
                tone={rsvp.status === "going" ? "positive" : "waiting"}
              />
            ) : null}
          </View>

          <Group>
            <InfoRow icon="calendar-outline" primary={formatWhen(event.starts_at)} />
            <Divider inset={space.lg + 20 + space.md} />
            <InfoRow
              icon="location-outline"
              primary={event.location_name}
              secondary="Open in Maps"
              onPress={() => openInMaps(event)}
            />
          </Group>

          <Section title="The table">
            <SeatTokens taken={event.seats_taken} capacity={event.capacity} size="lg" />
            <Text style={[styles.seatsText, full && styles.seatsFull]}>
              {full
                ? `All ${event.capacity} seats are taken. New players join the waitlist.`
                : `${event.seats_taken} of ${event.capacity} seats taken, ${seatsSummary(event).toLowerCase()}.`}
            </Text>
          </Section>

          <Section title="Host">
            <View style={styles.host}>
              <Avatar name={hostName ?? "?"} id={event.host_user_id} size={44} />
              <Body>{isHost ? "You" : (hostName ?? "Game night host")}</Body>
            </View>
          </Section>

          {event.description ? (
            <Section title="Details">
              <Body>{event.description}</Body>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: space.sm, paddingTop: space.sm },
  game: { ...type.secondary, fontWeight: "600", color: colors.slate },
  title: { ...type.display, color: colors.ink },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  infoIcon: { width: 20 },
  infoPrimary: { ...type.body, color: colors.ink },
  infoSecondary: { ...type.caption, color: colors.slate },
  pressed: { backgroundColor: colors.paper },
  seatsText: { ...type.secondary, color: colors.slate },
  seatsFull: { color: colors.waiting },
  host: { flexDirection: "row", alignItems: "center", gap: space.md },
});
