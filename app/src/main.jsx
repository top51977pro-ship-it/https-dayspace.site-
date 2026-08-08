import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import App from './App'
import { AppProvider } from './state/AppContext'
import { isNative } from './lib/device'
import { initDeepLinks } from './lib/deeplink'
import './index.css'

async function prepareNativeChrome() {
  if (!isNative) return
  try {
    await StatusBar.setStyle({ style: Style.Dark }) // light icons on our dark UI
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch {
    /* status bar control is unavailable on some devices */
  }
}

prepareNativeChrome()
initDeepLinks()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)

// Keep the splash up until React has painted the first frame.
requestAnimationFrame(() => {
  setTimeout(() => {
    SplashScreen.hide().catch(() => {})
  }, 350)
})
