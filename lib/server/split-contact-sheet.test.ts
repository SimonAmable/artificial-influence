import assert from "node:assert/strict"
import sharp from "sharp"

import { centerCropRect } from "@/lib/carousel-shots/contact-sheet"
import { splitContactSheet } from "@/lib/carousel-shots/split-panels"

async function createSyntheticGrid(
  cols: number,
  rows: number,
  panelWidth: number,
  panelHeight: number,
  gutter: number,
) {
  const width = cols * panelWidth + (cols - 1) * gutter
  const height = rows * panelHeight + (rows - 1) * gutter
  const background = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer()

  const composites: sharp.OverlayOptions[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const color = (row * cols + col) % 2 === 0 ? 200 : 80
      const panel = await sharp({
        create: {
          width: panelWidth,
          height: panelHeight,
          channels: 3,
          background: { r: color, g: color, b: color },
        },
      })
        .png()
        .toBuffer()
      composites.push({
        input: panel,
        left: col * (panelWidth + gutter),
        top: row * (panelHeight + gutter),
      })
    }
  }

  return sharp(background).composite(composites).png().toBuffer()
}

function aspectRatioMatches(width: number, height: number, target: string, tolerance = 0.02) {
  const [targetW, targetH] = target.split(":").map(Number)
  const actual = width / height
  const expected = targetW! / targetH!
  return Math.abs(actual - expected) <= tolerance
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

async function main() {
  await runTest("centerCropRect crops wide image to 3:4", async () => {
    const crop = centerCropRect(1200, 900, "3:4")
    assert.equal(crop.width, 675)
    assert.equal(crop.height, 900)
    assert.equal(crop.left, 262)
  })

  await runTest("splitContactSheet extracts a 2x2 grid at 3:4", async () => {
    const buffer = await createSyntheticGrid(2, 2, 300, 400, 12)
    const result = await splitContactSheet(buffer, 4, "3:4", {
      targetPanelWidth: 300,
      targetPanelHeight: 400,
    })
    assert.equal(result.panels.length, 4)

    const meta = await sharp(result.panels[0]!).metadata()
    assert.equal(meta.width, 300)
    assert.equal(meta.height, 400)
    assert.ok(aspectRatioMatches(meta.width!, meta.height!, "3:4"))
  })

  await runTest("splitContactSheet extracts a 3x3 grid at 9:16", async () => {
    const buffer = await createSyntheticGrid(3, 3, 270, 480, 10)
    const result = await splitContactSheet(buffer, 9, "9:16", {
      targetPanelWidth: 270,
      targetPanelHeight: 480,
    })
    assert.equal(result.panels.length, 9)

    const meta = await sharp(result.panels[4]!).metadata()
    assert.equal(meta.width, 270)
    assert.equal(meta.height, 480)
    assert.ok(aspectRatioMatches(meta.width!, meta.height!, "9:16"))
  })
}

void main()
