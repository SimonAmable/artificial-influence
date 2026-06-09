/**
 * Remotion Snapchat caption reference — tuned values below match the approved Remotion
 * preview. Do not change rendering in remotion-renderer / text-rendering.ts; sync
 * Fabric (image editor) and FFmpeg ASS paths to these constants instead.
 */
export const SNAPCHAT_STYLE_PRESET_ID = "snapchat-classic"

/** Legacy image-editor preset id — normalized to {@link SNAPCHAT_STYLE_PRESET_ID}. */
export const SNAPCHAT_LEGACY_IMAGE_EDITOR_PRESET_ID = "snapchat-bar"

/** Fontconfig / libass family name — must match the OTF installed in the FFmpeg sandbox. */
export const SNAPCHAT_ASS_FONT_NAME = "Public Sans"

export const SNAPCHAT_CSS_FONT_STACK =
  '"Public Sans", Helvetica, Arial, sans-serif'

export const SNAPCHAT_REFERENCE_WIDTH = 1080
export const SNAPCHAT_REFERENCE_FONT_SIZE = 50
export const SNAPCHAT_REFERENCE_FONT_WEIGHT = "200"
export const SNAPCHAT_REFERENCE_LINE_HEIGHT = 1.2
export const SNAPCHAT_REFERENCE_PADDING_Y = 17
export const SNAPCHAT_REFERENCE_PADDING_X = 16

export function snapchatFontSizeForWidth(width) {
  return Math.round((width / SNAPCHAT_REFERENCE_WIDTH) * SNAPCHAT_REFERENCE_FONT_SIZE)
}

export function isSnapchatClassicPreset(stylePresetId) {
  return (
    stylePresetId === SNAPCHAT_STYLE_PRESET_ID ||
    stylePresetId === SNAPCHAT_LEGACY_IMAGE_EDITOR_PRESET_ID
  )
}
