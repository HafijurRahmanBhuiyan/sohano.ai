import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiProviders, API_BASE } from '../api/client'

const OAUTH_ERRORS: Record<string, string> = {
  expired_state: 'Google sign-in session expired. Please try again.',
  token_exchange_failed: 'Google sign-in failed. Please try again.',
  google_unreachable: 'Could not reach Google. Please try again.',
  unverified_google_email:
    'Your Google account email is not verified by Google, so it cannot be used.',
}

/*
 * Google-only auth: users can only enter Sohano.ai with a real,
 * Google-verified Gmail/Workspace account.
 */
export default function LoginPage() {
  const location = useLocation()
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const oauthError = params.get('error')
    if (oauthError) {
      setError(OAUTH_ERRORS[oauthError] ?? 'Google sign-in failed. Please try again.')
    }
  }, [location.search])

  useEffect(() => {
    apiProviders()
      .then((p) => setGoogleEnabled(p.google))
      .catch(() => setGoogleEnabled(false))
  }, [])

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white text-xl font-bold shadow-lg shadow-brand-500/30">
            S
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sohano<span className="text-brand-500">.ai</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sign in with your Google account to continue.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {googleEnabled === null ? (
          <p className="py-3 text-sm text-zinc-400">Loading…</p>
        ) : googleEnabled ? (
          <a
            href={`${API_BASE}/auth/google`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700
                       bg-white dark:bg-zinc-900 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200
                       hover:bg-zinc-50 dark:hover:bg-zinc-800 transition shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 34.9 44 30 44 24c0-1.3-.1-2.7-.4-3.9z"/>
            </svg>
            Continue with Google
          </a>
        ) : (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Google sign-in is not configured on the backend yet.
            <br />
            Set <code className="font-mono">GOOGLE_CLIENT_ID</code> and{' '}
            <code className="font-mono">GOOGLE_CLIENT_SECRET</code> in{' '}
            <code className="font-mono">backend/.env</code>, then restart the server.
          </div>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-zinc-400">
          Only real Google accounts can be used — new and existing chats are
          linked to your Gmail address automatically.
        </p>
      </div>
    </div>
  )
}
