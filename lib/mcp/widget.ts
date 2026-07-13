import "server-only"

export const UNICAN_MEDIA_WIDGET_URI = "ui://unican/media-output.html"
export const UNICAN_MEDIA_WIDGET_MIME_TYPE = "text/html;profile=mcp-app"

const WIDGET_HTML = String.raw`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light dark; --color-background-primary: #101010; --color-background-secondary: #191919; --color-text-primary: #f5f5f5; --color-text-secondary: #a0a0a0; --color-border-primary: #343434; --color-border-secondary: #292929; --border-radius-lg: 14px; --font-sans: ui-sans-serif, system-ui, sans-serif; }
      @media (prefers-color-scheme: light) { :root { --color-background-primary: #fff; --color-background-secondary: #f6f6f6; --color-text-primary: #171717; --color-text-secondary: #666; --color-border-primary: #dedede; --color-border-secondary: #eee; } }
      * { box-sizing: border-box; } body { margin: 0; background: var(--color-background-primary); color: var(--color-text-primary); font-family: var(--font-sans); } button, a { font: inherit; } #app { display: grid; gap: 12px; padding: 12px; } .empty, .card, .model { border: 1px solid var(--color-border-primary); border-radius: var(--border-radius-lg); background: var(--color-background-secondary); } .empty { color: var(--color-text-secondary); padding: 16px; text-align: center; } .meta { display: flex; flex-wrap: wrap; gap: 6px; } .badge { border: 1px solid var(--color-border-primary); border-radius: 999px; color: var(--color-text-secondary); font-size: 12px; padding: 5px 8px; } .models { display: grid; gap: 8px; } .model { display: grid; gap: 4px; padding: 11px; } .model strong { font-size: 14px; } .model span { color: var(--color-text-secondary); font-size: 12px; overflow-wrap: anywhere; } .grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); } .card { overflow: hidden; } .media, .placeholder { aspect-ratio: 1 / 1; background: var(--color-border-secondary); display: block; object-fit: cover; width: 100%; } video.media, audio.media { aspect-ratio: 16 / 9; } .placeholder { align-items: center; color: var(--color-text-secondary); display: grid; font-size: 13px; justify-content: center; padding: 12px; text-align: center; } .caption { display: grid; gap: 5px; padding: 10px; } .caption strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .caption span { color: var(--color-text-secondary); font-size: 12px; } .open { background: transparent; border: 0; color: inherit; cursor: pointer; padding: 0; text-align: left; text-decoration: underline; }
    </style>
  </head>
  <body>
    <main id="app"><div class="empty">Waiting for UniCan output…</div></main>
    <script>
      const app = document.getElementById("app");
      let nextId = 1;

      function post(message) { window.parent.postMessage(message, "*"); }
      function request(method, params) { const id = nextId++; post({ jsonrpc: "2.0", id, method, params }); return id; }
      function notify(method, params) { post({ jsonrpc: "2.0", method, params }); }
      function text(value) { return value == null ? "" : String(value); }
      function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : null; }

      function resize() { requestAnimationFrame(() => notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight })); }
      function clear() { app.replaceChildren(); }
      function empty(message) { const el = document.createElement("div"); el.className = "empty"; el.textContent = message; app.appendChild(el); resize(); }
      function badge(value) { if (!value) return null; const el = document.createElement("span"); el.className = "badge"; el.textContent = text(value); return el; }
      function open(url) { request("ui/open-link", { url }); }

      function mediaItem(value) {
        const item = object(value) || {};
        return { id: item.id || item.generationId, type: item.type || item.kind || "image", status: item.status || "ready", url: item.mediaUrl || item.url || item.downloadUrl || item.thumbnailUrl, model: item.model, prompt: item.prompt, error: item.error };
      }

      function renderModels(data) {
        const models = Array.isArray(data.models) ? data.models : [];
        if (!models.length) return empty("No models returned.");
        const meta = document.createElement("div"); meta.className = "meta"; meta.appendChild(badge(data.total ? data.total + " models" : models.length + " models")); app.appendChild(meta);
        const list = document.createElement("section"); list.className = "models";
        models.forEach((model) => { const row = document.createElement("article"); row.className = "model"; const title = document.createElement("strong"); title.textContent = text(model.label || model.name || model.identifier || "Model"); const details = document.createElement("span"); details.textContent = [model.identifier, model.type || model.kind, model.provider].filter(Boolean).join(" · "); row.append(title, details); list.appendChild(row); });
        app.appendChild(list); resize();
      }

      function renderMedia(data) {
        const raw = Array.isArray(data.items) ? data.items : Array.isArray(data.generations) ? data.generations : data.generation ? [data.generation] : [data];
        const items = raw.map(mediaItem).filter((item) => item.id || item.url || item.error || item.status);
        const meta = document.createElement("div"); meta.className = "meta"; [data.model, data.status, items.length ? items.length + " item" + (items.length === 1 ? "" : "s") : null].forEach((value) => { const el = badge(value); if (el) meta.appendChild(el); }); if (meta.childNodes.length) app.appendChild(meta);
        if (!items.length) return empty("No media returned.");
        const grid = document.createElement("section"); grid.className = "grid";
        items.forEach((item) => { const card = document.createElement("article"); card.className = "card"; if (item.url && item.status !== "failed") { let el; if (item.type === "video") { el = document.createElement("video"); el.controls = true; el.playsInline = true; } else if (item.type === "audio") { el = document.createElement("audio"); el.controls = true; } else { el = document.createElement("img"); el.alt = text(item.prompt || "Generated media"); } el.className = "media"; el.src = item.url; card.appendChild(el); } else { const placeholder = document.createElement("div"); placeholder.className = "placeholder"; placeholder.textContent = text(item.error || item.status || "Generating"); card.appendChild(placeholder); } const caption = document.createElement("div"); caption.className = "caption"; const title = document.createElement("strong"); title.textContent = text(item.model || item.type || "Media"); const state = document.createElement("span"); state.textContent = text(item.error || item.status || "ready"); caption.append(title, state); if (item.url) { const button = document.createElement("button"); button.className = "open"; button.type = "button"; button.textContent = "Open media"; button.onclick = () => open(item.url); caption.appendChild(button); } card.appendChild(caption); grid.appendChild(card); });
        app.appendChild(grid); resize();
      }

      function render(result) { clear(); const data = object(result); if (!data) return empty("No output returned."); if (Array.isArray(data.models)) renderModels(data); else renderMedia(data); }
      function applyHostContext(result) { const context = result && result.hostContext; const variables = context && context.styles && context.styles.variables; if (variables && typeof variables === "object") Object.entries(variables).forEach(([key, value]) => document.documentElement.style.setProperty(key, String(value))); if (context && context.theme) document.documentElement.style.colorScheme = context.theme; }

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;
        if (message.id === 1 && message.result) { applyHostContext(message.result); notify("ui/notifications/initialized", {}); resize(); }
        if (message.method === "ui/notifications/tool-result") render(message.params && message.params.structuredContent);
        if (message.method === "ui/notifications/host-context-changed") applyHostContext({ hostContext: message.params });
      }, { passive: true });

      request("ui/initialize", { appInfo: { name: "unican-media-output", version: "1.0.0" }, appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] }, protocolVersion: "2026-01-26" });
    </script>
  </body>
</html>
`.trim()

export function getUnicanMediaWidgetResource() {
  return {
    uri: UNICAN_MEDIA_WIDGET_URI,
    mimeType: UNICAN_MEDIA_WIDGET_MIME_TYPE,
    text: WIDGET_HTML,
    _meta: {
      ui: {
        prefersBorder: true,
        csp: {
          connectDomains: [],
          resourceDomains: ["https://*.supabase.co", "https://replicate.delivery", "https://fal.media"],
        },
      },
    },
  }
}
