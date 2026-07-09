import "server-only"

export const UNICAN_MEDIA_WIDGET_URI = "ui://widget/unican-media-output.html"
export const UNICAN_MEDIA_WIDGET_MIME_TYPE = "text/html;profile=mcp-app"

const WIDGET_HTML = String.raw`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
        --bg: #ffffff;
        --panel: #f6f6f6;
        --panel-2: #eeeeee;
        --border: #dedede;
        --overlay: rgba(255,255,255,.88);
        --overlay-border: rgba(0,0,0,.12);
        --shine: rgba(255,255,255,.75);
        --text: #111111;
        --muted: #666666;
        --muted-2: #8a8a8a;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #101010;
          --panel: #181818;
          --panel-2: #202020;
          --border: #303030;
          --overlay: rgba(0,0,0,.58);
          --overlay-border: rgba(255,255,255,.18);
          --shine: rgba(255,255,255,.08);
          --text: #f5f5f5;
          --muted: #a0a0a0;
          --muted-2: #777777;
        }
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button {
        color: inherit;
        font: inherit;
      }

      .wrap {
        display: grid;
        gap: 10px;
        padding: 12px;
      }

      .prompt {
        color: var(--text);
        font-size: 13px;
        line-height: 1.45;
        overflow: hidden;
      }

      .prompt.collapsed {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .show-more {
        width: fit-content;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font-size: 12px;
        padding: 0;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .badge {
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--panel);
        color: var(--muted);
        font-size: 11px;
        line-height: 1;
        padding: 6px 8px;
        white-space: nowrap;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .grid.multi {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .card {
        position: relative;
        overflow: hidden;
        min-height: 160px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
      }

      .media {
        display: block;
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        background: var(--panel-2);
      }

      .media.video,
      .media.audio {
        aspect-ratio: 16 / 9;
      }

      .placeholder {
        display: grid;
        place-items: center;
        width: 100%;
        aspect-ratio: 1 / 1;
        background:
          linear-gradient(100deg, transparent 20%, var(--shine) 35%, transparent 50%),
          var(--panel-2);
        background-size: 220% 100%;
        animation: load 1.2s ease-in-out infinite;
        color: var(--muted);
        font-size: 12px;
      }

      .placeholder.video,
      .placeholder.audio {
        aspect-ratio: 16 / 9;
      }

      @keyframes load {
        from { background-position: 160% 0; }
        to { background-position: -60% 0; }
      }

      .download {
        position: absolute;
        right: 8px;
        top: 8px;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 1px solid var(--overlay-border);
        border-radius: 999px;
        background: var(--overlay);
        cursor: pointer;
        backdrop-filter: blur(10px);
      }

      .download svg {
        width: 15px;
        height: 15px;
      }

      .caption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px;
        color: var(--muted);
        font-size: 11px;
      }

      .caption span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .models {
        display: grid;
        gap: 8px;
      }

      .model-row {
        display: grid;
        gap: 6px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
        padding: 10px;
      }

      .model-title {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 13px;
        font-weight: 600;
      }

      .model-id {
        color: var(--muted-2);
        font-size: 11px;
        overflow-wrap: anywhere;
      }

      .empty {
        border: 1px dashed var(--border);
        border-radius: 8px;
        color: var(--muted);
        font-size: 12px;
        padding: 16px;
        text-align: center;
      }

      @media (max-width: 520px) {
        .grid.multi { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main id="app" class="wrap"></main>
    <script>
      const app = document.getElementById("app");
      let pollTimer = null;
      let pollAttempts = 0;

      function text(value) {
        return value == null ? "" : String(value);
      }

      function compact(value) {
        return text(value).replace(/\s+/g, " ").trim();
      }

      function statusLabel(value) {
        const status = compact(value || "ready").toLowerCase();
        return status.replace(/_/g, " ");
      }

      function isWorking(status) {
        const value = compact(status).toLowerCase();
        return value === "queued" || value === "pending" || value === "processing" || value === "generating" || value === "starting";
      }

      function createBadge(label) {
        if (!compact(label)) return null;
        const el = document.createElement("span");
        el.className = "badge";
        el.textContent = compact(label);
        return el;
      }

      function appendBadges(labels) {
        const clean = labels.map(compact).filter(Boolean);
        if (!clean.length) return;
        const wrap = document.createElement("div");
        wrap.className = "badges";
        clean.forEach((label) => wrap.appendChild(createBadge(label)));
        app.appendChild(wrap);
      }

      function pickItems(data) {
        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data?.generations)) return data.generations.map(toMediaItem);
        if (data?.generation) return [toMediaItem(data.generation)];
        if (data?.generationId || data?.url) return [toMediaItem(data)];
        return [];
      }

      function toMediaItem(item) {
        if (!item || typeof item !== "object") return {};
        const url = item.mediaUrl || item.url || item.downloadUrl || item.thumbnailUrl;
        return {
          id: item.id || item.generationId,
          status: item.status,
          kind: item.kind || item.type,
          mediaUrl: item.mediaUrl || item.url || null,
          thumbnailUrl: item.thumbnailUrl || url || null,
          downloadUrl: item.downloadUrl || item.url || null,
          mimeType: item.mimeType || null,
          model: item.model || null,
          prompt: item.prompt || null,
          error: item.error || null,
          createdAt: item.createdAt || null,
        };
      }

      function renderPrompt(prompt) {
        const clean = compact(prompt);
        if (!clean) return;
        const promptEl = document.createElement("div");
        promptEl.className = "prompt collapsed";
        promptEl.textContent = clean;
        app.appendChild(promptEl);

        if (clean.length < 150) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "show-more";
        button.textContent = "Show more...";
        button.onclick = () => {
          const collapsed = promptEl.classList.toggle("collapsed");
          button.textContent = collapsed ? "Show more..." : "Show less";
          notifyHeight();
        };
        app.appendChild(button);
      }

      function renderModels(data) {
        const models = Array.isArray(data?.models) ? data.models : [];
        if (!models.length) {
          renderEmpty("No models returned.");
          return;
        }

        appendBadges([data.total ? String(data.total) + " models" : String(models.length) + " models", data.defaultImageModel ? "Default: " + data.defaultImageModel : ""]);
        const list = document.createElement("section");
        list.className = "models";

        models.forEach((model) => {
          const row = document.createElement("article");
          row.className = "model-row";

          const title = document.createElement("div");
          title.className = "model-title";
          title.innerHTML = "<span>" + escapeHtml(model.label || model.name || model.identifier || model.id || "Model") + "</span><span>" + escapeHtml(model.kind || model.type || "") + "</span>";
          row.appendChild(title);

          const id = document.createElement("div");
          id.className = "model-id";
          id.textContent = model.identifier || model.id || "";
          row.appendChild(id);

          const badges = document.createElement("div");
          badges.className = "badges";
          const labels = Array.isArray(model.badges) ? model.badges : [];
          labels.forEach((label) => {
            const badge = createBadge(label);
            if (badge) badges.appendChild(badge);
          });
          if (badges.childNodes.length) row.appendChild(badges);

          list.appendChild(row);
        });

        app.appendChild(list);
      }

      function renderMedia(data) {
        const items = pickItems(data);
        const prompt = data?.prompt || items.find((item) => item.prompt)?.prompt;
        renderPrompt(prompt);

        const settings = data?.settings || {};
        appendBadges([
          settings.model || data?.model || items.find((item) => item.model)?.model,
          settings.aspectRatio || settings.aspect_ratio,
          settings.quality || settings.resolution,
          settings.count ? String(settings.count) + " item" + (settings.count === 1 ? "" : "s") : items.length ? String(items.length) + " item" + (items.length === 1 ? "" : "s") : "",
          data?.status,
        ]);

        if (!items.length) {
          renderEmpty("No media returned.");
          return;
        }

        const grid = document.createElement("section");
        grid.className = items.length > 1 ? "grid multi" : "grid";
        items.forEach((item) => grid.appendChild(renderCard(item)));
        app.appendChild(grid);
      }

      function renderCard(item) {
        const card = document.createElement("article");
        card.className = "card";
        const kind = compact(item.kind || "image").toLowerCase();
        const mediaUrl = item.mediaUrl || item.thumbnailUrl;

        if (mediaUrl && !isWorking(item.status)) {
          if (kind === "video") {
            const video = document.createElement("video");
            video.className = "media video";
            video.src = mediaUrl;
            video.controls = true;
            video.playsInline = true;
            card.appendChild(video);
          } else if (kind === "audio") {
            const audioWrap = document.createElement("div");
            audioWrap.className = "placeholder audio";
            const audio = document.createElement("audio");
            audio.src = mediaUrl;
            audio.controls = true;
            audioWrap.appendChild(audio);
            card.appendChild(audioWrap);
          } else {
            const img = document.createElement("img");
            img.className = "media";
            img.src = mediaUrl;
            img.alt = compact(item.prompt) || "Generated media";
            card.appendChild(img);
          }
        } else {
          const placeholder = document.createElement("div");
          placeholder.className = "placeholder " + (kind === "video" || kind === "audio" ? kind : "");
          placeholder.textContent = item.error ? "Failed" : statusLabel(item.status || "generating");
          card.appendChild(placeholder);
        }

        if (item.downloadUrl && !isWorking(item.status)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "download";
          button.title = "Download";
          button.setAttribute("aria-label", "Download");
          button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';
          button.onclick = () => openDownload(item.downloadUrl);
          card.appendChild(button);
        }

        const caption = document.createElement("div");
        caption.className = "caption";
        const left = document.createElement("span");
        left.textContent = item.error || item.model || item.id || kind;
        const right = document.createElement("span");
        right.textContent = statusLabel(item.status || (item.mediaUrl ? "completed" : "pending"));
        caption.append(left, right);
        card.appendChild(caption);

        return card;
      }

      function renderEmpty(message) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = message;
        app.appendChild(empty);
      }

      function openDownload(url) {
        if (window.openai?.openExternal) {
          window.openai.openExternal({ href: url, redirectUrl: false });
          return;
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = "";
        a.target = "_blank";
        a.rel = "noreferrer";
        a.click();
      }

      function notifyHeight() {
        window.openai?.notifyIntrinsicHeight?.(document.documentElement.scrollHeight);
      }

      function escapeHtml(value) {
        return text(value).replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char]);
      }

      function render(data) {
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
        app.replaceChildren();
        if (!data || typeof data !== "object") {
          renderEmpty("No output returned.");
          notifyHeight();
          return;
        }
        if (Array.isArray(data.models)) {
          renderModels(data);
        } else {
          renderMedia(data);
          schedulePoll(data);
        }
        requestAnimationFrame(notifyHeight);
      }

      function findStructuredContent(value) {
        if (!value || typeof value !== "object") return null;
        if (value.structuredContent && typeof value.structuredContent === "object") return value.structuredContent;
        if (value.mcp_tool_result?.structuredContent && typeof value.mcp_tool_result.structuredContent === "object") return value.mcp_tool_result.structuredContent;
        if (value.call_tool_result?.structuredContent && typeof value.call_tool_result.structuredContent === "object") return value.call_tool_result.structuredContent;
        return null;
      }

      function getInitialOutput() {
        return window.openai?.toolOutput
          || findStructuredContent(window.openai?.toolResponseMetadata)
          || findStructuredContent(window.openai?.toolResponseMetadata?.mcp_tool_result)
          || findStructuredContent(window.openai?.toolResponseMetadata?.call_tool_result)
          || null;
      }

      async function pollGeneration(generationId) {
        if (!generationId || !window.openai?.callTool) return;
        try {
          const response = await window.openai.callTool("get_generation", { generationId });
          const next = response?.structuredContent || findStructuredContent(response);
          if (next) render(next);
        } catch {
          pollTimer = null;
        }
      }

      function schedulePoll(data) {
        const item = pickItems(data).find((entry) => isWorking(entry.status) && entry.generationId);
        if (!item || !window.openai?.callTool || pollAttempts > 18) return;
        pollAttempts += 1;
        const delay = Math.min(10000, 1600 + pollAttempts * 800);
        pollTimer = setTimeout(() => pollGeneration(item.generationId), delay);
      }

      try {
        render(getInitialOutput());
      } catch (error) {
        app.replaceChildren();
        renderEmpty("Unable to render output.");
        requestAnimationFrame(notifyHeight);
      }

      window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return;
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;
        if (message.method === "ui/notifications/tool-result") {
          pollAttempts = 0;
          render(message.params?.structuredContent || findStructuredContent(message.params));
        }
      }, { passive: true });

      window.addEventListener("openai:set_globals", (event) => {
        const globals = event.detail?.globals;
        const data = globals?.toolOutput || findStructuredContent(globals?.toolResponseMetadata) || getInitialOutput();
        if (data) render(data);
      }, { passive: true });
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
          resourceDomains: [
            "https://*.supabase.co",
            "https://replicate.delivery",
            "https://fal.media",
          ],
        },
      },
      "openai/widgetDescription":
        "Minimal UniCan media output with prompt, settings badges, generated media, status states, and download controls.",
      "openai/widgetPrefersBorder": true,
      "openai/widgetCSP": {
        connect_domains: [],
        resource_domains: [
          "https://*.supabase.co",
          "https://replicate.delivery",
          "https://fal.media",
        ],
        redirect_domains: [
          "https://*.supabase.co",
          "https://replicate.delivery",
          "https://fal.media",
        ],
      },
    },
  }
}
