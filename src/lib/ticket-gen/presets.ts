import type { PrintPreset } from "./types";

/**
 * Built-in size presets. Each ticket is landscape and tickets stack top-down
 * on the sheet, sharing single cut lines (matching the print workflow used by
 * the original wedding tickets).
 */
export const PRESETS: PrintPreset[] = [
    {
        id: "wedding-5x7",
        label: "2×5 in ticket · 5×7 sheet (3 up)",
        ticket: { widthIn: 5, heightIn: 2, dpi: 300 },
        sheetWidthIn: 5,
        sheetHeightIn: 7,
        ticketsPerSheet: 3,
    },
    {
        id: "photo-4x6",
        label: "2×6 in ticket · 4×6 photo (2 up)",
        ticket: { widthIn: 6, heightIn: 2, dpi: 300 },
        sheetWidthIn: 6,
        sheetHeightIn: 4,
        ticketsPerSheet: 2,
    },
];

export const CUSTOM_PRESET_ID = "custom";

/** A starting point when the user switches to a fully custom size. */
export const CUSTOM_DEFAULT: PrintPreset = {
    id: CUSTOM_PRESET_ID,
    label: "Custom",
    ticket: { widthIn: 5, heightIn: 2, dpi: 300 },
    sheetWidthIn: 5,
    sheetHeightIn: 7,
    ticketsPerSheet: 3,
};

export function getPreset(id: string): PrintPreset {
    return PRESETS.find((p) => p.id === id) ?? CUSTOM_DEFAULT;
}
