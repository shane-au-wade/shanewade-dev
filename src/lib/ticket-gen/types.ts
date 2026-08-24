/** Physical size of a single ticket plus the DPI it renders at. */
export type TicketSpec = {
    widthIn: number;
    heightIn: number;
    dpi: number;
};

/** A ticket size paired with the print sheet it tiles onto. */
export type PrintPreset = {
    id: string;
    label: string;
    ticket: TicketSpec;
    sheetWidthIn: number;
    sheetHeightIn: number;
    ticketsPerSheet: number;
};

/** One row of merge data. Keys are field names used as {{key}} in templates. */
export type Recipient = Record<string, string>;

/** A saveable ticket design: HTML source plus the size it was authored for. */
export type TemplateDef = {
    id: string;
    name: string;
    html: string;
    presetId: string;
    spec: TicketSpec;
};

export const CSS_DPI = 96;

/** Convert inches to CSS pixels (96 DPI) for on-screen / iframe layout. */
export function inToCssPx(inches: number): number {
    return Math.round(inches * CSS_DPI);
}

/** Generic serial used when a recipient row doesn't supply its own. */
export function defaultSerial(index: number): string {
    return String(index + 1).padStart(3, "0");
}

/** Split recipients into sheet-sized chunks, preserving order. */
export function chunkRecipients(
    recipients: Recipient[],
    perSheet: number,
): Recipient[][] {
    const sheets: Recipient[][] = [];
    const size = Math.max(1, perSheet);
    for (let i = 0; i < recipients.length; i += size) {
        sheets.push(recipients.slice(i, i + size));
    }
    return sheets;
}

export function sheetFilename(sheetIndex: number): string {
    return `sheet-${String(sheetIndex + 1).padStart(2, "0")}.png`;
}
