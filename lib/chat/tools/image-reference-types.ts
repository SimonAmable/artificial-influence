export interface ChatImageReference {
  filename?: string
  mediaType?: string
  url: string
}

export interface AvailableChatImageReference extends ChatImageReference {
  id: string
  label: string
  source: "user-upload" | "generated"
}
