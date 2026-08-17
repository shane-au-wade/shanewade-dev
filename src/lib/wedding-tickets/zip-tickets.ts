import JSZip from "jszip";
import { renderGuestTicketPng } from "./render-ticket";
import { guestFilename, type Guest } from "./types";

export async function zipGuestTickets(
    guests: Guest[],
    onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
    if (guests.length === 0) {
        throw new Error("No guests to render");
    }

    const zip = new JSZip();

    for (let i = 0; i < guests.length; i++) {
        const guest = guests[i];
        const png = await renderGuestTicketPng(guest, i);
        zip.file(guestFilename(guest, i), png);
        onProgress?.(i + 1, guests.length);
    }

    return zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });
}
