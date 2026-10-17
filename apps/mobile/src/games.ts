// src/games.ts
import { useEffect, useMemo, useState } from "react";

import { listGames, type Game } from "./api";

let cache: Promise<Game[]> | null = null;

/** Fetch the catalog once per app session and share it between screens. */
export function loadGames(): Promise<Game[]> {
    if (!cache) {
        cache = listGames().catch((e) => {
            cache = null;
            throw e;
        });
    }
    return cache;
}

export function useGames() {
    const [games, setGames] = useState<Game[]>([]);

    useEffect(() => {
        let alive = true;
        loadGames()
            .then((g) => alive && setGames(g))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
    return { games, byId };
}
