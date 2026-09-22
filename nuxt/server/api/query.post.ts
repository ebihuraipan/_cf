interface QueryBody {
  question: string
  topK?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<QueryBody>(event)

  if (!body?.question || typeof body.question !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'question is required' })
  }

  const topK = body.topK ?? 3
  const env = event.context.cloudflare.env

  const questionEmbedding = await env.AI.run('@cf/baai/bge-m3', {
    text: [body.question]
  })

  const matches = await env.VECTORIZE.query(questionEmbedding.data[0], {
    topK,
    returnMetadata: true
  })

  const contextChunks = matches.matches.map(m => m.metadata?.text as string).filter(Boolean)

  const context = contextChunks.length > 0
    ? contextChunks.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n')
    : '(no relevant context found)'

  const generation = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant. Answer the question using only the provided context. If the context does not contain the answer, say you don\'t know.'
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${body.question}`
      }
    ]
  })

  return {
    answer: generation.response,
    matches: matches.matches.map(m => ({
      score: m.score,
      text: m.metadata?.text
    }))
  }
})
