import assert from "node:assert/strict"
import { quoteViralCloneSelection, resolveGenjutsuBillableSeconds } from "./pricing.ts"

const video = resolveGenjutsuBillableSeconds(12, null)
assert.equal(video, 12)

assert.throws(() => resolveGenjutsuBillableSeconds(20, null))

const quote = quoteViralCloneSelection({
  items: [
    { index: 0, kind: "image", durationSeconds: null },
    { index: 1, kind: "video", durationSeconds: 5 },
  ],
  selectedIndexes: [0, 1],
  trims: {},
  includeImportFee: true,
})

assert.equal(quote.itemCredits, 4 + 5 * 8)
assert.equal(quote.importCredit, 1)
assert.equal(quote.totalCredits, quote.itemCredits + 1)

console.log("viral cloner pricing tests passed")