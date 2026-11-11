import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

/** How long to wait for a page whose heading is drawn late, such as a sample still loading. */
const WAIT_FOR_HEADING_MS = 3000

/**
 * After a move to another page (never on the first page drawn), puts focus on the new page's
 * h1, so a screen reader announces where the visitor now is. A link to a section of a page
 * (#/how-it-works#points) is left to that page, which focuses the section instead.
 */
export function useFocusOnPageChange(): void {
  const { pathname, hash } = useLocation()
  const shown = useRef(pathname)

  useEffect(() => {
    if (shown.current === pathname) return
    shown.current = pathname
    if (hash) return

    const main = document.getElementById('main')
    if (!main) return

    const focusHeading = (): boolean => {
      const heading = main.querySelector<HTMLElement>('h1')
      if (!heading) return false
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
      // The router has already scrolled the page; focusing must not scroll it again.
      heading.focus({ preventScroll: true })
      return true
    }
    if (focusHeading()) return

    const observer = new MutationObserver(() => {
      if (focusHeading()) stop()
    })
    const timer = window.setTimeout(() => stop(), WAIT_FOR_HEADING_MS)
    function stop() {
      observer.disconnect()
      window.clearTimeout(timer)
    }
    observer.observe(main, { childList: true, subtree: true })
    return stop
  }, [pathname, hash])
}
