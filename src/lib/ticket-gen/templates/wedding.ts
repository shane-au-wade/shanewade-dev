import type { TemplateDef } from "../types";

/**
 * HTML reimplementation of the original canvas wedding ticket
 * (src/lib/wedding-tickets/render-ticket.ts), authored at 5x2in / 96 DPI px.
 * Uses the real-browser features modern-screenshot supports (writing-mode,
 * rotation) that html2canvas could not render.
 */
export const weddingTemplate: TemplateDef = {
    id: "wedding",
    name: "Wedding (reimplemented)",
    presetId: "wedding-5x7",
    spec: { widthIn: 5, heightIn: 2, dpi: 300 },
    html: `<style>
  .wt { --primary:#470012; position:absolute; inset:0; display:flex;
    font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:var(--primary); }

  /* Left rail: QR + caption */
  .wt .rail { width:91px; flex-shrink:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:5px; padding:6px; }
  .wt .rail .qr { width:58px; height:58px; }
  .wt .rail .cap { font-size:4.6px; font-weight:600; letter-spacing:1px;
    text-align:center; line-height:1.2; opacity:.7; text-transform:uppercase; }

  /* Main body */
  .wt .main { flex:1; position:relative; padding:9px 12px; padding-right:66px;
    display:flex; flex-direction:column; }
  .wt .top { display:flex; align-items:center; justify-content:space-between; }
  .wt .logo { border:1.5px solid var(--primary); padding:2px 5px; font-weight:700;
    font-size:8px; letter-spacing:1.6px; }
  .wt .city { font-weight:500; font-size:7px; letter-spacing:1px; }
  .wt .bridge { position:absolute; top:22px; right:66px; height:62px; width:150px;
    object-fit:cover; object-position:center 30%; }
  .wt .headline { font-weight:700; font-size:9px; letter-spacing:.7px; margin-top:7px; }
  .wt .couple { font-weight:500; font-size:6px; letter-spacing:1px; opacity:.7;
    margin-top:2px; }
  .wt .name { font-weight:700; font-size:21px; color:#000; letter-spacing:-.4px;
    line-height:1; margin-top:6px; }
  .wt .date { font-weight:500; font-size:8px; letter-spacing:.5px; margin-top:5px; }
  .wt .meta { margin-top:auto; }
  .wt .meta .label { font-size:6px; letter-spacing:1.5px; font-weight:500; opacity:.65; }
  .wt .meta .tablenum { font-family:ui-monospace,Menlo,monospace; font-weight:700;
    font-size:18px; color:#000; line-height:.95; }

  /* Right tear-off stub */
  .wt .stub { position:absolute; top:0; right:0; width:58px; height:100%;
    border-left:1.5px dashed var(--primary); color:#000; }
  .wt .stub .admit { position:absolute; left:5px; top:60%; transform:translateY(-50%) rotate(180deg);
    writing-mode:vertical-rl; font-weight:700; font-size:8px; letter-spacing:2px; }
  .wt .stub .stub-table { position:absolute; left:5px; top:22%; transform:translateY(-50%) rotate(180deg);
    writing-mode:vertical-rl; font-weight:700; font-size:6px; letter-spacing:1px; }
  .wt .stub .barcode { position:absolute; top:50%; left:52%; width:118px; height:22px;
    transform:translate(-50%,-50%) rotate(90deg); }
  .wt .stub .barcode img { width:100%; height:100%; }
  .wt .stub .serial { position:absolute; right:3px; top:50%; transform:translateY(-50%) rotate(180deg);
    writing-mode:vertical-rl; font-family:ui-monospace,Menlo,monospace; font-size:9px; letter-spacing:1px; }
</style>
<div class="wt">
  <div class="rail">
    <div class="qr">{{qr:https://photos.app.goo.gl/tE1YKb2P5qjdtHGJ7}}</div>
    <div class="cap">Scan for<br/>Photos &amp; Details</div>
  </div>

  <div class="main">
    <div class="top">
      <span class="logo">LOG CABIN</span>
      <span class="city">THE PRESIDIO</span>
    </div>
    <img class="bridge" src="/golden-gate.png" alt="" />
    <div class="headline">THE WEDDING SHOW</div>
    <div class="couple">SHANE &amp; AILEEN PRODUCTIONS LTD</div>
    <div class="name">{{name}}</div>
    <div class="date">SEPTEMBER 18, 2026 · DINNER</div>
    <div class="meta">
      <div class="label">TABLE</div>
      <div class="tablenum">{{table}}</div>
    </div>
  </div>

  <div class="stub">
    <div class="stub-table">TABLE {{table}}</div>
    <div class="admit">ADMIT ONE</div>
    <div class="barcode">{{barcode:SWA-{{serial}}}}</div>
    <div class="serial">SWA-{{serial}}</div>
  </div>
</div>`,
};
