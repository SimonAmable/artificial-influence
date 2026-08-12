"use client"

import * as React from "react"

import { ExtensionCharacterSelect } from "@/components/extension/extension-character-select"
import { ExtensionPanelShell } from "@/components/extension/extension-panel-shell"
import { useCharacterAssets } from "@/components/extension/use-character-assets"
import { PillToggleGroup } from "@/components/shared/controls/pill-toggle-group"
import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import { GenerateShaderButton } from "@/components/tools/influencer/generate-shader-button"
import { NANO_BANANA_2_META } from "@/lib/constants/model-metadata"

import { useExtensionSavedCharacter } from "./use-extension-saved-character"

const EXTENSION_MODES = [
  { value: "face_swap", label: "Face Swap" },
  { value: "character_swap", label: "Character Swap" },
  { value: "recreate", label: "Recreate" },
] as const

type ExtensionMode = (typeof EXTENSION_MODES)[number]["value"]

const SCENE_PREVIEW: ImageUpload = {
  url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0%25' stop-color='%238b5e3c'/%3E%3Cstop offset='100%25' stop-color='%232a1810'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' fill='url(%23g)'/%3E%3C/svg%3E",
}

type RecreateExtensionPanelProps = {
  className?: string
}

export function RecreateExtensionPanel({ className }: RecreateExtensionPanelProps) {
  const [mode, setMode] = React.useState<ExtensionMode>("face_swap")
  const [sceneImage, setSceneImage] = React.useState<ImageUpload | null>(SCENE_PREVIEW)

  const { characters, loading: charactersLoading, error: charactersError } = useCharacterAssets()
  const {
    characterImage,
    characterAssetId,
    characterUploadUrl,
    isHydrated,
    clearCharacter,
    selectCharacterAsset,
    uploadCharacterImage,
  } = useExtensionSavedCharacter()

  const characterRequired = mode !== "recreate"
  const hasCharacter = Boolean(characterImage?.url)
  const isReady = characterRequired ? Boolean(hasCharacter && sceneImage) : Boolean(sceneImage)

  return (
    <ExtensionPanelShell className={className}>
      <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
        <PillToggleGroup
          aria-label="Extension mode"
          value={mode}
          onValueChange={setMode}
          options={EXTENSION_MODES.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-h-[140px] flex-col justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted p-2">
            <p className="mb-2 px-1 text-[10px] font-bold text-foreground">
              {characterRequired ? "Character" : "Character (optional)"}
            </p>
            {isHydrated ? (
              <ExtensionCharacterSelect
                characters={characters}
                loading={charactersLoading}
                error={charactersError}
                selectedAssetId={characterAssetId}
                selectedUploadUrl={characterUploadUrl}
                optional={!characterRequired}
                onAssetSelect={selectCharacterAsset}
                onUpload={uploadCharacterImage}
                onClear={clearCharacter}
              />
            ) : null}
          </div>

          <PhotoUpload
            value={sceneImage}
            onChange={setSceneImage}
            title={mode === "recreate" ? "Reference Shot" : "Scene"}
            description="Target from web"
            minHeight="min-h-[140px]"
            maxHeight="max-h-[140px]"
            previewFit="cover"
          />
        </div>

        <GenerateShaderButton
          layout="bar"
          isReady={isReady}
          isGenerating={false}
          allowConcurrent={false}
          creditCost={NANO_BANANA_2_META.model_cost}
        />
      </div>
    </ExtensionPanelShell>
  )
}
