import { useEffect, useRef, useState } from 'react'
import { getPublicConfig } from '../config/runtime'

let googleScriptPromise

function normalizeGoogleClientId(value) {
  if (!value) return ''

  const normalized = value.trim()
  return normalized.includes('your-google-client-id') ? '' : normalized
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-identity-script')
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'google-identity-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })

  return googleScriptPromise
}

export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const buttonRef = useRef(null)
  const [loadError, setLoadError] = useState(null)
  const clientId = normalizeGoogleClientId(getPublicConfig('VITE_GOOGLE_CLIENT_ID', import.meta.env.VITE_GOOGLE_CLIENT_ID))

  // Keep refs so the GIS callback always calls the latest versions
  // without re-initialising the button on every render.
  const onCredentialRef = useRef(onCredential)
  const disabledRef = useRef(disabled)
  useEffect(() => { onCredentialRef.current = onCredential }, [onCredential])
  useEffect(() => { disabledRef.current = disabled }, [disabled])

  // Only re-initialise when the client ID itself changes.
  useEffect(() => {
    let cancelled = false

    if (!clientId) {
      setLoadError(null)
      return () => {}
    }

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return

        setLoadError(null)
        buttonRef.current.innerHTML = ''
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          callback: ({ credential }) => {
            if (!credential || disabledRef.current) return
            onCredentialRef.current(credential)
          },
          error_callback: ({ type }) => {
            console.error('[Google Sign-In]', type)
            if (type === 'suppressed_by_user') return
            if (type === 'secure_http_required') {
              setLoadError('Google Sign-In requires HTTPS. Please use https://flekxi.my.')
            } else if (type === 'unregistered_origin' || type === 'origin_mismatch') {
              setLoadError('This domain is not authorized in Google Cloud Console. Contact support.')
            } else {
              setLoadError(`Google Sign-In unavailable (${type}). Use email/password instead.`)
            }
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 360,
          logo_alignment: 'left',
        })
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Google Sign-In failed to load. Try again in a moment.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [clientId]) // ← intentionally only clientId; onCredential/disabled handled via refs

  if (!clientId) {
    return null
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      <div ref={buttonRef} className="flex justify-center min-h-11" />
      {loadError && <p className="mt-2 text-xs text-amber-700">{loadError}</p>}
    </div>
  )
}