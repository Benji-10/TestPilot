import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surface-2)',
            color: 'var(--ink-1)',
            border: '1px solid var(--border-active)',
            fontFamily: 'inherit',
            fontSize: '12px',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'transparent' } },
          error: { iconTheme: { primary: 'var(--danger)', secondary: 'transparent' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
