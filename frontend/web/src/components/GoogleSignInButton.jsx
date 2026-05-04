import { useEffect, useRef, useState } from 'react'

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
  const clientId = normalizeGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID)

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
          callback: ({ credential }) => {
            if (!credential || disabled) return
            onCredential(credential)
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signup_with',
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
  }, [clientId, disabled, onCredential])

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