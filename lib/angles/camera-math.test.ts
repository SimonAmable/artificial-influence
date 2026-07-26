import assert from "node:assert/strict"

const { angleStateToCameraPosition, normalizeAngleState, wrapDegrees, zoomToOrbitRadius } =
  await import(new URL("./camera-math.ts", import.meta.url).href)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("rotation wraps cleanly in both directions", () => {
  assert.equal(wrapDegrees(360), 0)
  assert.equal(wrapDegrees(-45), 315)
})

runTest("angle state clamps tilt and zoom", () => {
  assert.deepEqual(normalizeAngleState({ rotation: 721, tilt: 140, zoom: -4 }), {
    rotation: 1,
    tilt: 90,
    zoom: 0,
  })
})

runTest("zoom moves the mock camera closer to the image", () => {
  const wide = angleStateToCameraPosition({ rotation: 0, tilt: 0, zoom: 0 })
  const close = angleStateToCameraPosition({ rotation: 0, tilt: 0, zoom: 10 })
  assert.ok(Math.hypot(close.x, close.y, close.z) < Math.hypot(wide.x, wide.y, wide.z))
})

runTest("camera distance matches the shared globe radius", () => {
  const options = { minRadius: 1, maxRadius: 1.65 }
  const state = { rotation: 137, tilt: 18, zoom: 7 }
  const position = angleStateToCameraPosition(state, options)
  const cameraDistance = Math.hypot(position.x, position.y, position.z)
  const globeRadius = zoomToOrbitRadius(state.zoom, options)

  assert.ok(Math.abs(cameraDistance - globeRadius) < 0.000001)
})
