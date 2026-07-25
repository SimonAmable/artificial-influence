export const OPEN_GLOBAL_SEARCH_EVENT = "presence:open-global-search"

export type OpenGlobalSearchDetail = {
  /** Optional initial query when the dialog opens. */
  query?: string
}

export function openGlobalSearch(detail?: OpenGlobalSearchDetail) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<OpenGlobalSearchDetail>(OPEN_GLOBAL_SEARCH_EVENT, {
      detail: detail ?? {},
    }),
  )
}
