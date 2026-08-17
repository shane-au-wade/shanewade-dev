import {
    TICKET_EVENT,
    TICKET_PRINT,
    formatDietary,
    guestSerial,
    type Guest,
} from "./types";

const PRIMARY = "#470012";
const WHITE = "#ffffff";
const FONT =
    '"Helvetica Neue", Helvetica, Arial, ui-sans-serif, system-ui, sans-serif';
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const CSS_DPI = 96;

function px(inches: number): number {
    return inches * TICKET_PRINT.dpi;
}

/** CSS rem on the HTML preview, scaled to 300 DPI print pixels. */
function rem(n: number): number {
    return n * 16 * (TICKET_PRINT.dpi / CSS_DPI);
}

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

function drawBarcode(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
): void {
    const scale = TICKET_PRINT.dpi / CSS_DPI;
    const pattern = [
        [1.5, true],
        [1, false],
        [1.5, true],
        [2, false],
        [1, true],
        [2, false],
    ] as const;
    const period = pattern.reduce((sum, [len]) => sum + len, 0) * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = PRIMARY;

    let cursor = y;
    while (cursor < y + h + period) {
        for (const [len, filled] of pattern) {
            const slice = len * scale;
            if (filled) ctx.fillRect(x, cursor, w, slice);
            cursor += slice;
        }
    }
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
    rotate180: boolean,
): void {
    ctx.save();

    if (rotate180) {
        ctx.translate(originX + width / 2, originY + height / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-width / 2, -height / 2);
    } else {
        ctx.translate(originX, originY);
    }

    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    const stubW = px(0.42);
    const bandW = px(0.32);
    const stubPadY = px(0.1);
    const stubPadX = px(0.04);
    const mainPadX = px(0.12);
    const mainPadTop = px(0.1);
    const mainPadBottom = px(0.08);
    const mainX = stubW;
    const mainW = width - stubW - bandW;

    dashedVLine(ctx, stubW, stubPadY * 0.4, height - stubPadY * 0.4);

    drawBarcode(
        ctx,
        stubPadX + (stubW - stubPadX * 2 - px(0.28)) / 2,
        stubPadY,
        px(0.28),
        px(1.28),
    );

    ctx.save();
    ctx.fillStyle = PRIMARY;
    setFont(ctx, 400, rem(0.38), MONO, 0.04);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(stubW / 2, height - stubPadY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(serial, 0, 0);
    ctx.restore();

    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width - bandW, 0);
    ctx.lineTo(width - bandW, height);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = PRIMARY;
    setFont(ctx, 700, rem(0.48), FONT, 0.22);
    ctx.translate(width - bandW / 2, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(upper(TICKET_EVENT.admit), 0, 0);
    ctx.restore();

    const textX = mainX + mainPadX;
    const textW = mainW - mainPadX * 2;
    let y = mainPadTop;

    const house = upper(TICKET_EVENT.house);
    const city = upper(TICKET_EVENT.city);
    const logoSize = rem(0.52);
    const logoPadX = rem(0.22);
    const logoPadY = rem(0.04);
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
    ctx.fillText(city, textX + textW, y + logoH / 2);
    ctx.textAlign = "left";
    y += logoH + px(0.08);

    setFont(ctx, 500, rem(0.48), FONT, 0.12);
    ctx.globalAlpha = 0.7;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(upper(TICKET_EVENT.couple), textX, y + rem(0.48));
    ctx.globalAlpha = 1;
    y += rem(0.48) + px(0.02);

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
    y += nameSize + px(0.04);

    setFont(ctx, 500, rem(0.5), FONT, 0.06);
    ctx.fillText(
        `${upper(TICKET_EVENT.date)}  ·  ${upper(TICKET_EVENT.time)}`,
        textX,
        y + rem(0.5),
    );

    const tableLabelGap = rem(0.25);
    const metaH = rem(0.38) + tableLabelGap + rem(0.85) + rem(0.08);
    const metaY = height - mainPadBottom - metaH;
    const tableW = px(0.55);

    ctx.beginPath();
    ctx.moveTo(textX + tableW, metaY);
    ctx.lineTo(textX + tableW, metaY + metaH);
    ctx.stroke();

    setFont(ctx, 500, rem(0.38), FONT, 0.16);
    ctx.globalAlpha = 0.65;
    ctx.textBaseline = "top";
    ctx.fillText("TABLE", textX, metaY);
    ctx.globalAlpha = 1;
    setFont(ctx, 700, rem(0.85), MONO, 0);
    ctx.fillText(
        String(guest.table),
        textX,
        metaY + rem(0.38) + tableLabelGap,
    );

    const dietX = textX + tableW + px(0.1);
    const dietW = textX + textW - dietX;
    const dietPadX = px(0.1);
    const dietPadY = px(0.05);
    ctx.strokeRect(dietX, metaY, dietW, metaH);

    const diet = formatDietary(guest.dietary).toUpperCase();
    setFont(ctx, 500, rem(0.38), FONT, 0.16);
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
        metaY + dietPadY + rem(0.38) + rem(0.04),
    );

    ctx.restore();
}

export function renderGuestTicketCanvas(
    guest: Guest,
    index: number,
    canvas: HTMLCanvasElement = document.createElement("canvas"),
): HTMLCanvasElement {
    const width = px(TICKET_PRINT.widthIn);
    const height = px(TICKET_PRINT.heightIn);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");

    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    const ticketH = px(TICKET_PRINT.faceHeightIn);
    const serial = guestSerial(index);

    drawTicketFace(ctx, guest, serial, 0, 0, width, ticketH, true);
    drawTicketFace(
        ctx,
        guest,
        serial,
        0,
        height - ticketH,
        width,
        ticketH,
        false,
    );

    ctx.save();
    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(px(0.12), height / 2);
    ctx.lineTo(width - px(0.12), height / 2);
    ctx.stroke();
    ctx.restore();

    return canvas;
}

export function renderGuestTicketPng(
    guest: Guest,
    index: number,
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const canvas = renderGuestTicketCanvas(guest, index);
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error(`Failed to render PNG for ${guest.name}`));
                return;
            }
            resolve(blob);
        }, "image/png");
    });
}
