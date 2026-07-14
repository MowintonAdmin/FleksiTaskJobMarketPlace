import { useState } from 'react'

const CONSENT_TEXT = `PARTICIPANT WORK AGREEMENT & E-CONSENT FORM

By signing this form, you acknowledge and agree to the following:

1. NATURE OF WORK
   You are engaging as an independent worker for the task described in your application. This is not an employment contract.

2. HEALTH & SAFETY
   You confirm that you are physically and mentally fit to perform the assigned task. You agree to follow all safety instructions provided by the task organiser and to immediately report any unsafe conditions.

3. LIABILITY WAIVER
   You accept full responsibility for your own safety during the task. FleksiTask and the task employer are not liable for any injuries, losses, or damages arising from your participation, except where required by law.

4. DATA & PRIVACY
   Your personal information (name, contact details, and work records) will be used solely for task coordination, payment processing, and platform compliance. Refer to our Privacy Policy for full details.

5. PAYMENT
   Payment will be processed upon admin approval of your completed session. Earnings are subject to task terms and may be withheld if work is incomplete or does not meet the stated requirements.

6. CONDUCT
   You agree to behave professionally, respect the workplace environment, and comply with all reasonable instructions from the task organiser.

7. CANCELLATION
   If you are unable to complete the task after checking in, you must notify the organiser immediately. Repeated no-shows or early abandonments may affect your account standing.

By typing your full name below and clicking "I Agree & Check In", you are providing your electronic signature and confirm that you have read, understood, and agree to this consent form.`

export default function ConsentModal({ taskTitle, onConfirm, onCancel, loading }) {
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')

  const canSubmit = agreed && signature.trim().length >= 2 && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">📋 E-Consent Form</h2>
          <p className="text-sm text-gray-500 mt-0.5">Required before starting: <span className="font-medium text-gray-700">{taskTitle}</span></p>
        </div>

        {/* Scrollable consent text */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-200">
            {CONSENT_TEXT}
          </pre>
        </div>

        {/* Agreement section */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-4 shrink-0">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-green-600 shrink-0"
            />
            <span className="text-sm text-gray-700">
              I have read and understood the consent form above and agree to all terms and conditions.
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-Signature <span className="text-gray-400 font-normal">(type your full name)</span>
            </label>
            <input
              type="text"
              value={signature}
              onChange={e => setSignature(e.target.value)}
              placeholder="Your full legal name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-serif italic"
              autoComplete="name"
            />
            {signature.trim().length > 0 && signature.trim().length < 2 && (
              <p className="text-xs text-red-500 mt-1">Please enter your full name</p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(signature.trim())}
              disabled={!canSubmit}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Checking in…' : '✅ I Agree & Check In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
