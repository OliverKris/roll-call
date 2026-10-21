const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "7:00 PM" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "Today", "Tomorrow", or "Thursday, Oct 22" */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / DAY_MS);
  if (diff === 0) return "Today";
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

/** "2 open", "1 open", or "Full" */
export function seatsOpen(e: { seats_left: number }): string {
  return e.seats_left <= 0 ? "Full" : `${e.seats_left} open`;
}

/** "2 open seats", "1 open seat", or "No open seats" */
export function openSeatsPhrase(n: number): string {
  if (n <= 0) return "No open seats";
  return n === 1 ? "1 open seat" : `${n} open seats`;
}

/** "850 m" or "1.2 km" */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** "Thu, Oct 22" */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** "in 45 min", "in 3 h", "in 2 days", or "started" */
export function startsIn(iso: string, now: number): string {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins <= 0) return "started";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

/** "now", "12 min", "3 h", "2 d" */
export function timeAgo(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
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

export function isSameDay(iso: string, now: number): boolean {
  return startOfDay(new Date(iso)) === startOfDay(new Date(now));
}
