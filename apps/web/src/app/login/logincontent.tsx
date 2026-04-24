'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { loginWithPassword, saveSessionFromLogin } from '@/lib/auth'

export default function LoginContent() {
  const sp = useSearchParams()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setErr(null)
      setLoading(true)

      try {
        const res = await loginWithPassword(email, password)
        saveSessionFromLogin(res)

        const next = sp.get('next')
        router.replace(next && next.startsWith('/') ? next : '/dashboard')
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Login failed')
      } finally {
        setLoading(false)
      }
    },
    [email, password, router, sp]
  )

  return (
    <main style={{ padding: 40, maxWidth: 480, margin: '0 auto' }}>
      <h1>Login</h1>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 10 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 10 }}
          />
        </div>

        {err && (
          <p style={{ color: 'red' }}>
            {err}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        No account? <Link href="/register">Register</Link>
      </p>
    </main>
  )
