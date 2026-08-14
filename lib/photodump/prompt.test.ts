import assert from "node:assert/strict"

import { getPhotodumpShotBriefs } from "@/lib/photodump/packs"
import { buildPhotodumpShotPrompt } from "@/lib/photodump/prompt"

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("pack shot briefs respect shot count", () => {
  const briefs = getPhotodumpShotBriefs(
    {
      id: "test",
      name: "Test",
      description: "Test",
      styleLine: "Cool girl dump aesthetic",
      fallbackClassName: "from-pink-200 to-rose-200",
    },
    6,
  )
  assert.equal(briefs.length, 6)
  assert.match(briefs[0]!, /Cool girl dump aesthetic/)
})

runTest("shot prompt preserves identity lock language", () => {
  const prompt = buildPhotodumpShotPrompt({
    shotBrief: "Golden hour street walk.",
    shotIndex: 0,
    shotCount: 12,
    usesAestheticReferences: true,
  })
  assert.match(prompt, /shot 1 of 12/)
  assert.match(prompt, /Preserve the same person identity/)
  assert.match(prompt, /aesthetic reference images/)
})
