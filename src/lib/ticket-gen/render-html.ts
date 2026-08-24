import { domToCanvas } from "modern-screenshot";
import { stageTicket, ticketCssPx } from "./iframe-stage";
import { renderTemplate, withSerial } from "./merge";
import type { Recipient, TicketSpec } from "./types";

/**
 * Capture a DOM node to a canvas at the spec's DPI.
 *
 * modern-screenshot uses the real browser engine via an SVG <foreignObject>,
 * so shadows/filters/gradients render faithfully. The engine is isolated behind
 * this single function so it can be swapped later.
 */
export async function renderNode(
    node: HTMLElement,
    spec: TicketSpec,
): Promise<HTMLCanvasElement> {
    const { w, h } = ticketCssPx(spec);
    return domToCanvas(node, {
        scale: spec.dpi / 96,
        width: w,
        height: h,
        backgroundColor: "#ffffff",
    });
}

/** Render one recipient's merged ticket HTML to a print-DPI canvas. */
export async function renderTicketCanvas(
    html: string,
    recipient: Recipient,
    index: number,
    spec: TicketSpec,
): Promise<HTMLCanvasElement> {
    const merged = renderTemplate(html, withSerial(recipient, index));
    const { ticket, dispose } = await stageTicket(merged, spec);
    try {
        return await renderNode(ticket, spec);
    } finally {
        dispose();
    }
}

export function canvasToBlob(
    canvas: HTMLCanvasElement,
    type = "image/png",
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Canvas toBlob returned null"));
                return;
            }
            resolve(blob);
        }, type);
    });
}
