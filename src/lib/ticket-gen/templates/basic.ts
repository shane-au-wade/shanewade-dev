import type { TemplateDef } from "../types";

export const basicTemplate: TemplateDef = {
    id: "basic",
    name: "Basic event ticket",
    presetId: "wedding-5x7",
    spec: { widthIn: 5, heightIn: 2, dpi: 300 },
    html: `<style>
  .basic { position:absolute; inset:0; display:flex; font-family:"Helvetica Neue",Arial,sans-serif; }
  .basic .body { flex:1; padding:14px 16px; display:flex; flex-direction:column; gap:4px; }
  .basic .event { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:#666; }
  .basic .title { font-size:22px; font-weight:800; line-height:1; letter-spacing:-.5px; }
  .basic .name { font-size:15px; font-weight:600; margin-top:auto; }
  .basic .date { font-size:10px; color:#444; }
  .basic .stub { width:78px; border-left:2px dashed #bbb; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:6px; padding:10px 6px; }
  .basic .qr { width:56px; height:56px; }
  .basic .serial { font-family:ui-monospace,Menlo,monospace; font-size:9px; color:#444; }
</style>
<div class="basic">
  <div class="body">
    <div class="event">{{event}}</div>
    <div class="title">{{title}}</div>
    <div class="name">{{name}}</div>
    <div class="date">{{date}} · {{time}}</div>
  </div>
  <div class="stub">
    <div class="qr">{{qr:{{url}}}}</div>
    <div class="serial">{{serial}}</div>
  </div>
</div>`,
};
