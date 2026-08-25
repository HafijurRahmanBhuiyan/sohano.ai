import { useEffect } from 'react'
import { setToken } from '../api/client'

export default function OAuthCallbackPage() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = hash.get('access_token')

    if (token) {
      setToken(token)
      window.location.replace('/')
    } else {
      window.location.replace('/login?oauth_error=token_exchange_failed')
    }
  }, [])

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-zinc-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        Signing you in with Google…
      </div>
    </div>
  )
}
