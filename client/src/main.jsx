import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Service worker registration is handled by VitePWA plugin (injectManifest strategy).
// Do NOT manually register /sw.js here to avoid duplicate SW conflicts.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
