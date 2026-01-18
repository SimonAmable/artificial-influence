/**
 * Maps model identifiers to their corresponding icon paths in public/ai_icons
 */
export function getModelIconPath(identifier: string): string | null {
  // Extract the provider/prefix from identifier (e.g., "google/nano-banana" -> "google")
  const prefix = identifier.split('/')[0]?.toLowerCase()
  
  switch (prefix) {
    case 'prunaai':
      // Pruna models map to Flux icon
      return '/ai_icons/flux.svg'
    case 'google':
      return '/ai_icons/gemini-color.svg'
    case 'openai':
      return '/ai_icons/openai.svg'
    case 'bytedance':
      return '/ai_icons/bytedance-color.svg'
    default:
      return null
  }
}
