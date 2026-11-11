// The path the site is served from, shared by the Vite config, the Playwright config and the
// end-to-end tests so they cannot drift apart: /arthik/ on GitHub Pages (the default), / on a
// host that serves it at the root, such as Render. Set BASE_PATH at build time to change it.

const DEFAULT_BASE = '/arthik/'

/** `path` with one slash at each end and none doubled: `arthik` and `/arthik//` are `/arthik/`, `` is `/`. */
export function normaliseBase(path: string): string {
  const trimmed = path.trim().replace(/^\/+|\/+$/g, '')
  return trimmed === '' ? '/' : `/${trimmed}/`
}

/** The base path for this build or test run, from BASE_PATH. */
export function basePath(): string {
  return normaliseBase(process.env.BASE_PATH ?? DEFAULT_BASE)
}
