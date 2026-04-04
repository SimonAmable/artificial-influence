"use client"

export function extractClipboardImageFiles(
  items?: DataTransferItemList | null,
): File[] {
  if (!items) return []

  const files: File[] = []

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue

    const file = item.getAsFile()
    if (file) {
      files.push(file)
    }
  }

  return files
}

export function appendFilesToFileList(
  currentFiles: FileList | File[] | null | undefined,
  nextFiles: File[],
): FileList | undefined {
  const mergedFiles = [...(currentFiles ? Array.from(currentFiles) : []), ...nextFiles]
  if (mergedFiles.length === 0) return undefined

  const dataTransfer = new DataTransfer()
  mergedFiles.forEach((file) => dataTransfer.items.add(file))
  return dataTransfer.files
}
