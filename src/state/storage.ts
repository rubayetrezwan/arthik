// localStorage can throw on any access: Safari private mode, blocked site data, a full
// quota. Preferences are a convenience, so these wrappers swallow every failure and the
// app carries on with its defaults. They never log, so they never add a console error.

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not remembered on this device. Nothing the visitor can act on.
  }
}
