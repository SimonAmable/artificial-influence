export function buildViralClonerImagePrompt(): string {
  return [
    "Identity transfer onto the target scene.",
    "The target image owns pose, facial expression, clothing, camera, framing, environment, and lighting.",
    "The character reference owns identity, face, head, hair, skin tone, and natural appearance only.",
    "Do not copy watermarks, usernames, or logos from the source.",
  ].join(" ")
}

export function buildViralClonerGenjutsuEdit(): string {
  return "Keep the character's natural appearance. Motion, expression, camera, clothing, background, and lighting come only from the source video."
}