import type { TemplateDef } from "../types";

export const blankTemplate: TemplateDef = {
    id: "blank",
    name: "Blank",
    presetId: "wedding-5x7",
    spec: { widthIn: 5, heightIn: 2, dpi: 300 },
    html: `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;">
  Start designing — edit the HTML on the left.
</div>`,
};
