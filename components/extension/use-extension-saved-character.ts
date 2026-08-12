"use client"

import * as React from "react"

import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import type { AssetRecord } from "@/lib/assets/types"
import { getCharacterAssetPreviewUrl } from "@/lib/extension/character-asset"
import {
  imageUploadToSavedCharacter,
  loadSavedExtensionCharacter,
  persistSavedExtensionCharacter,
  savedCharacterToImageUpload,
  type SavedExtensionCharacter,
} from "@/lib/extension/saved-character-storage"

type CharacterMeta = {
  assetId?: string | null
  title?: string | null
}

export function useExtensionSavedCharacter() {
  const [characterImage, setCharacterImageState] = React.useState<ImageUpload | null>(null)
  const [characterMeta, setCharacterMeta] = React.useState<CharacterMeta>({})
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    void loadSavedExtensionCharacter().then((saved) => {
      if (cancelled) return

      if (saved) {
        setCharacterImageState(savedCharacterToImageUpload(saved))
        setCharacterMeta({
          assetId: saved.assetId ?? null,
          title: saved.title ?? null,
        })
      }

      setIsHydrated(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const persistCharacter = React.useCallback(async (image: ImageUpload | null, meta: CharacterMeta) => {
    const payload = imageUploadToSavedCharacter(image, meta)
    await persistSavedExtensionCharacter(payload)
  }, [])

  const clearCharacter = React.useCallback(() => {
    setCharacterImageState(null)
    setCharacterMeta({})
    void persistSavedExtensionCharacter(null)
  }, [])

  const selectCharacterAsset = React.useCallback(
    (asset: AssetRecord) => {
      const previewUrl = getCharacterAssetPreviewUrl(asset)
      const meta: CharacterMeta = {
        assetId: asset.id,
        title: asset.title,
      }

      setCharacterMeta(meta)
      setCharacterImageState({ url: previewUrl })
      void persistCharacter({ url: previewUrl }, meta)
    },
    [persistCharacter],
  )

  const uploadCharacterImage = React.useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    setCharacterImageState({ file, url })
    setCharacterMeta({ assetId: null, title: null })
  }, [])

  const isUploadOnly = Boolean(characterImage?.url && !characterMeta.assetId)

  return {
    characterImage,
    characterMeta,
    characterAssetId: characterMeta.assetId ?? null,
    characterUploadUrl: isUploadOnly ? characterImage?.url ?? null : null,
    isHydrated,
    clearCharacter,
    selectCharacterAsset,
    uploadCharacterImage,
  }
}

export type { SavedExtensionCharacter }
