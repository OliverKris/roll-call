/**
 * Roll Call, night edition.
 *
 * A warm near-black ground, like a table under one lamp. Surfaces are lighter
 * steps of it, with no borders or shadows. The only hue is the open-seat
 * green, used on data: open seats, "you're in", nothing else. Buttons, tabs
 * and navigation stay black and white.
 */

export const colors = {
  ground: "#0E0D0C", // the page, the tab bar and the headers
  surface: "#181716", // cards and grouped lists
  raised: "#2A2826", // controls and the table inside a card
  rule: "#262422", // row separators inside a card
  control: "#4A4744", // outlined controls

  text: "#FFFFFF",
  muted: "#B4B1AC", // secondary text
  faint: "#95918B", // meta, placeholders (4.5:1 on raised)

  seat: "#5ED08F", // an open seat; also "positive"
  seatSoft: "#17291F",
  taken: "#D9D5CF", // a taken seat
  waiting: "#E5A93B",
  waitingSoft: "#2B2414",
  danger: "#EF6A6F",
  dangerSoft: "#2C1A1C",
  badge: "#E5484D", // unread count

  primary: "#FFFFFF", // the one filled button, inverted
  onPrimary: "#0E0D0C",
};

export const fonts = {
  // Bricolage is the wordmark's face only; everything else is the system grotesk
  wordmark: "BricolageGrotesque_700Bold",
};

const tabular = { fontVariant: ["tabular-nums" as const] };

export const type = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: "600" as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  figure: { fontSize: 24, lineHeight: 28, fontWeight: "600" as const, ...tabular },
  tabular,
};

export const space = { xs: 4, sm: 8, md: 12, gap: 14, lg: 16, xl: 24, xxl: 32 };

export const radius = { card: 20, inner: 12, pill: 999 };
