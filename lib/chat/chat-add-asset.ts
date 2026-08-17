export const CHAT_ADD_ASSET_EVENT = "chat-add-asset"
export const CHAT_REMOVE_ASSET_EVENT = "chat-remove-asset"

export type ChatAssetType = "image" | "video" | "audio"

export type ChatAddAssetDetail = {
  url: string
  type: ChatAssetType
}

export function dispatchChatAddAsset(url: string, type: ChatAssetType) {
  if (typeof window === "undefined" || !url) return
  window.dispatchEvent(
    new CustomEvent<ChatAddAssetDetail>(CHAT_ADD_ASSET_EVENT, {
      detail: { url, type },
    }),
  )
  window.dispatchEvent(new CustomEvent("chat-open"))
}

export function dispatchChatRemoveAsset(url: string) {
  if (typeof window === "undefined" || !url) return
  window.dispatchEvent(
    new CustomEvent<{ url: string }>(CHAT_REMOVE_ASSET_EVENT, {
      detail: { url },
    }),
  )
}
