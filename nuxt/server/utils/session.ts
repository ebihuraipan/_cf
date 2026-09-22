import type { H3Event } from 'h3'

interface AuthSessionData {
  authenticated?: boolean
}

export function getAuthSession(event: H3Event) {
  const env = event.context.cloudflare.env
  return useSession<AuthSessionData>(event, {
    password: env.SESSION_SECRET,
    name: 'rag_session'
  })
}
