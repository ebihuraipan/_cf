const CHUNK_SIZE = 500

export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []

  for (const paragraph of paragraphs) {
    for (let i = 0; i < paragraph.length; i += CHUNK_SIZE) {
      chunks.push(paragraph.slice(i, i + CHUNK_SIZE))
    }
  }

  return chunks
}
