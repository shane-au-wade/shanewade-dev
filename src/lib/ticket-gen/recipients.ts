import Papa from "papaparse";
import { guests } from "../wedding-tickets/guests";
import { defaultSerial, type Recipient } from "./types";

/** Map the existing wedding guest list into generic recipient rows. */
export function weddingRecipients(): Recipient[] {
    return guests.map((g, i) => ({
        name: g.name,
        table: String(g.table),
        rsvp: g.rsvp,
        serial: defaultSerial(i),
        glutenFree: g.glutenFree ? "yes" : "",
    }));
}

/** Parse CSV text (with a header row) into recipient rows. */
export function parseCsv(text: string): Recipient[] {
    const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
    });
    return (result.data ?? []).map((row) => {
        const clean: Recipient = {};
        for (const [key, value] of Object.entries(row)) {
            if (key) clean[key] = value == null ? "" : String(value).trim();
        }
        return clean;
    });
}

/** A single placeholder recipient so the editor always has something to show. */
export function sampleRecipient(): Recipient {
    return {
        name: "Guest Name",
        table: "1",
        serial: "001",
        event: "The Event",
        title: "General Admission",
        date: "September 18, 2026",
        time: "7:00 PM",
        url: "https://example.com",
    };
}
