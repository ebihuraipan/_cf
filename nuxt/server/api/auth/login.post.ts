import { getAuthSession } from '../../utils/session'

interface LoginBody {
  passphrase: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)

  if (!body?.passphrase || typeof body.passphrase !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'passphrase is required' })
  }

  const env = event.context.cloudflare.env

  if (body.passphrase !== env.PASSPHRASE) {
    throw createError({ statusCode: 401, statusMessage: 'invalid passphrase' })
  }

  const session = await getAuthSession(event)
  await session.update({ authenticated: true })

  return { ok: true }
})
