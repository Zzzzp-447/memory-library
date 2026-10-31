import { scan } from 'react-scan'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { Router } from 'wouter'
import './index.css'
import 'mind-elixir/style.css'
import './i18n'
import { registerPwa } from './lib/pwa'
void registerPwa()
const isPaperPreview = window.location.pathname === '/mindmap-style'
const isEbookApp = window.location.pathname.startsWith('/ebook')
const App = lazy(() => isPaperPreview ? import('./pages/SubjectMindmapPage') : isEbookApp ? import('./App.tsx') : import('./StudyApp'))

scan({
  enabled: isEbookApp,
})
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter id="notebook-ink-edge" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="1" seed="17" result="paper-grain" />
          <feDisplacementMap in="SourceGraphic" in2="paper-grain" scale="0.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
    <Suspense fallback={<p role="status">正在打开…</p>}><Router base={isEbookApp ? '/ebook' : undefined}><App /></Router></Suspense>
  </StrictMode>
)
