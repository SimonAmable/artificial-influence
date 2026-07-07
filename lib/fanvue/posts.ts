import { fanvueApiRequest } from "@/lib/fanvue/client"

export type FanvuePostAudience = "subscribers" | "followers-and-subscribers"

export type CreateFanvuePostInput = {
  text?: string | null
  mediaUuids?: string[]
  mediaPreviewUuid?: string | null
  price?: number | null
  audience: FanvuePostAudience
  publishAt?: string | null
}

export type FanvuePostResult = {
  uuid: string
  createdAt?: string | null
  publishedAt?: string | null
  publishAt?: string | null
}

type CreatePostResponse = {
  uuid?: string
  createdAt?: string | null
  publishedAt?: string | null
  publishAt?: string | null
}

export async function createFanvuePost(
  accessToken: string,
  input: CreateFanvuePostInput
): Promise<FanvuePostResult> {
  const body: Record<string, unknown> = {
    audience: input.audience,
  }

  if (input.text?.trim()) {
    body.text = input.text.trim()
  }
  if (input.mediaUuids?.length) {
    body.mediaUuids = input.mediaUuids
  }
  if (input.mediaPreviewUuid) {
    body.mediaPreviewUuid = input.mediaPreviewUuid
  }
  if (typeof input.price === "number" && input.price >= 300) {
    body.price = input.price
  }
  if (input.publishAt) {
    body.publishAt = input.publishAt
  }

  const response = await fanvueApiRequest<CreatePostResponse>({
    accessToken,
    method: "POST",
    path: "/posts",
    body,
  })

  if (!response.uuid) {
    throw new Error("Fanvue post created without a UUID.")
  }

  return {
    uuid: response.uuid,
    createdAt: response.createdAt ?? null,
    publishedAt: response.publishedAt ?? null,
    publishAt: response.publishAt ?? null,
  }
}
