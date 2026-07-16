/**
 * Tab-isolated storage for auth tokens.
 * Uses sessionStorage (per-tab) with a localStorage fallback for backward compatibility.
 * This allows different browser tabs to be logged into different accounts simultaneously.
 */
function getTabId() {
  let tabId = sessionStorage.getItem('tab_id')
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('tab_id', tabId)
  }
  return tabId
}

export const storage = {
  getItem(key) {
    const tabId = getTabId()
    const tabValue = sessionStorage.getItem(`${tabId}_${key}`)
    if (tabValue !== null) return tabValue
    return sessionStorage.getItem(key) || localStorage.getItem(key)
  },
  setItem(key, value) {
    const tabId = getTabId()
    sessionStorage.setItem(`${tabId}_${key}`, value)
    localStorage.setItem(key, value)
  },
  removeItem(key) {
    const tabId = getTabId()
    sessionStorage.removeItem(`${tabId}_${key}`)
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  },
}