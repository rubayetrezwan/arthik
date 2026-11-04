import { render } from '@testing-library/react'
import App from '../App'

/** Renders the whole app, with its real hash router, at a route such as '/score/nusrat'. */
export function renderApp(path = '/') {
  window.location.hash = `#${path}`
  return render(<App />)
}
