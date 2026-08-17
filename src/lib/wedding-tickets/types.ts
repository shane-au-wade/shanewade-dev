export type Guest = {
    name: string;
    dietary: string[];
    table: number | string;
    rsvp: "accepted" | "pending";
};

export const TICKET_PRINT = {
    dpi: 300,
    widthIn: 4,
    heightIn: 6,
    faceHeightIn: 1.85,
} as const;

export const TICKET_EVENT = {
    house: "Log Cabin",
    city: "San Francisco",
    couple: "Shane & Aileen",
    date: "September 2026",
    time: "Dinner",
    admit: "Admit One",
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

export function guestFilename(guest: Guest, index: number): string {
    const table = String(guest.table).replace(/[^\w]+/g, "");
    const name = guest.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return `${guestSerial(index).toLowerCase()}-table-${table}-${name}.png`;
}
