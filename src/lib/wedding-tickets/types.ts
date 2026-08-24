export type Guest = {
    name: string;
    glutenFree?: boolean;
    table: number | string;
    rsvp: "accepted" | "pending";
};

export const TICKET_PRINT = {
    dpi: 300,
    sheetWidthIn: 5,
    sheetHeightIn: 7,
    ticketWidthIn: 5,
    ticketHeightIn: 2,
    ticketsPerSheet: 3,
} as const;

/** Split guests into sheets of `ticketsPerSheet`, preserving list order. */
export function chunkGuestsIntoSheets(guests: Guest[]): Guest[][] {
    const sheets: Guest[][] = [];
    for (let i = 0; i < guests.length; i += TICKET_PRINT.ticketsPerSheet) {
        sheets.push(guests.slice(i, i + TICKET_PRINT.ticketsPerSheet));
    }
    return sheets;
}

/** Shared Google Photos album guests can add to and browse. */
export const WEDDING_PHOTOS_URL = "https://photos.app.goo.gl/tE1YKb2P5qjdtHGJ7";

/**
 * URL encoded in the ticket QR. Points to the guest-facing wedding day page,
 * which links out to the shared photo album (and later, featured photos).
 */
export const TICKET_QR_URL = "https://www.shanewade.dev/wedding-day";

export const TICKET_EVENT = {
    house: "Log Cabin",
    city: "The Presidio",
    couple: "Shane & Aileen Productions LTD",
    headline: "The Wedding Show",
    date: "September 18, 2026",
    time: "Dinner",
    admit: "Admit One",
} as const;

export const TICKET_BRIDGE = {
    src: "/golden-gate.png",
    foilSrc: "/golden-gate-foil.png",
    heightIn: 1,
    maxTextWidth: 0.6,
    crop: { top: 0.2, right: 0.0, bottom: 0.18, left: 0.0 },
} as const;

/**
 * - `standard`: full ticket with the printed red bridge photo (single-file zip).
 * - `base`: full ticket with the bridge knocked out (ink layer of the foil set).
 * - `foil`: only the bridge silhouettes (gold stamping layer of the foil set).
 */
export type RenderMode = "standard" | "base" | "foil";

export const TICKET_GLUTEN_FREE = {
    src: "/gluten-free.jpg",
    sizeIn: 0.6,
} as const;

export function formatRsvp(rsvp: Guest["rsvp"]): string {
    return rsvp === "accepted" ? "Accepted" : "Pending";
}

export function guestSerial(index: number): string {
    return `SWA-${String(index + 1).padStart(3, "0")}`;
}

export function sheetFilename(sheetIndex: number): string {
    return `sheet-${String(sheetIndex + 1).padStart(2, "0")}.png`;
}

export function guestFilename(guest: Guest, index: number): string {
    const table = String(guest.table).replace(/[^\w]+/g, "");
    const name = guest.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return `${guestSerial(index).toLowerCase()}-table-${table}-${name}.png`;
}
