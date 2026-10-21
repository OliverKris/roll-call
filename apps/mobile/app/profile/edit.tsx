import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { getMyProfile, setMyGames, updateMyProfile, type Profile } from "../../src/api";
import { useApiErrorHandler, useAuth } from "../../src/auth";
import { useGames } from "../../src/games";
import { Button, Card, Chip, ChipWrap, Field, Meta, Notice, Screen, Section, SectionLabel } from "../../src/ui";

const sameIds = (a: number[], b: number[]) =>
  [...a].sort((x, y) => x - y).join(",") === [...b].sort((x, y) => x - y).join(",");

export default function EditProfile() {
  const router = useRouter();
  const { token } = useAuth();
  const handleError = useApiErrorHandler();
  const { games } = useGames();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [owned, setOwned] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fill = useCallback((p: Profile) => {
    setProfile(p);
    setName(p.display_name);
    setArea(p.home_area ?? "");
    setBio(p.bio ?? "");
    setOwned(p.game_ids);
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    getMyProfile(token)
      .then((p) => {
        if (alive) fill(p);
      })
      .catch((e) => {
        if (alive) setError(handleError(e));
      });
    return () => {
      alive = false;
    };
  }, [token, fill, handleError]);

  if (!token) return <Redirect href="/login" />;

  const detailsChanged =
    !!profile &&
    (name.trim() !== profile.display_name ||
      (area.trim() || null) !== profile.home_area ||
      (bio.trim() || null) !== profile.bio);
  const gamesChanged = !!profile && !sameIds(owned, profile.game_ids);

  const toggle = (id: number) =>
    setOwned((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const save = async () => {
    if (!name.trim()) {
      setError("Add a display name so other players know who you are.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (detailsChanged) {
        await updateMyProfile(token, {
          display_name: name.trim(),
          home_area: area.trim() || null,
          bio: bio.trim() || null,
        });
      }
      if (gamesChanged) await setMyGames(token, owned);
      router.back();
    } catch (e) {
      setError(handleError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label="Save changes"
          onPress={save}
          loading={busy}
          disabled={!detailsChanged && !gamesChanged}
        />
      }
    >
      <Notice text={error} />

      <Section>
        <SectionLabel label="About you" />
        <Card padded>
          <Field label="Display name" value={name} onChangeText={setName} maxLength={80} />
          <Field label="Neighborhood" value={area} onChangeText={setArea} placeholder="Park Slope" maxLength={120} />
          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="What do you like to play?"
            multiline
            maxLength={500}
            hint={`${bio.length} of 500 characters`}
          />
        </Card>
      </Section>

      <Section>
        <SectionLabel label="Games I own" />
        <Card padded>
          <Meta>Hosts can see which games you could bring.</Meta>
          <ChipWrap>
            {games.map((g) => (
              <Chip
                key={g.id}
                label={g.name}
                icon={owned.includes(g.id) ? "checkmark" : undefined}
                selected={owned.includes(g.id)}
                onPress={() => toggle(g.id)}
              />
            ))}
          </ChipWrap>
        </Card>
      </Section>
    </Screen>
  );
}
