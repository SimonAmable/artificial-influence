import { fanvueApiRequest } from "@/lib/fanvue/client"

export type FanvueUserProfile = {
  uuid?: string
  handle?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

type FanvueUsersMeResponse = {
  uuid?: string
  handle?: string | null
  displayName?: string | null
  display_name?: string | null
  avatarUrl?: string | null
  avatar_url?: string | null
  profilePictureUrl?: string | null
  profile_picture_url?: string | null
}

export async function fetchFanvueUserProfile(accessToken: string): Promise<FanvueUserProfile> {
  const data = await fanvueApiRequest<FanvueUsersMeResponse>({
    accessToken,
    path: "/users/me",
  })

  return {
    uuid: data.uuid,
    handle: data.handle ?? null,
    displayName: data.displayName ?? data.display_name ?? null,
    avatarUrl: data.avatarUrl ?? data.avatar_url ?? data.profilePictureUrl ?? data.profile_picture_url ?? null,
  }
}
