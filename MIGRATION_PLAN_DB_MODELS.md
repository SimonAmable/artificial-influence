# Migration Plan: DB Models for Video & Canvas Nodes

Migrate video components and canvas nodes to pull model data from the database (via `/api/models`) instead of `model-metadata.ts` and `image-models.ts`. Image page is already migrated.

**Goals:** Minimal code, single source of truth, no fallbacks after migration.

---

## Phase 1: Video Components

### 1.1 Video Model Parameters — Single Function (Refactor, Don't Duplicate)

**File:** `lib/utils/video-model-parameters.ts`

- **Refactor** `buildVideoModelParameters` to accept a minimal shape both `Model` and `ModelMetadata` satisfy:
  ```ts
  interface VideoParamsInput {
    identifier: string
    supports_first_frame?: boolean
    supports_last_frame?: boolean
    parameters?: { parameters?: ParameterDefinition[] }
  }
  ```
- Base params: `input.parameters?.parameters ?? getModelParameters(input.identifier)`
- Add first_frame, last_frame, negative_prompt if missing and flags set
- Remove `ModelMetadata` import; use `Model` from `@/lib/types/models`
- **One function** — no `buildVideoModelParametersFromModel` duplicate

### 1.2 VideoModelParameterControls — Require `videoModels`, Remove Fallback

**File:** `components/tools/video/video-model-parameter-controls.tsx`

- Add **required** prop: `videoModels: Model[]` (no optional, no fallback)
- Remove `getActiveModelMetadata`, `ModelMetadata` imports
- `modelMap` = `new Map(videoModels.map(m => [m.identifier, m]))`
- For each model, ensure params: `parameters: { parameters: buildVideoModelParameters(m) }` (in case DB has incomplete params)
- Simpler: no conversion logic, no metadata

### 1.3 VideoInputBox — Pass-Through Only

**File:** `components/tools/video/video-input-box.tsx`

- Add `videoModels: Model[]` prop, pass to `VideoModelParameterControls`

### 1.4 Video Page

**File:** `app/video/page.tsx`

- `useModels('video')` → `{ models: videoModels, isLoading }`
- Remove `getActiveModelMetadata`, `getModelMetadataByIdentifier`, `convertMetadataToModel`
- `selectedModel` = `videoModels[0]` when loaded; `handleModelChange(id)` = `videoModels.find(m => m.identifier === id)`
- Pass `videoModels` to `VideoInputBox`
- Loading state while `modelsLoading`

---

## Phase 2: Canvas Nodes

### 2.1 useModels Cache — Avoid Duplicate Fetches

**File:** `hooks/use-models.ts`

- Add module-level cache: `Map<ModelType | undefined, { models, timestamp }>`
- On fetch success: cache by type; return cached if < 5 min old
- Ensures multiple nodes (e.g. 2 video-gen nodes) share one fetch — no context needed

### 2.2 Video Gen Node

**File:** `components/canvas/nodes/video-gen-node.tsx`

- `useModels('video')` → `videoModels`
- Replace `getModelMetadataByIdentifier(identifier) || getActiveModelMetadata("video")[0]` with `videoModels.find(m => m.identifier === identifier) ?? videoModels[0]`
- Remove metadata imports
- Pass `videoModels` to `VideoModelParameterControls`

### 2.3 Image Gen Node

**File:** `components/canvas/nodes/image-gen-node.tsx`

- `useModels('image')` → `imageModels`
- Replace `AVAILABLE_IMAGE_MODELS` / `getImageModel` with `imageModels`
- Use DB shape directly: `model.aspect_ratios`, `model.default_aspect_ratio` (no adapter)

---

## Phase 3: Cleanup

- Delete `lib/canvas/image-models.ts`
- Remove unused exports from `model-metadata.ts` (or delete file if no remaining consumers)

---

## File Summary

| File | Action |
|------|--------|
| `lib/utils/video-model-parameters.ts` | Refactor to accept Model-compatible input; remove metadata dep |
| `hooks/use-models.ts` | Add cache by type to dedupe fetches |
| `components/tools/video/video-model-parameter-controls.tsx` | Require `videoModels`, remove metadata |
| `components/tools/video/video-input-box.tsx` | Add `videoModels` prop, pass through |
| `app/video/page.tsx` | useModels, remove metadata, pass videoModels |
| `components/canvas/nodes/video-gen-node.tsx` | useModels, remove metadata |
| `components/canvas/nodes/image-gen-node.tsx` | useModels, remove image-models; use DB shape |
| `lib/canvas/image-models.ts` | Delete |
| `lib/constants/model-metadata.ts` | Remove migrated exports / delete |

---

## Order of Execution

1. **video-model-parameters.ts** — Refactor to accept Model-compatible input
2. **use-models.ts** — Add cache
3. **VideoModelParameterControls** — Require videoModels, remove metadata
4. **VideoInputBox** — Add videoModels prop
5. **Video page** — useModels, wire
6. **video-gen-node** — useModels, remove metadata
7. **image-gen-node** — useModels, remove image-models
8. **Cleanup** — Delete image-models.ts, trim model-metadata.ts
