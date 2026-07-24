import assert from "node:assert/strict"

import {
  computeContactSheetLayout,
  computePanelRects,
  simplifyAspectRatio,
} from "@/lib/carousel-shots/contact-sheet"
import { CAROUSEL_PANEL_ASPECT_RATIOS, CAROUSEL_GRID_SIZES } from "@/lib/carousel-shots/constants"

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

for (const gridSize of CAROUSEL_GRID_SIZES) {
  for (const aspectRatio of CAROUSEL_PANEL_ASPECT_RATIOS) {
    runTest(`layout for ${gridSize} shots at ${aspectRatio}`, () => {
      const layout = computeContactSheetLayout({ gridSize, panelAspectRatio: aspectRatio })
      assert.equal(layout.cols, gridSize === 4 ? 2 : 3)
      assert.equal(layout.rows, gridSize === 4 ? 2 : 3)
      assert.ok(layout.sheetWidth > layout.panelWidth)
      assert.ok(layout.sheetHeight > layout.panelHeight)
      assert.equal(layout.aspectRatio, simplifyAspectRatio(layout.sheetWidth, layout.sheetHeight))
      const rects = computePanelRects(layout.sheetWidth, layout.sheetHeight, layout.cols, layout.rows)
      assert.equal(rects.length, gridSize)
    })
  }
}
