import JsBarcode from "jsbarcode";
import QRCode from "../qrcodejs/qrcode";
import {
    TICKET_BRIDGE,
    TICKET_EVENT,
    TICKET_PRINT,
    TICKET_QR_URL,
    chunkGuestsIntoSheets,
    formatDietary,
    guestSerial,
    type Guest,
} from "./types";

const PRIMARY = "#470012";
const WHITE = "#ffffff";

let bridgeImage: HTMLImageElement | null = null;
let bridgeImageLoad: Promise<HTMLImageElement> | null = null;

function loadBridgeImage(): Promise<HTMLImageElement> {
    if (bridgeImage) return Promise.resolve(bridgeImage);
    if (!bridgeImageLoad) {
        bridgeImageLoad = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                bridgeImage = img;
                resolve(img);
            };
            img.onerror = () =>
                reject(new Error(`Failed to load ${TICKET_BRIDGE.src}`));
            img.src = TICKET_BRIDGE.src;
        });
    }
    return bridgeImageLoad;
}

const FONT =
    '"Helvetica Neue", Helvetica, Arial, ui-sans-serif, system-ui, sans-serif';
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const CSS_DPI = 96;
const PHI = 1.618;

function px(inches: number): number {
    return inches * TICKET_PRINT.dpi;
}

/** CSS rem on the HTML preview, scaled to 300 DPI print pixels. */
function rem(n: number): number {
    return n * 16 * (TICKET_PRINT.dpi / CSS_DPI);
}

/** φ-based scale — matches --space-* in the design system. */
const SPACE_MD = rem(1);
const SPACE = {
    "2xs": SPACE_MD / PHI ** 3,
    xs: SPACE_MD / PHI ** 2,
    sm: SPACE_MD / PHI,
    md: SPACE_MD,
    lg: SPACE_MD * PHI,
    xl: SPACE_MD * PHI ** 2,
    "2xl": SPACE_MD * PHI ** 3,
} as const;

function upper(value: string): string {
    return value.toUpperCase();
}

function setFont(
    ctx: CanvasRenderingContext2D,
    weight: number,
    size: number,
    family: string,
    letterSpacingEm = 0,
): void {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.letterSpacing = letterSpacingEm ? `${size * letterSpacingEm}px` : "0px";
}

function fitText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxSize: number,
    minSize: number,
    letterSpacingEm = 0,
): number {
    let size = maxSize;
    setFont(ctx, 700, size, FONT, letterSpacingEm);
    while (size > minSize && ctx.measureText(text).width > maxWidth) {
        size -= 1;
        setFont(ctx, 700, size, FONT, letterSpacingEm);
    }
    return size;
}

function dashedVLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    y1: number,
    y2: number,
): void {
    ctx.save();
    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    ctx.restore();
}

function drawBridge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
): void {
    if (!bridgeImage) return;
    const { crop } = TICKET_BRIDGE;
    const sx = bridgeImage.naturalWidth * crop.left;
    const sy = bridgeImage.naturalHeight * crop.top;
    const sw =
        bridgeImage.naturalWidth * (1 - crop.left - crop.right);
    const sh =
        bridgeImage.naturalHeight * (1 - crop.top - crop.bottom);
    ctx.drawImage(bridgeImage, sx, sy, sw, sh, x, y, w, h);
}

function drawBarcode(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
): void {
    const barcode = document.createElement("canvas");
    JsBarcode(barcode, value, {
        format: "CODE128",
        displayValue: false,
        background: WHITE,
        lineColor: PRIMARY,
        margin: 8,
        width: 3,
        height: Math.max(1, Math.round(w)),
    });

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y + h);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(barcode, 0, 0, h, w);
    ctx.restore();
}

/** Render a scannable QR at its native pixel size and blit it 1:1. */
function drawQr(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    size: number,
): void {
    const holder = document.createElement("div");
    new QRCode(holder, {
        text: value,
        width: Math.round(size),
        height: Math.round(size),
        colorDark: PRIMARY,
        colorLight: WHITE,
        correctLevel: QRCode.CorrectLevel.M,
    });

    const qr = holder.querySelector("canvas");
    if (!qr) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, x, y, size, size);
    ctx.restore();
}

