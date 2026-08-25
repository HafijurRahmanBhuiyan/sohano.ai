import { ArrowLeft, Check } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { apiUpdateProfile } from '../api/client'
import { useAuthStore } from '../store/auth'

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const [name, setName] = useState(user?.name ?? '')
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setProfileError('')
    try {
      const updated = await apiUpdateProfile({ name })
      useAuthStore.setState({ user: updated })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 1500)
    } catch (err) {
      setProfileError((err as Error).message)
    }
  }

  return (
    <div className="min-h-full">
      <header className="flex h-14 items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={16} /> Back to chat
        </Link>
        <h1 className="absolute left-1/2 -translate-x-1/2 font-semibold">Settings</h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-8 px-4 py-10">
        {/* Profile */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-700/40 text-brand-700 dark:text-brand-300 font-semibold text-lg">
                {(user?.name ?? '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-zinc-500">{user?.email}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <Check size={11} /> Verified via Google
              </p>
            </div>
          </div>
          <form onSubmit={saveProfile} className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Display name
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
            {profileError && <p className="text-xs text-red-600">{profileError}</p>}
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition"
            >
              {profileSaved ? <Check size={15} /> : null}
              {profileSaved ? 'Saved' : 'Save changes'}
            </button>
          </form>
        </section>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <section>
          <h2 className="mb-2 font-semibold">Account</h2>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            You sign in with your Google account, so there is no Sohano.ai
            password. Manage your Google account at{' '}
            <a
              href="https://myaccount.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              myaccount.google.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-brand-400/60'
