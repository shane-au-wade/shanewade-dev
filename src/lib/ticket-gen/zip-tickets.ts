import JSZip from "jszip";
import { composeSheet, sheetToBlob } from "./layout-sheet";
import { renderTicketCanvas } from "./render-html";
import {
    chunkRecipients,
    sheetFilename,
    type PrintPreset,
    type Recipient,
} from "./types";

/** Render a single sheet (up to `ticketsPerSheet` recipients) to a PNG blob. */
export async function renderSheetBlob(
    html: string,
    recipients: Recipient[],
    globalStartIndex: number,
    preset: PrintPreset,
): Promise<Blob> {
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < recipients.length; i++) {
        canvases.push(
            await renderTicketCanvas(
                html,
                recipients[i],
                globalStartIndex + i,
                preset.ticket,
            ),
        );
    }
    return sheetToBlob(composeSheet(canvases, preset));
}

/**
 * Render every recipient into sheets and bundle the PNGs into a ZIP.
 * `onProgress(done, total)` reports completed sheets.
 */
export async function zipTickets(
    html: string,
    recipients: Recipient[],
    preset: PrintPreset,
    onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
    if (recipients.length === 0) {
        throw new Error("No recipients to render");
    }

    const sheets = chunkRecipients(recipients, preset.ticketsPerSheet);
    const zip = new JSZip();

    for (let i = 0; i < sheets.length; i++) {
        const globalStart = i * preset.ticketsPerSheet;
        const blob = await renderSheetBlob(
            html,
            sheets[i],
            globalStart,
            preset,
        );
        zip.file(sheetFilename(i), blob);
        onProgress?.(i + 1, sheets.length);
    }

    return zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });
}
