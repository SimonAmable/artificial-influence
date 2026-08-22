import assert from "node:assert/strict"
import test from "node:test"

import {
  appendCharacterSwapVisionHints,
  type CharacterSwapVisionHints,
} from "./character-swap-analysis.ts"

test("appendCharacterSwapVisionHints keeps canonical prompt and adds vision hints", () => {
  const canonical = "Character swap task using two reference images."
  const hints: CharacterSwapVisionHints = {
    character_preservation: "Red jacket, blonde ponytail, white sneakers.",
    scene_pose: "Arms crossed, slight smirk, outdoor cafe, afternoon sun from left.",
    integration_hint: "Match warm sunlight on the jacket and cast a soft contact shadow on the table.",
  }

  const result = appendCharacterSwapVisionHints(canonical, hints)

  assert.ok(result.startsWith(canonical))
  assert.match(result, /Vision-guided swap hints:/)
  assert.match(result, /Red jacket/)
  assert.match(result, /outdoor cafe/)
  assert.match(result, /contact shadow/)
})
