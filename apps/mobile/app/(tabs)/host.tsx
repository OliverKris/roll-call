import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { createEvent } from "../../src/api";
import { AREAS, type Area } from "../../src/areas";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import { useGames } from "../../src/games";
import { currentArea } from "../../src/location";
import { SeatTokens } from "../../src/SeatTokens";
import { space } from "../../src/theme";
import {
  Button,
  Caption,
  Field,
  LargeTitle,
  Notice,
  Pill,
  PillScroller,
  PillWrap,
  Screen,
  Section,
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

export default function Host() {
  const router = useRouter();
  const { token } = useAuth();
  const handleError = useApiErrorHandler();
  const { games } = useGames();
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

  const missing = [
    !gameId && "a game",
    !title.trim() && "a title",
    !placeName.trim() && "a place",
  ].filter(Boolean) as string[];

  const pickMyLocation = async () => {
    const result = await currentArea();
    if ("error" in result) setError(result.error);
    else setArea(result.area);
  };

  const pickGame = (id: number, name: string) => {
    // Suggest a title from the game until the host types their own
    if (!title.trim() || games.some((g) => `${g.name} night` === title)) setTitle(`${name} night`);
    setGameId(id);
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

  return (
    <Screen
      topInset
      footer={<Button label="Post game night" onPress={submit} loading={busy} />}
    >
      <LargeTitle title="Host a game night" subtitle="Pick a game, a time, and a table. Players nearby can join." />

      <Notice text={error} />

      <Section title="Game">
        <PillWrap>
          {games.map((g) => (
            <Pill
              key={g.id}
              label={g.name}
              selected={gameId === g.id}
              onPress={() => pickGame(g.id, g.name)}
            />
          ))}
        </PillWrap>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Catan night" maxLength={120} />
        <Field
          label="Details (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Snacks provided, beginners welcome"
          multiline
          maxLength={2000}
        />
      </Section>

      <Section title="When">
        <PillScroller>
          {days.map((d) => (
            <Pill
              key={d.offset}
              label={d.label}
              selected={dayOffset === d.offset}
              onPress={() => setDayOffset(d.offset)}
            />
          ))}
        </PillScroller>
        <PillScroller>
          {HOURS.map((h) => (
            <Pill key={h} label={hourLabel(h)} selected={hour === h} onPress={() => setHour(h)} />
          ))}
        </PillScroller>
      </Section>

      <Section title="Where">
        <Field
          label="Place"
          value={placeName}
          onChangeText={setPlaceName}
          placeholder="Brooklyn Board Game Cafe"
          maxLength={200}
        />
        <Caption>Which area is it in? Nearby players search by area.</Caption>
        <PillScroller>
          <Pill label="Near me" icon="navigate" selected={area.label === "Near me"} onPress={pickMyLocation} />
          {AREAS.map((a) => (
            <Pill key={a.label} label={a.label} selected={area.label === a.label} onPress={() => setArea(a)} />
          ))}
        </PillScroller>
      </Section>

      <Section title="Seats">
        <View style={styles.seats}>
          <Stepper value={capacity} min={2} max={20} onChange={setCapacity} />
          <SeatTokens taken={1} capacity={capacity} size="lg" />
        </View>
        <Caption>Includes your seat. Once the table is full, new players join a waitlist.</Caption>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seats: { gap: space.lg },
});
