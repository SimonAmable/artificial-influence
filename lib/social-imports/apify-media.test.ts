import assert from "node:assert/strict"
import { urlsToMediaItems } from "./adapters/apify-media.ts"

const media = urlsToMediaItems([
  "https://media.redgifs.com/Example.mp4",
  "https://pbs.twimg.com/media/abc.jpg",
  "https://i.pinimg.com/originals/foo.jpg",
])
assert.equal(media.length, 3)
assert.equal(media[0]?.kind, "video")
assert.equal(media[1]?.kind, "image")
assert.ok(media[1]?.remoteUrl.includes("name=orig"))

console.log("apify-media tests passed")