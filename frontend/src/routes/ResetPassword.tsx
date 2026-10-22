import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PasswordInput } from '../components/PasswordInput'
import { supabase } from '../lib/supabaseClient'

/**
 * Reached via the link in the password-reset email. Supabase's client
 * auto-detects the recovery token in the URL and establishes a temporary
 * session, so this page just needs to collect and set the new password.
 */
export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-center text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Set a new password
      </h1>
      <p className="mb-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Choose a new password for your account.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <PasswordInput required minLength={6} placeholder="New password" value={password} onChange={setPassword} />
        <PasswordInput
          required
          minLength={6}
          placeholder="Confirm new password"
          value={confirm}
          onChange={setConfirm}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-600 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  )
}
