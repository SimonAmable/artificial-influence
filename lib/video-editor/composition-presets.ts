/** Common output sizes, width x height in pixels. */
export const COMPOSITION_ASPECT_PRESETS = [
  { id: "9:16-1080", label: "9:16 - 1080x1920", width: 1080, height: 1920 },
  { id: "16:9-1080", label: "16:9 - 1920x1080", width: 1920, height: 1080 },
  { id: "16:9-720", label: "16:9 - 1280x720", width: 1280, height: 720 },
  { id: "1:1-1080", label: "1:1 - 1080x1080", width: 1080, height: 1080 },
  { id: "4:3-1440", label: "4:3 - 1440x1080", width: 1440, height: 1080 },
  { id: "21:9-2560", label: "21:9 - 2560x1080", width: 2560, height: 1080 },
] as const
