import './styles/tokens.css'
import './styles/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { prepareFirstPaint } from './i18n/startup'

const root = document.getElementById('root')
if (!root) throw new Error('index.html is missing the #root element')

// A returning visitor's language is set up first, so the first frame is already theirs.
// prepareFirstPaint never rejects; the catch is the last guard against a blank page.
void prepareFirstPaint()
  .catch(() => undefined)
  .then((language) => {
    createRoot(root).render(
      <StrictMode>
        <App language={language} />
      </StrictMode>,
    )
  })
