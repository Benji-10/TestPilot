import { useEffect, useState } from 'react'
import netlifyIdentity from 'netlify-identity-widget'
import useStore from './lib/store.js'
import { apiClient } from './lib/api.js'
import Layout from './components/Layout.jsx'
import AuthScreen from './pages/AuthScreen.jsx'

export default function App() {
  const { user, setUser } = useStore()
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    netlifyIdentity.init()

    netlifyIdentity.on('init', (u) => {
      setUser(u)
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

    return () => {
      netlifyIdentity.off('init')
      netlifyIdentity.off('login')
      netlifyIdentity.off('logout')
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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <AuthScreen />

  return <Layout />
}
