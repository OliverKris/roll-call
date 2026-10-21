import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { createEvent } from "../../src/api";
import { AREAS, type Area } from "../../src/areas";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import { useGames } from "../../src/games";
import { currentArea } from "../../src/location";
import { TableView } from "../../src/SeatTokens";
import { space } from "../../src/theme";
import {
  Button,
  Card,
  Chip,
  ChipScroller,
  ChipWrap,
  Field,
  Meta,
  Notice,
  Screen,
  ScreenTitle,
  Section,
  SectionLabel,
  Stepper,
} from "../../src/ui";

const HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

function dayOptions() {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    const label = i === 0 ? "Tomorrow" : `${weekday} ${d.getDate()}`;
    return { offset: i + 1, label };
  });
}

function hourLabel(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

/** Host answers: what's the table? A game, a time, a place, and how many seats. */
export default function Host() {
  const router = useRouter();
  const { token, username } = useAuth();
  const handleError = useApiErrorHandler();
  const { games, byId } = useGames();
  const days = useMemo(() => dayOptions(), []);

  const [gameId, setGameId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dayOffset, setDayOffset] = useState(1);
  const [hour, setHour] = useState(19);
  const [placeName, setPlaceName] = useState("");
  const [area, setArea] = useState<Area>(AREAS[0]);
  const [capacity, setCapacity] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const game = gameId === null ? undefined : byId.get(gameId);
  const missing = [!gameId && "a game", !title.trim() && "a title", !placeName.trim() && "a place"].filter(
    Boolean,
  ) as string[];

  const pickMyLocation = async () => {
    const result = await currentArea();
    if ("error" in result) setError(result.error);
    else setArea(result.area);
  };

  const pickGame = (id: number, name: string) => {
    // Suggest a title from the game until the host types their own
    if (!title.trim() || games.some((g) => `${g.name} night` === title)) setTitle(`${name} night`);
    setGameId(id);
    // Start the table at the game's best size, within what the stepper allows
    const g = byId.get(id);
    if (g) setCapacity(Math.min(20, Math.max(2, g.max_players)));
  };

  const submit = async () => {
    if (!token) return;
    if (missing.length > 0) {
      setError(`Add ${missing.join(", ")} before posting.`);
      return;
    }
    const starts = new Date();
    starts.setDate(starts.getDate() + dayOffset);
    starts.setHours(hour, 0, 0, 0);

    setBusy(true);
    setError(null);
    try {
      const created = await createEvent(token, {
        title: title.trim(),
        description: description.trim() || undefined,
        game_id: gameId!,
        starts_at: starts.toISOString(),
        location_name: placeName.trim(),
        latitude: area.lat,
        longitude: area.lng,
        capacity,
      });
      setTitle("");
      setDescription("");
      setPlaceName("");
      setGameId(null);
      router.push(`/events/${created.id}`);
    } catch (e) {
      setError(handleError(e));
    } finally {
      setBusy(false);
    }
  };

  const dayLabel = days.find((d) => d.offset === dayOffset)?.label ?? "";
  const summary =
    missing.length > 0
      ? `Still needs ${missing.join(", ")}.`
      : `${game?.name} · ${dayLabel}, ${hourLabel(hour)} · ${capacity} seats`;

  const outsideRange = game && (capacity < game.min_players || capacity > game.max_players);

  return (
    <Screen
      topInset
      footer={
        <>
          <Meta>{summary}</Meta>
          <Button label="Post game night" onPress={submit} loading={busy} disabled={missing.length > 0} />
        </>
      }
    >
      <ScreenTitle title="Host a game night" subtitle="Players nearby see it on Discover and can take a seat." />

      <Notice text={error} />

      <Section>
        <SectionLabel label="Game" />
        <Card padded>
          <ChipWrap>
            {games.map((g) => (
              <Chip key={g.id} label={g.name} selected={gameId === g.id} onPress={() => pickGame(g.id, g.name)} />
            ))}
          </ChipWrap>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Catan night" maxLength={120} />
          <Field
            label="Details (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Snacks provided, beginners welcome"
            multiline
            maxLength={2000}
          />
        </Card>
      </Section>

      <Section>
        <SectionLabel label="When" />
        <Card padded>
          <ChipScroller>
            {days.map((d) => (
              <Chip
                key={d.offset}
                label={d.label}
                selected={dayOffset === d.offset}
                onPress={() => setDayOffset(d.offset)}
              />
            ))}
          </ChipScroller>
          <ChipScroller>
            {HOURS.map((h) => (
              <Chip key={h} label={hourLabel(h)} selected={hour === h} onPress={() => setHour(h)} />
            ))}
          </ChipScroller>
        </Card>
      </Section>

      <Section>
        <SectionLabel label="Where" />
        <Card padded>
          <Field
            label="Place"
            value={placeName}
            onChangeText={setPlaceName}
            placeholder="Brooklyn Board Game Cafe"
            maxLength={200}
          />
          <Meta>Area. Nearby players search by area.</Meta>
          <ChipScroller>
            <Chip label="Near me" icon="navigate-outline" selected={area.label === "Near me"} onPress={pickMyLocation} />
            {AREAS.map((a) => (
              <Chip key={a.label} label={a.label} selected={area.label === a.label} onPress={() => setArea(a)} />
            ))}
          </ChipScroller>
        </Card>
      </Section>

      <Section>
        <SectionLabel label="Seats" />
        <Card padded>
          <View style={styles.seatsHead}>
            <Stepper value={capacity} min={2} max={20} onChange={setCapacity} />
            <Meta>Including yours</Meta>
          </View>
          <TableView taken={1} capacity={capacity} centre={game?.name} hostName={username} />
          <Meta>
            {outsideRange
              ? `${game.name} is made for ${game.min_players}–${game.max_players} players.`
              : "Once every seat is taken, new players join a waitlist and move up in order."}
          </Meta>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seatsHead: { flexDirection: "row", alignItems: "center", gap: space.lg },
});