function drawTicketFace(
    ctx: CanvasRenderingContext2D,
    guest: Guest,
    serial: string,
    originX: number,
    originY: number,
    width: number,
    height: number,
): void {
    ctx.save();

    ctx.translate(originX, originY);

    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 2;
    // ctx.strokeRect(1, 1, width - 2, height - 2);

    // Safe-area insets so print trimming can't clip important content.
    const safeTop = px(0.1);
    const safeRight = px(0.1);
    const contentRight = width - safeRight;

    const stubW = px(0.6);
    const stubX = contentRight - stubW;
    const railW = px(0.95);
    const mainPadX = SPACE.sm;
    const mainPadTop = SPACE.sm + safeTop;
    const mainPadBottom = SPACE.sm;
    const mainX = railW;
    const mainW = stubX - railW;

    // Left rail: scannable QR to the wedding link tree plus a caption.
    const qrSize = px(0.6);
    const railCenterX = railW / 2;
    const captionSize = rem(0.28);
    const captionGap = SPACE["2xs"];
    const captionLineH = captionSize * 1.15;
    const railBlockH = qrSize + captionGap + captionLineH * 2;
    const qrY = (height - railBlockH) / 2;
    const qrX = railCenterX - qrSize / 2;
    drawQr(ctx, TICKET_QR_URL, qrX, qrY, qrSize);

    ctx.save();
    ctx.fillStyle = PRIMARY;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.7;
    setFont(ctx, 600, captionSize, FONT, 0.1);
    const captionY = qrY + qrSize + captionGap;
    ctx.fillText("SCAN FOR", railCenterX, captionY);
    ctx.fillText("PHOTOS & DETAILS", railCenterX, captionY + captionLineH);
    ctx.restore();

    // Right tear-off stub: one dashed line, then ADMIT ONE, barcode, serial.
    dashedVLine(ctx, stubX, 0, height);

    const stubPad = SPACE.xs;
    const admitSize = rem(0.35);
    const serialSize = rem(0.4);

    ctx.save();
    ctx.fillStyle = PRIMARY;
    setFont(ctx, 700, admitSize, FONT, 0.22);
    ctx.translate(stubX + stubPad + admitSize / 2, height * 0.6);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(upper(TICKET_EVENT.admit), 0, 0);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = PRIMARY;
    setFont(ctx, 700, admitSize, FONT, 0.16);
    ctx.translate(stubX + stubPad + admitSize / 2, height * 0.35);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(upper(`Table ${guest.table}`), 0, 0);
    ctx.restore();


    const barcodeX = stubX + stubPad + admitSize + SPACE["2xs"];
    const barcodeRight = contentRight - stubPad - serialSize - SPACE["2xs"];
    const barcodeW = barcodeRight - barcodeX + 15;
    const barcodeH = (height - stubPad * 2) * 0.4;
    const barcodeY = (height - barcodeH) / 2;
    drawBarcode(ctx, serial, barcodeX, barcodeY, barcodeW, barcodeH);


    const serialCenterX = contentRight - stubPad - serialSize / 2;
    ctx.save();
    ctx.fillStyle = PRIMARY;
    setFont(ctx, 400, serialSize, MONO, 0.04);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(serialCenterX, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(serial, 0, 0);
    ctx.restore();

    const textX = mainX + mainPadX;
    const textW = mainW - mainPadX * 2;
    let y = mainPadTop;

    const house = upper(TICKET_EVENT.house);
    const city = upper(TICKET_EVENT.city);
    const logoSize = rem(0.52);
    const logoPadX = SPACE.xs;
    const logoPadY = SPACE["2xs"];
    setFont(ctx, 700, logoSize, FONT, 0.18);
    const logoW = ctx.measureText(house).width + logoPadX * 2;
    const logoH = logoSize + logoPadY * 2;

    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 2;
    ctx.strokeRect(textX, y, logoW, logoH);
    ctx.fillStyle = PRIMARY;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(house, textX + logoPadX, y + logoH / 2);

    setFont(ctx, 500, rem(0.45), FONT, 0.14);
    ctx.textAlign = "right";
    ctx.fillText(city, textX + textW - 148, y + logoH / 2);
    ctx.textAlign = "left";
    y += logoH + SPACE.xs;

    if (bridgeImage) {
        const { crop, heightIn, maxTextWidth } = TICKET_BRIDGE;
        const cropW = 1 - crop.left - crop.right;
        const cropH = 1 - crop.top - crop.bottom;
        const aspect =
            (bridgeImage.naturalWidth * cropW) /
            (bridgeImage.naturalHeight * cropH);
        const motifH = px(heightIn);
        const motifW = Math.min(textW * maxTextWidth, motifH * aspect);
        drawBridge(ctx, textX + textW - motifW, y, motifW, motifH);
    }

    const headlineSize = rem(0.42);
    setFont(ctx, 700, headlineSize, FONT, 0.08);
    ctx.textBaseline = "alphabetic";
    ctx.fillText(upper(TICKET_EVENT.headline), textX, y + headlineSize);
    y += headlineSize + SPACE["2xs"];

    const coupleSize = rem(0.36);
    setFont(ctx, 500, coupleSize, FONT, 0.12);
    ctx.globalAlpha = 0.7;
    ctx.fillText(upper(TICKET_EVENT.couple), textX, y + coupleSize);
    ctx.globalAlpha = 1;
    y += coupleSize + SPACE["sm"];

    const nameSize = fitText(
        ctx,
        guest.name,
        textW,
        rem(0.92),
        rem(0.5),
        -0.02,
    );
    setFont(ctx, 700, nameSize, FONT, -0.02);
    ctx.fillText(guest.name, textX, y + nameSize);
    y += nameSize + SPACE.xs;

    setFont(ctx, 500, rem(0.5), FONT, 0.06);
    ctx.fillText(
        `${upper(TICKET_EVENT.date)}  ·  ${upper(TICKET_EVENT.time)}`,
        textX,
        y + rem(0.5),
    );

    const labelSize = rem(0.38);
    const tableNumSize = rem(0.85);
    const labelGap = SPACE.sm;
    const metaH = SPACE.xs + labelSize + labelGap + tableNumSize + SPACE.xs;
    const metaY = height - mainPadBottom - metaH;
    const tableW = px(0.55);

    setFont(ctx, 500, labelSize, FONT, 0.16);
    ctx.globalAlpha = 0.65;
    ctx.textBaseline = "top";
    ctx.fillText("TABLE", textX, metaY + SPACE.xs);
    ctx.globalAlpha = 1;
    setFont(ctx, 700, tableNumSize, MONO, 0);
    ctx.fillText(
        String(guest.table),
        textX,
        metaY + SPACE.xs + labelSize + labelGap,
    );

    if (guest.dietary.length > 0) {
        const dietX = textX + tableW + SPACE.sm;
        const dietW = textX + textW - dietX;
        const dietPadX = SPACE.xs;
        const dietPadY = SPACE.xs;
        ctx.strokeRect(dietX, metaY, dietW, metaH);

        const diet = formatDietary(guest.dietary).toUpperCase();
        setFont(ctx, 500, labelSize, FONT, 0.16);
        ctx.globalAlpha = 0.65;
        ctx.fillText("DIETARY", dietX + dietPadX, metaY + dietPadY);
        ctx.globalAlpha = 1;
        const dietSize = fitText(
            ctx,
            diet,
            dietW - dietPadX * 2,
            rem(0.72),
            rem(0.42),
            0.06,
        );
        setFont(ctx, 700, dietSize, FONT, 0.06);
        ctx.fillText(
            diet,
            dietX + dietPadX,
            metaY + dietPadY + labelSize + labelGap,
        );
    }

    ctx.restore();
}

/** Hairline cut marks straddling a ticket edge inside the gutter. */
/** Full-width hairline guide for a single straight cut shared by two tickets. */
function drawCutLine(
    ctx: CanvasRenderingContext2D,
    edgeY: number,
    x1: number,
    x2: number,
): void {
    ctx.save();
    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(x1, edgeY);
    ctx.lineTo(x2, edgeY);
    ctx.stroke();
    ctx.restore();
}

export async function renderSheetCanvas(
    sheetGuests: Guest[],
    sheetIndex: number,
    canvas: HTMLCanvasElement = document.createElement("canvas"),
): Promise<HTMLCanvasElement> {
    await loadBridgeImage();

    const width = px(TICKET_PRINT.sheetWidthIn);
    const height = px(TICKET_PRINT.sheetHeightIn);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");

    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, width, height);

    const ticketW = px(TICKET_PRINT.ticketWidthIn);
    const ticketH = px(TICKET_PRINT.ticketHeightIn);
    const originX = (width - ticketW) / 2;
    const globalStart = sheetIndex * TICKET_PRINT.ticketsPerSheet;

    // Stack from the top factory edge with no gutter so adjacent tickets
    // share a single cut. Left/right/top are factory edges (full-width
    // tickets); only the internal seams and the stack bottom need a cut.
    for (let slot = 0; slot < TICKET_PRINT.ticketsPerSheet; slot++) {
        const y = slot * ticketH;
        const guest = sheetGuests[slot];
        if (!guest) continue;
        const serial = guestSerial(globalStart + slot);
        drawTicketFace(ctx, guest, serial, originX, y, ticketW, ticketH);
    }

    for (let seam = 1; seam <= TICKET_PRINT.ticketsPerSheet; seam++) {
        drawCutLine(ctx, seam * ticketH, originX, originX + ticketW);
    }

    return canvas;
}

/** Render the sheet that contains the guest at `guestIndex`. */
export async function renderGuestSheetCanvas(
    guests: Guest[],
    guestIndex: number,
    canvas: HTMLCanvasElement = document.createElement("canvas"),
): Promise<HTMLCanvasElement> {
    const sheets = chunkGuestsIntoSheets(guests);
    const sheetIndex = Math.floor(guestIndex / TICKET_PRINT.ticketsPerSheet);
    return renderSheetCanvas(sheets[sheetIndex] ?? [], sheetIndex, canvas);
}

export async function renderSheetPng(
    sheetGuests: Guest[],
    sheetIndex: number,
): Promise<Blob> {
    const canvas = await renderSheetCanvas(sheetGuests, sheetIndex);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(
                    new Error(`Failed to render PNG for sheet ${sheetIndex + 1}`),
                );
                return;
            }
            resolve(blob);
        }, "image/png");
    });
}
