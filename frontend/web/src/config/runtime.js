function readRuntimeConfig(key) {
  if (typeof window === 'undefined') return ''

  const runtimeConfig = window.__FLEKSI_CONFIG__
  if (!runtimeConfig || typeof runtimeConfig !== 'object') return ''

  const value = runtimeConfig[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function getPublicConfig(key, fallback = '') {
  return readRuntimeConfig(key) || fallback
}