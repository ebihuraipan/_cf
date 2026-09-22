import { getAuthSession } from '../utils/session'

const PROTECTED_PATHS = ['/api/ingest', '/api/query']

export default defineEventHandler(async (event) => {
  if (!PROTECTED_PATHS.some(path => event.path.startsWith(path))) {
    return
  }

  const session = await getAuthSession(event)

  if (session.data.authenticated !== true) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
})
