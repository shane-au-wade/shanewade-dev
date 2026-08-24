import { inToCssPx, type TicketSpec } from "./types";

/**
 * Base styles injected into every ticket document. Kept intentionally small so
 * a template's own CSS stays in control; this only normalizes the box model and
 * gives `.ticket` a clipped, white canvas at the exact physical size.
 */
const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;}
body{font-family:"Helvetica Neue",Helvetica,Arial,ui-sans-serif,system-ui,sans-serif;color:#000;}
.ticket{position:relative;overflow:hidden;background:#fff;}
img{max-width:none;}
`;

export function ticketCssPx(spec: TicketSpec): { w: number; h: number } {
    return { w: inToCssPx(spec.widthIn), h: inToCssPx(spec.heightIn) };
}

/** Full HTML document for a ticket, sized to the spec, with the design inside. */
export function buildTicketDocument(html: string, spec: TicketSpec): string {
    const { w, h } = ticketCssPx(spec);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body><div class="ticket" id="ticket" style="width:${w}px;height:${h}px">${html}</div></body></html>`;
}

/** Wait for the iframe document's images and fonts to settle before capture. */
async function waitForReady(doc: Document): Promise<void> {
    const images = Array.from(doc.images);
    await Promise.all(
        images.map((img) =>
            img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                      img.addEventListener("load", () => resolve(), {
                          once: true,
                      });
                      img.addEventListener("error", () => resolve(), {
                          once: true,
                      });
                  }),
        ),
    );
    if (doc.fonts?.ready) {
        try {
            await doc.fonts.ready;
        } catch {
            /* ignore font readiness failures */
        }
    }
}

/**
 * Write a ticket design into an existing (visible) iframe for live preview.
 * Returns the `.ticket` element once its contents have loaded.
 */
export function mountPreview(
    iframe: HTMLIFrameElement,
    html: string,
    spec: TicketSpec,
): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
        const doc = iframe.contentDocument;
        if (!doc) {
            reject(new Error("Preview iframe has no document"));
            return;
        }
        const { w, h } = ticketCssPx(spec);
        iframe.width = String(w);
        iframe.height = String(h);
        doc.open();
        doc.write(buildTicketDocument(html, spec));
        doc.close();

        const ticket = doc.getElementById("ticket");
        if (!ticket) {
            reject(new Error("Ticket element missing in preview"));
            return;
        }
        waitForReady(doc).then(() => resolve(ticket));
    });
}

/**
 * Render a ticket design in a throwaway offscreen iframe and return the
 * `.ticket` element (still attached). Call `dispose()` when the capture is done.
 */
export async function stageTicket(
    html: string,
    spec: TicketSpec,
): Promise<{ ticket: HTMLElement; dispose: () => void }> {
    const { w, h } = ticketCssPx(spec);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
        position: "fixed",
        left: "-100000px",
        top: "0",
        width: `${w}px`,
        height: `${h}px`,
        border: "0",
        background: "#fff",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
        iframe.remove();
        throw new Error("Could not create offscreen iframe document");
    }
    doc.open();
    doc.write(buildTicketDocument(html, spec));
    doc.close();

    const ticket = doc.getElementById("ticket");
    if (!ticket) {
        iframe.remove();
        throw new Error("Ticket element missing in offscreen stage");
    }

    await waitForReady(doc);
    return { ticket, dispose: () => iframe.remove() };
}
