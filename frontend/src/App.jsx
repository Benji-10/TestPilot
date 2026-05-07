import { useEffect, useState } from 'react'
import useStore from './lib/store.js'
import { apiClient } from './lib/api.js'
import Layout from './components/Layout.jsx'
import AuthScreen from './pages/AuthScreen.jsx'

// Use the global netlifyIdentity injected by the CDN script in index.html
// Do NOT import from 'netlify-identity-widget' — that causes double-init conflict
const netlifyIdentity = window.netlifyIdentity

export default function App() {
  const { user, setUser } = useStore()
  const [authReady, setAuthReady] = useState(false)
  const [initError, setInitError] = useState(null)

  useEffect(() => {
    if (!netlifyIdentity) {
      setInitError('netlify-identity-widget script failed to load. Check your internet connection.')
      setAuthReady(true)
      return
    }

    const timeout = setTimeout(() => {
      console.warn('Netlify Identity init timed out')
      setInitError('Identity timed out. Make sure Netlify Identity is enabled: Site Settings → Identity → Enable Identity')
      setAuthReady(true)
    }, 8000)

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
      setInitError(typeof err === 'string' ? err : (err?.message || JSON.stringify(err)))
      setAuthReady(true)
    })

    // Trigger init — the CDN script exposes netlifyIdentity globally and
    // init() tells it which site URL to use (auto-detected from window.location)
    netlifyIdentity.init({ logo: false })

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
        <div style={{ fontSize: 28 }}>⚠️</div>
        <p style={{
          color: 'var(--danger)', fontSize: 13, textAlign: 'center',
          maxWidth: 460, lineHeight: 1.7
        }}>
          {initError}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <AuthScreen />
  return <Layout />
}
