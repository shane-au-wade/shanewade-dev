export type Guest = {
    name: string;
    dietary: string[];
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

/**
 * URL encoded in the ticket QR. Points to the wedding link tree once it is
 * live; for now it resolves straight to the shared Google Photos album.
 */
export const TICKET_QR_URL = "https://photos.app.goo.gl/tE1YKb2P5qjdtHGJ7";

export const TICKET_EVENT = {
    house: "Log Cabin",
    city: "The Presidio",
    couple: "Shane & Aileen Productions",
    headline: "A Wedding Show",
    date: "September 18, 2026",
    time: "Dinner",
    admit: "Admit One",
} as const;

export const TICKET_BRIDGE = {
    src: "/golden-gate.jpg",
    heightIn: 1,
    maxTextWidth: 0.6,
    crop: { top: 0.2, right: 0.0, bottom: 0.18, left: 0.0 },
} as const;

export function formatDietary(dietary: string[]): string {
    if (dietary.length === 0) return "None";
    return dietary.join(" · ");
}

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
