import type { TemplateDef, TicketSpec } from "./types";

const TEMPLATES_KEY = "ticket-gen/templates";
const STATE_KEY = "ticket-gen/state";

export type EditorState = {
    templateId: string;
    presetId: string;
    spec: TicketSpec;
    html: string;
};

function safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/** User-saved templates (defaults live in code, not here). */
export function loadSavedTemplates(): TemplateDef[] {
    if (typeof localStorage === "undefined") return [];
    return safeParse<TemplateDef[]>(localStorage.getItem(TEMPLATES_KEY), []);
}

export function saveTemplate(template: TemplateDef): TemplateDef[] {
    const templates = loadSavedTemplates();
    const idx = templates.findIndex((t) => t.id === template.id);
    if (idx >= 0) {
        templates[idx] = template;
    } else {
        templates.push(template);
    }
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    return templates;
}

export function deleteTemplate(id: string): TemplateDef[] {
    const templates = loadSavedTemplates().filter((t) => t.id !== id);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    return templates;
}

export function loadState(): EditorState | null {
    if (typeof localStorage === "undefined") return null;
    return safeParse<EditorState | null>(
        localStorage.getItem(STATE_KEY),
        null,
    );
}

export function saveState(state: EditorState): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
