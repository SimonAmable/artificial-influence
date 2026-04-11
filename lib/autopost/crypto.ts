import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

function getKeyMaterial() {
  const rawKey = process.env.AUTOPOST_TOKEN_ENCRYPTION_KEY
  if (!rawKey) {
    throw new Error("AUTOPOST_TOKEN_ENCRYPTION_KEY is not configured.")
  }

  return createHash("sha256").update(rawKey).digest()
}

export function encryptAutopostToken(value: string): string {
  const iv = randomBytes(12)
  const key = getKeyMaterial()
  const cipher = createCipheriv("aes-256-gcm", key, iv)

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`
}

export function decryptAutopostToken(value: string): string {
  const [ivPart, authTagPart, encryptedPart] = value.split(".")

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Invalid encrypted token format.")
  }

  const key = getKeyMaterial()
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"))
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
