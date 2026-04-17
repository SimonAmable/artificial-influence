/** Common output sizes — width × height in pixels. */
export const COMPOSITION_ASPECT_PRESETS = [
  { id: "16:9-1080", label: "16:9 · 1920×1080", width: 1920, height: 1080 },
  { id: "16:9-720", label: "16:9 · 1280×720", width: 1280, height: 720 },
  { id: "9:16-1080", label: "9:16 · 1080×1920", width: 1080, height: 1920 },
  { id: "1:1-1080", label: "1:1 · 1080×1080", width: 1080, height: 1080 },
  { id: "4:3-1440", label: "4:3 · 1440×1080", width: 1440, height: 1080 },
  { id: "21:9-2560", label: "21:9 · 2560×1080", width: 2560, height: 1080 },
] as const
