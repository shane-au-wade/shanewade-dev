import type { TemplateDef } from "../types";
import { basicTemplate } from "./basic";
import { blankTemplate } from "./blank";
import { weddingTemplate } from "./wedding";

export const DEFAULT_TEMPLATES: TemplateDef[] = [
    weddingTemplate,
    basicTemplate,
    blankTemplate,
];

export { basicTemplate, blankTemplate, weddingTemplate };
