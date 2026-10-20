const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "7:00 PM" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "Tonight", "Tomorrow", or "Thursday, Oct 22" */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / DAY_MS);
  if (diff === 0) return d.getHours() >= 17 ? "Tonight" : "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/** "Thursday, Oct 22 at 7:00 PM" */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return `${day} at ${formatTime(iso)}`;
}

/** Parts for a calendar-style date tile. */
export function dateTile(iso: string): { month: string; day: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }),
    day: String(d.getDate()),
  };
}

export function seatsSummary(e: { seats_left: number; capacity: number }): string {
  if (e.seats_left <= 0) return "Full, waitlist open";
  if (e.seats_left === 1) return "1 seat left";
  return `${e.seats_left} seats left`;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

/** Group items by calendar day, keeping their order. */
export function groupByDay<T extends { starts_at: string }>(items: T[]): { label: string; items: T[] }[] {
  const groups: { key: number; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = startOfDay(new Date(item.starts_at));
    const last = groups.at(-1);
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.starts_at), items: [item] });
  }
  return groups.map(({ label, items: list }) => ({ label, items: list }));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
