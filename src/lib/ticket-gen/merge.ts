import JsBarcode from "jsbarcode";
import QRCode from "../qrcodejs/qrcode";
import { defaultSerial, type Recipient } from "./types";

const FIELD_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;
const QR_RE = /\{\{\s*qr\s*:\s*([^}]*?)\s*\}\}/g;
const BARCODE_RE = /\{\{\s*barcode\s*:\s*([^}]*?)\s*\}\}/g;

const qrCache = new Map<string, string>();
const barcodeCache = new Map<string, string>();

/** Render a QR to a crisp PNG data URI (cached by value). */
export function qrDataUrl(value: string, size = 320): string {
    const key = `${size}:${value}`;
    const hit = qrCache.get(key);
    if (hit) return hit;

    const holder = document.createElement("div");
    new QRCode(holder, {
        text: value || " ",
        width: size,
        height: size,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
    });

    const canvas = holder.querySelector("canvas");
    const img = holder.querySelector("img");
    const url = canvas
        ? canvas.toDataURL("image/png")
        : (img?.getAttribute("src") ?? "");
    qrCache.set(key, url);
    return url;
}

/** Render a CODE128 barcode to a PNG data URI (cached by value). */
export function barcodeDataUrl(value: string): string {
    const hit = barcodeCache.get(value);
    if (hit) return hit;

    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value || " ", {
        format: "CODE128",
        displayValue: false,
        background: "#ffffff",
        lineColor: "#000000",
        margin: 0,
        width: 3,
        height: 120,
    });
    const url = canvas.toDataURL("image/png");
    barcodeCache.set(value, url);
    return url;
}

function fillFields(html: string, recipient: Recipient): string {
    return html.replace(FIELD_RE, (_, key: string) => recipient[key] ?? "");
}

/**
 * Resolve a template against a single recipient:
 * 1. `{{field}}` tokens are substituted (including inside qr/barcode args),
 * 2. `{{qr:VALUE}}` / `{{barcode:VALUE}}` become data-URI <img> elements.
 */
export function renderTemplate(html: string, recipient: Recipient): string {
    const filled = fillFields(html, recipient);

    return filled
        .replace(
            QR_RE,
            (_, value: string) =>
                `<img class="tg-qr" alt="QR code" src="${qrDataUrl(value)}" style="display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated" />`,
        )
        .replace(
            BARCODE_RE,
            (_, value: string) =>
                `<img class="tg-barcode" alt="Barcode" src="${barcodeDataUrl(value)}" style="display:block;width:100%;height:100%;object-fit:fill;image-rendering:pixelated" />`,
        );
}

/** Ensure a recipient has a `serial` for `{{serial}}` / `{{barcode:{{serial}}}}`. */
export function withSerial(recipient: Recipient, index: number): Recipient {
    if (recipient.serial) return recipient;
    return { ...recipient, serial: defaultSerial(index) };
}

/** Collect the distinct `{{field}}` names referenced by a template. */
export function extractFields(html: string): string[] {
    const fields = new Set<string>();
    let match: RegExpExecArray | null;
    const re = new RegExp(FIELD_RE);
    while ((match = re.exec(html)) !== null) {
        fields.add(match[1]);
    }
    return [...fields];
}
