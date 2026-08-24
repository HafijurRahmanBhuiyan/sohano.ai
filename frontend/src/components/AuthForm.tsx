import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface AuthFormProps {
  mode: 'login' | 'signup'
  onSubmit: (name: string, email: string, password: string) => Promise<void>
}

export default function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSubmit(name, email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white text-xl font-bold shadow-lg shadow-brand-500/30">
            S
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sohano<span className="text-brand-500">.ai</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              minLength={1}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900
                         px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-brand-400/60"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900
                       px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-brand-400/60"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Password (min. 8 characters)' : 'Password'}
            type="password"
            required
            minLength={mode === 'signup' ? 8 : 1}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900
                       px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-brand-400/60"
          />

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white
                       hover:bg-brand-600 disabled:opacity-50 transition shadow-sm"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-brand-600 hover:underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-brand-600 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
