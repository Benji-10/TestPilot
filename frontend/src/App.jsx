import { useEffect, useState } from 'react'
import netlifyIdentity from 'netlify-identity-widget'
import useStore from './lib/store.js'
import { apiClient } from './lib/api.js'
import Layout from './components/Layout.jsx'
import AuthScreen from './pages/AuthScreen.jsx'

export default function App() {
  const { user, setUser } = useStore()
  const [authReady, setAuthReady] = useState(false)
  const [initError, setInitError] = useState(null)

  useEffect(() => {
    // Fallback: if Identity doesn't fire within 5s, show auth screen anyway
    const timeout = setTimeout(() => {
      console.warn('Netlify Identity init timed out — is Identity enabled on your site?')
      setAuthReady(true)
    }, 5000)

    try {
      netlifyIdentity.init({ logo: false })
    } catch (e) {
      console.error('Identity init error:', e)
      setInitError(e.message)
      setAuthReady(true)
      clearTimeout(timeout)
      return
    }

    netlifyIdentity.on('init', (u) => {
      clearTimeout(timeout)
      setUser(u || null)
      setAuthReady(true)
    })

    netlifyIdentity.on('login', async (u) => {
      setUser(u)
      netlifyIdentity.close()
      try {
        await apiClient.syncUser({ email: u.email, name: u.user_metadata?.full_name })
      } catch (e) {
        console.error('Failed to sync user:', e)
      }
    })

    netlifyIdentity.on('logout', () => setUser(null))

    netlifyIdentity.on('error', (err) => {
      console.error('Netlify Identity error:', err)
      clearTimeout(timeout)
      setInitError(typeof err === 'string' ? err : err?.message || 'Identity error')
      setAuthReady(true)
    })

    return () => {
      clearTimeout(timeout)
      netlifyIdentity.off('init')
      netlifyIdentity.off('login')
      netlifyIdentity.off('logout')
      netlifyIdentity.off('error')
    }
  }, [])

  if (!authReady) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16
      }}>
        <div style={{
          width: 32, height: 32, border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 8 }}>Loading…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (initError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16, padding: 32
      }}>
        <div style={{ fontSize: 24, marginBottom: 4 }}>⚠️</div>
        <p style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center', maxWidth: 420, lineHeight: 1.7 }}>
          <strong>Auth configuration error:</strong><br/>{initError}
        </p>
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '14px 18px', maxWidth: 420, fontSize: 12,
          color: 'var(--ink-2)', lineHeight: 1.8
        }}>
          <strong style={{ color: 'var(--ink-1)' }}>Fix:</strong> Go to your Netlify dashboard →
          <strong> Site Settings → Identity → Enable Identity</strong>.
          Then trigger a new deploy (or just re-save any env var to force one).
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <AuthScreen />

  return <Layout />
}
