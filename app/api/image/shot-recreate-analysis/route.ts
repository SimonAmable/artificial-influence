import { generateObject } from "ai"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  AI_GATEWAY_CONFIG_ERROR,
  createAIGatewayProvider,
  hasAIGatewayCredentials,
} from "@/lib/ai/gateway"
import { validateExternalReferenceUrl } from "@/lib/server/external-reference-url"
import { createClient } from "@/lib/supabase/server"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const shotAnalysisSchema = z.object({
  summary: z.string(),
  location_named_place_and_geography: z.string(),
  location_setting_type: z.string(),
  location_spatial_layout_from_camera: z.string(),
  location_architecture_and_surfaces: z.string(),
  location_fixed_objects_and_furniture: z.string(),
  location_background_and_distance: z.string(),
  location_foreground_and_near_plane: z.string(),
  location_materials_colors_and_textures: z.string(),
  activity_and_story: z.string(),
  subject_pose: z.string(),
  hands_and_gestures: z.string(),
  head_direction_and_gaze: z.string(),
  facial_expression: z.string(),
  wardrobe: z.string(),
  accessories: z.string(),
  hair_styling: z.string(),
  makeup_and_grooming: z.string(),
  props_and_products: z.string(),
  text_signage_and_logos: z.string(),
  recognizable_names: z.string(),
  camera_and_lens: z.string(),
  composition_and_framing: z.string(),
  lighting: z.string(),
  color_grade_and_aesthetic: z.string(),
  mood_and_energy: z.string(),
  technical_notes: z.string(),
})

const SHOT_RECREATE_ANALYSIS_INSTRUCTIONS = [
  "Analyze this image as an exhaustively detailed, reusable social-media shot recipe for image generation.",
  "LOCATION IS THE TOP PRIORITY. Do not summarize the place in broad strokes. Never write vague placeholders such as 'urban street', 'cozy cafe', 'nice restaurant', 'bedroom', or 'city background' without immediately unpacking them into concrete, verifiable visual facts.",
  "For location, describe the exact setting type, named place or geography when visible or strongly inferable, and every architectural and environmental detail: walls, floors, ceilings, windows, doors, counters, streets, sidewalks, vehicles, vegetation, signage, skyline, weather, and time-of-day cues.",
  "In location_spatial_layout_from_camera, describe the full scene layout strictly from the camera/viewer point of view using image-left, image-right, center, top, bottom, foreground, midground, and background. State where each major object sits in the frame (e.g. left third, upper right, centered behind subject). Include distances and depth ordering. If the photo is a mirror selfie or reflection, separate what is direct view versus reflected and where the mirror edge sits.",
  "Preserve the exact left-to-right arrangement of the scene as seen in the image. Do not mirror, flip, reverse, or symmetrically reinterpret the layout.",
  "Capture everything else that defines the shot: activity, exact full-body pose, hand and finger placement, head angle, gaze, expression, wardrobe layers, fabrics, fits, colors, patterns, jewelry, bags, shoes, props, food, and every object.",
  "Include all readable text, signage, packaging, labels, logos, and any recognizable proper nouns such as brand names, product names, venue names, store names, city or neighborhood names, sports teams, events, or other named entities when they appear in the scene itself.",
  "Be extremely specific and concrete in every field. Use precise materials, colors, counts, shapes, and spatial relationships.",
  "Do not describe or identify the person's facial identity, ethnicity, age estimate, or unique biometric features.",
  "Completely ignore and omit watermarks, username handles, platform UI, screenshot chrome, repost borders, TikTok/Instagram/Reels/YouTube overlays, subtitles or captions added by an app, notification badges, progress bars, play buttons, and other screen-recording or social-platform interface elements unless they are physically part of the real-world scene (e.g. a printed poster, not a floating app overlay).",
].join(" ")

const SHOT_RECREATE_ANALYSIS_MODEL = "google/gemini-2.5-flash" as const

export async function POST(request: NextRequest) {
  try {
    if (!hasAIGatewayCredentials()) {
      return NextResponse.json({ error: AI_GATEWAY_CONFIG_ERROR }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const referenceFile = formData.get("reference")
    const referenceUrlValue = formData.get("referenceUrl")
    const referenceUrl =
      typeof referenceUrlValue === "string" ? referenceUrlValue.trim() : ""

    let imagePart:
      | { type: "image"; image: Uint8Array; mediaType: string }
      | { type: "image"; image: URL }

    if (referenceFile instanceof File) {
      if (!referenceFile.type.startsWith("image/")) {
        return NextResponse.json({ error: "Reference must be an image" }, { status: 400 })
      }
      if (referenceFile.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Reference image is too large" }, { status: 413 })
      }
      imagePart = {
        type: "image",
        image: new Uint8Array(await referenceFile.arrayBuffer()),
        mediaType: referenceFile.type,
      }
    } else if (referenceUrl) {
      const safeUrl = await validateExternalReferenceUrl({
        url: referenceUrl,
        expectedKind: "image",
        maxContentLengthBytes: MAX_IMAGE_BYTES,
      })
      imagePart = { type: "image", image: new URL(safeUrl) }
    } else {
      return NextResponse.json({ error: "Reference shot is required" }, { status: 400 })
    }

    const gateway = createAIGatewayProvider()
    const { object } = await generateObject({
      model: gateway(SHOT_RECREATE_ANALYSIS_MODEL),
      schema: shotAnalysisSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: SHOT_RECREATE_ANALYSIS_INSTRUCTIONS,
            },
            imagePart,
          ],
        },
      ],
    })

    return NextResponse.json({ shotRecipe: object })
  } catch (error) {
    console.error("[shot-recreate-analysis] Failed:", error)
    return NextResponse.json(
      { error: "Could not analyze this shot. Please try again." },
      { status: 500 },
    )
  }
}
