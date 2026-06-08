import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createSlideshowCollection,
  listSlideshowCollections,
} from "@/lib/slideshow/database-server"
import { createSlideshowCollectionSchema } from "@/lib/slideshow/types"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ collections: await listSlideshowCollections(supabase, user.id) })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = createSlideshowCollectionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  return NextResponse.json({ collection: await createSlideshowCollection(supabase, user.id, parsed.data) })
}

