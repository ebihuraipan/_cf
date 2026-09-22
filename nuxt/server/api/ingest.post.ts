import { chunkText } from '../utils/chunk'

interface IngestBody {
  text: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<IngestBody>(event)

  if (!body?.text || typeof body.text !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'text is required' })
  }

  const env = event.context.cloudflare.env
  const chunks = chunkText(body.text)

  if (chunks.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'text produced no chunks' })
  }

  const embeddings = await env.AI.run('@cf/baai/bge-m3', {
    text: chunks
  })

  const vectors = chunks.map((chunk, i) => ({
    id: crypto.randomUUID(),
    values: embeddings.data[i],
    metadata: { text: chunk }
  }))

  await env.VECTORIZE.insert(vectors)

  return {
    inserted: vectors.length,
    ids: vectors.map(v => v.id)
  }
})
