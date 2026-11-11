import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Player from './Player.tsx'
import UpdateBanner from './components/UpdateBanner'

const isPlayer = new URLSearchParams(window.location.search).has('player')
const inTauri = '__TAURI_INTERNALS__' in window

if (!inTauri && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UpdateBanner />
    {isPlayer ? <Player /> : <App />}
  </StrictMode>,
)
