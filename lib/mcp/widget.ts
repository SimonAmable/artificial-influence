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
      :root { color-scheme: light dark; --color-background-primary: #101010; --color-background-secondary: #181818; --color-text-primary: #f5f5f5; --color-text-secondary: #a3a3a3; --color-border-primary: #343434; --color-accent: #e9e9e9; --border-radius-lg: 16px; --font-sans: ui-sans-serif, system-ui, sans-serif; }
      @media (prefers-color-scheme: light) { :root { --color-background-primary: #fff; --color-background-secondary: #f7f7f7; --color-text-primary: #171717; --color-text-secondary: #737373; --color-border-primary: #e4e4e4; --color-accent: #222; } }
      * { box-sizing: border-box; } body { margin: 0; background: var(--color-background-primary); color: var(--color-text-primary); font-family: var(--font-sans); } button { font: inherit; }
      #app { padding: 10px; } .card { background: var(--color-background-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--border-radius-lg); overflow: hidden; } .body { display: grid; gap: 8px; padding: 13px 14px 14px; } .eyebrow { align-items: center; color: var(--color-text-secondary); display: flex; font-size: 12px; gap: 7px; } .title { font-size: 15px; font-weight: 620; letter-spacing: -.01em; } .prompt { color: var(--color-text-secondary); font-size: 13px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .detail { color: var(--color-text-secondary); font-size: 12px; } .media { background: #252525; display: block; max-height: 440px; object-fit: cover; width: 100%; } video.media { aspect-ratio: 16 / 9; } audio.media { margin: 12px; width: calc(100% - 24px); } .pending-art { align-items: center; background: linear-gradient(120deg, #222, #343434, #222); background-size: 200% 100%; display: flex; height: 190px; justify-content: center; animation: shimmer 1.8s ease-in-out infinite; } .pending-orb { background: var(--color-accent); border-radius: 50%; height: 20px; opacity: .8; width: 20px; animation: breathe 1.3s ease-in-out infinite; } .error-art { align-items: center; background: #2b2020; color: #d8a6a6; display: flex; font-size: 13px; justify-content: center; min-height: 150px; padding: 24px; text-align: center; } .action { background: transparent; border: 0; color: var(--color-text-primary); cursor: pointer; font-size: 13px; padding: 0; text-align: left; text-decoration: underline; text-underline-offset: 3px; width: fit-content; } .dot { background: currentColor; border-radius: 50%; height: 6px; width: 6px; } .dot.live { animation: breathe 1.3s ease-in-out infinite; } @keyframes breathe { 50% { opacity: .35; transform: scale(.75); } } @keyframes shimmer { to { background-position: -200% 0; } }
    </style>
  </head>
  <body>
    <main id="app" aria-live="polite"></main>
    <script>
      const app = document.getElementById("app");
      const pendingRequests = new Map();
      const refreshDelays = [5000, 7000, 10000, 14000, 18000, 24000];
      let nextId = 1;
      let refreshTimer = null;
      let refreshAttempt = 0;
      let currentGenerationId = null;

      function post(message) { window.parent.postMessage(message, "*"); }
      function request(method, params, callback) { const id = nextId++; if (callback) pendingRequests.set(id, callback); post({ jsonrpc: "2.0", id, method, params }); return id; }
      function notify(method, params) { post({ jsonrpc: "2.0", method, params }); }
      function text(value) { return value == null ? "" : String(value); }
      function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : null; }
      function resize() { requestAnimationFrame(() => notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight })); }
      function titleFor(type) { return type === "video" ? "video" : type === "audio" ? "audio" : "image"; }
      function isPending(status) { return ["pending", "queued", "processing", "starting", "in_progress"].includes(text(status).toLowerCase()); }
      function isFailed(status) { return ["failed", "cancelled", "canceled", "error"].includes(text(status).toLowerCase()); }
      function resetRefresh() { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = null; refreshAttempt = 0; }
      function itemFrom(data) { const generation = object(data.generation); const raw = Array.isArray(data.items) && data.items[0] ? data.items[0] : generation || data; const item = object(raw) || {}; return { id: item.generationId || item.id || data.generationId, status: item.status || data.status || "pending", type: item.type || item.kind || data.type || "image", url: item.mediaUrl || item.url || item.downloadUrl || item.thumbnailUrl || data.url, model: item.model || data.model, prompt: item.prompt || data.prompt, error: item.error || data.error }; }
      function open(url) { request("ui/open-link", { url }); }

      function scheduleRefresh() {
        if (!currentGenerationId || refreshAttempt >= refreshDelays.length) return;
        const delay = refreshDelays[refreshAttempt++];
        refreshTimer = setTimeout(() => {
          request("tools/call", { name: "get_generation", arguments: { generationId: currentGenerationId } }, (response) => {
            const result = response && response.structuredContent;
            if (result) render(result, true);
          });
        }, delay);
      }

      function render(result, isRefresh) {
        if (!isRefresh) resetRefresh();
        const data = object(result) || {};
        const item = itemFrom(data);
        currentGenerationId = item.id ? text(item.id) : null;
        const kind = titleFor(text(item.type));
        const pending = isPending(item.status);
        const failed = isFailed(item.status);
        const card = document.createElement("article"); card.className = "card";
        if (item.url && !failed) { let media; if (kind === "video") { media = document.createElement("video"); media.controls = true; media.playsInline = true; } else if (kind === "audio") { media = document.createElement("audio"); media.controls = true; } else { media = document.createElement("img"); media.alt = text(item.prompt || "Generated image"); } media.className = "media"; media.src = item.url; card.appendChild(media); }
        else if (failed) { const error = document.createElement("div"); error.className = "error-art"; error.textContent = "This generation could not be completed."; card.appendChild(error); }
        else { const waiting = document.createElement("div"); waiting.className = "pending-art"; const orb = document.createElement("span"); orb.className = "pending-orb"; waiting.appendChild(orb); card.appendChild(waiting); }

        const body = document.createElement("div"); body.className = "body";
        const eyebrow = document.createElement("div"); eyebrow.className = "eyebrow"; const dot = document.createElement("span"); dot.className = "dot" + (pending ? " live" : ""); const label = document.createElement("span"); label.textContent = failed ? "Generation stopped" : pending ? "Creating" : "Ready"; eyebrow.append(dot, label);
        const heading = document.createElement("div"); heading.className = "title"; heading.textContent = failed ? "Couldn’t create your " + kind : pending ? "Creating your " + kind : "Your " + kind + " is ready";
        body.append(eyebrow, heading);
        if (item.prompt) { const prompt = document.createElement("div"); prompt.className = "prompt"; prompt.textContent = text(item.prompt); body.appendChild(prompt); }
        if (item.model && !pending) { const detail = document.createElement("div"); detail.className = "detail"; detail.textContent = text(item.model); body.appendChild(detail); }
        if (item.url) { const button = document.createElement("button"); button.type = "button"; button.className = "action"; button.textContent = "Open"; button.onclick = () => open(item.url); body.appendChild(button); }
        card.appendChild(body); app.replaceChildren(card); resize();
        if (pending) scheduleRefresh();
      }

      function applyHostContext(result) { const context = result && result.hostContext; const variables = context && context.styles && context.styles.variables; if (variables && typeof variables === "object") Object.entries(variables).forEach(([key, value]) => document.documentElement.style.setProperty(key, String(value))); if (context && context.theme) document.documentElement.style.colorScheme = context.theme; }
      window.addEventListener("message", (event) => { const message = event.data; if (!message || message.jsonrpc !== "2.0") return; if (message.id && pendingRequests.has(message.id)) { const callback = pendingRequests.get(message.id); pendingRequests.delete(message.id); callback(message.result); return; } if (message.id === 1 && message.result) { applyHostContext(message.result); notify("ui/notifications/initialized", {}); resize(); } if (message.method === "ui/notifications/tool-result") render(message.params && message.params.structuredContent, false); if (message.method === "ui/notifications/host-context-changed") applyHostContext({ hostContext: message.params }); }, { passive: true });
      request("ui/initialize", { appInfo: { name: "unican-media-output", version: "1.1.0" }, appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] }, protocolVersion: "2026-01-26" });
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
