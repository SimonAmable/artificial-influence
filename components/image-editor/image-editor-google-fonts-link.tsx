"use client"

import * as React from "react"
import { getImageEditorGoogleFontsStylesheetHref } from "@/lib/image-editor/editor-font-options"

const SHEET_LINK_ID = "image-editor-google-fonts"

/**
 * Injects the combined Google Fonts stylesheet once for Fabric canvas text (and picker previews).
 */
export function ImageEditorGoogleFontsLink() {
  React.useInsertionEffect(() => {
    if (typeof document === "undefined") return
    if (document.getElementById(SHEET_LINK_ID)) return

    const link = document.createElement("link")
    link.id = SHEET_LINK_ID
    link.rel = "stylesheet"
    link.href = getImageEditorGoogleFontsStylesheetHref()

    document.head.appendChild(link)
  }, [])

  return null
}
