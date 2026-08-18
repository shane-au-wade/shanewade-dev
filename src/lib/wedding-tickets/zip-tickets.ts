import JSZip from "jszip";
import { renderSheetPng } from "./render-ticket";
import { chunkGuestsIntoSheets, sheetFilename, type Guest } from "./types";

function generateZip(zip: JSZip): Promise<Blob> {
    return zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });
}

/**
 * Standard printing: one PNG per sheet with the printed red bridge. A single
 * flat set of files ready to upload to a consumer print service.
 */
export async function zipStandardTickets(
    guests: Guest[],
    onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
    if (guests.length === 0) {
        throw new Error("No guests to render");
    }

    const sheets = chunkGuestsIntoSheets(guests);
    const zip = new JSZip();

    for (let i = 0; i < sheets.length; i++) {
        const png = await renderSheetPng(sheets[i], i, "standard");
        zip.file(sheetFilename(i), png);
        onProgress?.(i + 1, sheets.length);
    }

    return generateZip(zip);
}

/**
 * Foil printing: two aligned files per sheet — `tickets/` holds the ink layer
 * (bridge knocked out) and `foil/` holds the gold stamping layer (bridge
 * silhouettes only). Filenames match 1:1 across folders for registration.
 */
export async function zipFoilTickets(
    guests: Guest[],
    onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
    if (guests.length === 0) {
        throw new Error("No guests to render");
    }

    const sheets = chunkGuestsIntoSheets(guests);
    const zip = new JSZip();
    const ticketsDir = zip.folder("tickets");
    const foilDir = zip.folder("foil");
    if (!ticketsDir || !foilDir) {
        throw new Error("Could not create zip folders");
    }

    for (let i = 0; i < sheets.length; i++) {
        // Base sheet: full ticket with the bridge knocked out.
        const basePng = await renderSheetPng(sheets[i], i, "base");
        ticketsDir.file(sheetFilename(i), basePng);
        // Foil sheet: only the bridge silhouettes, registered to the knockouts.
        const foilPng = await renderSheetPng(sheets[i], i, "foil");
        foilDir.file(sheetFilename(i), foilPng);
        onProgress?.(i + 1, sheets.length);
    }

    return generateZip(zip);
}
