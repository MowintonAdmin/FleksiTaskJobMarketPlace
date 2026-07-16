/**
 * Tab-isolated storage for auth tokens.
 * Uses sessionStorage (per-tab) with a localStorage fallback for refresh persistence.
 * This allows different tabs to be logged into different accounts simultaneously.
 */
const STORAGE_PREFIX = 'admin_'

function getTabId() {
  let tabId = sessionStorage.getItem(`${STORAGE_PREFIX}tab_id`)
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem(`${STORAGE_PREFIX}tab_id`, tabId)
  }
  return tabId
}

export const storage = {
  getItem(key) {
    // Try sessionStorage first (per-tab, isolated)
    const tabId = getTabId()
    const tabValue = sessionStorage.getItem(`${STORAGE_PREFIX}${tabId}_${key}`)
    if (tabValue !== null) return tabValue
    // Fallback to sessionStorage without tabId (for backward compatibility)
    return sessionStorage.getItem(`${STORAGE_PREFIX}${key}`) || localStorage.getItem(`${STORAGE_PREFIX}${key}`)
  },
  setItem(key, value) {
    const tabId = getTabId()
    sessionStorage.setItem(`${STORAGE_PREFIX}${tabId}_${key}`, value)
    // Also set in localStorage for backward compatibility / refresh persistence
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, value)
  },
  removeItem(key) {
    const tabId = getTabId()
    sessionStorage.removeItem(`${STORAGE_PREFIX}${tabId}_${key}`)
    sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`)
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
  },
}