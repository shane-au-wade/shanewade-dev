import { canvasToBlob } from "./render-html";
import type { PrintPreset } from "./types";

/** Full-width dashed guide for a single straight cut shared by two tickets. */
function drawCutLine(
    ctx: CanvasRenderingContext2D,
    edgeY: number,
    x1: number,
    x2: number,
): void {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(x1, Math.round(edgeY) + 0.5);
    ctx.lineTo(x2, Math.round(edgeY) + 0.5);
    ctx.stroke();
    ctx.restore();
}

/**
 * Composite already-rendered ticket canvases onto one print sheet. Tickets are
 * horizontally centered and stacked top-down with no gutter, so adjacent
 * tickets share a single cut line.
 */
export function composeSheet(
    ticketCanvases: HTMLCanvasElement[],
    preset: PrintPreset,
): HTMLCanvasElement {
    const { dpi } = preset.ticket;
    const sheetW = Math.round(preset.sheetWidthIn * dpi);
    const sheetH = Math.round(preset.sheetHeightIn * dpi);
    const ticketW = Math.round(preset.ticket.widthIn * dpi);
    const ticketH = Math.round(preset.ticket.heightIn * dpi);

    const canvas = document.createElement("canvas");
    canvas.width = sheetW;
    canvas.height = sheetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create sheet canvas context");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sheetW, sheetH);

    const originX = Math.round((sheetW - ticketW) / 2);

    ticketCanvases.forEach((tc, slot) => {
        const y = slot * ticketH;
        ctx.drawImage(tc, originX, y, ticketW, ticketH);
    });

    for (let seam = 1; seam <= ticketCanvases.length; seam++) {
        drawCutLine(ctx, seam * ticketH, originX, originX + ticketW);
    }

    return canvas;
}

export function sheetToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return canvasToBlob(canvas, "image/png");
}
