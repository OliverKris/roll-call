/**
 * Roll Call design tokens.
 *
 * The interface is monochrome (chalk paper and ink). Color comes only from the
 * player pieces, so a splash of red or yellow always means "a person at a table".
 */

export const colors = {
    paper: "#F1F3EE",
    surface: "#FFFFFF",
    ink: "#16202C",
    slate: "#5E6876",
    faint: "#8C95A1",
    line: "#DCE0D9",
    lineStrong: "#C4CAC1",
    danger: "#C2352B",
    dangerSoft: "#F8E5E3",
    positive: "#1E7F53",
    positiveSoft: "#E3F1E9",
    waiting: "#9A6500",
    waitingSoft: "#FBEFD6",
};

/** Classic board-game player colors, used for seats and avatars. */
export const pieces = [
    "#D9412E",
    "#1F4ED8",
    "#E8A317",
    "#239B63",
    "#7B4BC9",
    "#E0699A",
];

/** A stable piece color for a user, so the same person always gets the same color. */
export function pieceFor(id: string | null | undefined): string {
    if (!id) return pieces[0];
    let hash = 0;
    for (let i = 0; i < id.length; i++)
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return pieces[Math.abs(hash) % pieces.length];
}

export const fonts = {
    display: "BricolageGrotesque_700Bold",
    displayMedium: "BricolageGrotesque_600SemiBold",
};

/** Type scale, roughly 1.25 between steps. Body text uses the system font. */
export const type = {
    display: {
        fontFamily: fonts.display,
        fontSize: 34,
        lineHeight: 38,
        letterSpacing: -0.6,
    },
    title: {
        fontFamily: fonts.display,
        fontSize: 26,
        lineHeight: 30,
        letterSpacing: -0.4,
    },
    heading: {
        fontFamily: fonts.displayMedium,
        fontSize: 20,
        lineHeight: 24,
        letterSpacing: -0.2,
    },
    body: { fontSize: 17, lineHeight: 24 },
    secondary: { fontSize: 15, lineHeight: 21 },
    caption: { fontSize: 13, lineHeight: 18 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, pill: 999 };
