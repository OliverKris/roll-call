// src/format.ts
export function formatWhen(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function seatsLabel(e: {
    seats_left: number;
    capacity: number;
}): string {
    return e.seats_left > 0
        ? `${e.seats_left} of ${e.capacity} seats open`
        : "Full · waitlist open";
}
