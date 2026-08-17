import JSZip from "jszip";
import { renderSheetPng } from "./render-ticket";
import { chunkGuestsIntoSheets, sheetFilename, type Guest } from "./types";

export async function zipGuestTickets(
    guests: Guest[],
    onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
    if (guests.length === 0) {
        throw new Error("No guests to render");
    }

    const sheets = chunkGuestsIntoSheets(guests);
    const zip = new JSZip();

    for (let i = 0; i < sheets.length; i++) {
        const png = await renderSheetPng(sheets[i], i);
        zip.file(sheetFilename(i), png);
        onProgress?.(i + 1, sheets.length);
    }

    return zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });
}
