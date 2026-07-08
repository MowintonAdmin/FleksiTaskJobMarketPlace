import { useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { setUser } from '../store/authSlice'
import { authApi } from '../api/auth'
import api from '../api/client'

const SKILLS_SUGGESTIONS = ['Cleaning', 'Driving', 'Delivery', 'Moving', 'Gardening', 'Cooking', 'Tech Support', 'Tutoring', 'Painting', 'Plumbing']

const ACADEMIC_QUALIFICATIONS = [
  'No Formal Education',
  'Primary School',
  'PMR / PT3',
  'SPM',
  'STPM',
  'Certificate',
  'Diploma',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD / Doctorate',
  'Others',
]

const RACES = ['Malay', 'Chinese', 'Indian', 'Kadazan', 'Iban', 'Orang Asli', 'Others']

function VerificationStatus({ user, onResubmit }) {
  if (!user) return null
  const status = user.verification_status || (user.is_verified ? 'approved' : 'pending')

  if (status === 'approved') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-semibold text-green-800 text-sm">Account Verified</p>
          <p className="text-xs text-green-600">Your identity has been verified. You can now apply for tasks.</p>
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">❌</span>
          <div>
            <p className="font-semibold text-red-800 text-sm">Verification Rejected</p>
            <p className="text-xs text-red-600">Reason: {user.rejection_reason || 'No specific reason provided'}</p>
          </div>
        </div>
        <p className="text-xs text-red-500 mb-3">Please update your information below and resubmit for review.</p>
        {onResubmit && (
          <button onClick={onResubmit} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Resubmit for Verification
          </button>
        )}
      </div>
    )
  }

  if (status === 'submitted') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Under Review</p>
            <p className="text-xs text-yellow-600">Your profile has been submitted for admin verification. We'll notify you once it's reviewed.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">🛡️</span>
        <div>
          <p className="font-semibold text-yellow-800 text-sm">Complete Your Profile</p>
          <p className="text-xs text-yellow-600">Fill in your personal details and upload your bank QR code, then submit for verification.</p>
        </div>
      </div>
      {onResubmit && (
        <button
          onClick={onResubmit}
          className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Submit for Verification
        </button>
      )}
    </div>
  )
}

export default function Profile() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const photoRef = useRef()
  const bankQrRef = useRef()
  const selfieRef = useRef()
  const idPhotoRef = useRef()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingBankQr, setUploadingBankQr] = useState(false)
  const [uploadingSelfie, setUploadingSelfie] = useState(false)
  const [uploadingIdPhoto, setUploadingIdPhoto] = useState(false)
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    bio: user?.bio || '',
    location: user?.location || '',
    phone: user?.phone || '',
    skills: user?.skills || [],
    academic_qualification: user?.academic_qualification || '',
    body_height_cm: user?.body_height_cm ?? '',
    nationality: user?.nationality || '',
    race: user?.race || '',
    nric_passport: user?.nric_passport || '',
  })
  const [skillInput, setSkillInput] = useState('')

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const addSkill = (skill) => {
    const s = skill.trim()
    if (s && !form.skills.includes(s)) {
      setForm((p) => ({ ...p, skills: [...p.skills, s] }))
    }
    setSkillInput('')
  }

  const removeSkill = (skill) => setForm((p) => ({ ...p, skills: p.skills.filter((s) => s !== skill) }))

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSkill(skillInput)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await authApi.updateMe(form)
      dispatch(setUser(updated))
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const updated = await authApi.uploadPhoto(file)
      dispatch(setUser(updated))
      toast.success('Photo updated!')
    } catch {
      toast.error('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const handleBankQrUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBankQr(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/users/me/bank-qr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      dispatch(setUser(data))
      toast.success('Bank QR code uploaded!')
    } catch {
      toast.error('Failed to upload Bank QR')
    } finally {
      setUploadingBankQr(false)
    }
  }

  const handleSubmitVerification = async () => {
    try {
      const { data } = await api.post('/users/me/submit-verification')
      dispatch(setUser(data))
      toast.success('Profile submitted for verification!')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      {/* Verification Status Banner */}
      <VerificationStatus user={user} onResubmit={handleSubmitVerification} />

      {/* Photo */}
      <div className="card mb-6 flex items-center gap-4">
        <div className="relative">
          {user?.profile_photo_url ? (
            <img src={user.profile_photo_url} alt="Profile" referrerPolicy="no-referrer" className="w-20 h-20 rounded-full object-cover border-2 border-primary-500" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-2xl">
              {user?.full_name?.[0] ?? 'U'}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-full">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{user?.full_name}</p>
          <p className="text-sm text-gray-500 mb-2">{user?.email}</p>
          <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
          <button onClick={() => photoRef.current.click()} className="btn-secondary text-xs px-3 py-1.5">
            Upload Photo
          </button>
        </div>
      </div>

      {/* ID Photos & Selfie */}
      <div className="card mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Identity Documents</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Selfie with ID */}
          <div>
            <div className="relative mb-2">
              {user?.selfie_with_id_url ? (
                <img src={user.selfie_with_id_url} alt="Selfie with ID" className="w-full h-32 rounded-xl object-cover border border-gray-200" onError={e => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div className="w-full h-32 rounded-xl bg-gray-100 flex items-center justify-center text-3xl border-2 border-dashed border-gray-300">🤳</div>
              )}
              {uploadingSelfie && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input ref={selfieRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploadingSelfie(true)
              try {
                const formData = new FormData()
                formData.append('file', file)
                const { data } = await api.post('/users/me/selfie', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                })
                dispatch(setUser(data))
                toast.success('Selfie uploaded!')
              } catch { toast.error('Failed to upload selfie') }
              finally { setUploadingSelfie(false) }
            }} />
            <button onClick={() => selfieRef.current.click()} className="btn-secondary text-xs px-3 py-1.5 w-full">
              {user?.selfie_with_id_url ? 'Change Selfie' : 'Upload Selfie with ID'}
            </button>
            <p className="text-xs text-gray-400 mt-1">Hold your NRIC/Passport next to your face.</p>
          </div>

          {/* ID Photo Front */}
          <div>
            <div className="relative mb-2">
              {user?.id_photo_front_url ? (
                <img src={user.id_photo_front_url} alt="ID Front" className="w-full h-32 rounded-xl object-cover border border-gray-200" onError={e => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div className="w-full h-32 rounded-xl bg-gray-100 flex items-center justify-center text-3xl border-2 border-dashed border-gray-300">🪪</div>
              )}
              {uploadingIdPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input ref={idPhotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploadingIdPhoto(true)
              try {
                const formData = new FormData()
                formData.append('file', file)
                const { data } = await api.post('/users/me/id-photo-front', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                })
                dispatch(setUser(data))
                toast.success('ID photo uploaded!')
              } catch { toast.error('Failed to upload ID photo') }
              finally { setUploadingIdPhoto(false) }
            }} />
            <button onClick={() => idPhotoRef.current.click()} className="btn-secondary text-xs px-3 py-1.5 w-full">
              {user?.id_photo_front_url ? 'Change ID' : 'Upload ID (Front)'}
            </button>
            <p className="text-xs text-gray-400 mt-1">Clear photo of your NRIC/Passport front.</p>
          </div>
        </div>
      </div>

      {/* Bank QR Code Upload */}
      <div className="card mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bank QR Code</p>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {user?.bank_qr_code_url ? (
              <img src={user.bank_qr_code_url} alt="Bank QR" className="w-24 h-24 rounded-xl object-cover border border-gray-200" onError={e => { e.currentTarget.style.display = 'none' }} />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center text-3xl border-2 border-dashed border-gray-300">
                🏦
              </div>
            )}
            {uploadingBankQr && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">
            <p className="font-medium text-gray-700">Upload your Bank QR code</p>
            <p className="text-xs text-gray-400 mt-1">This helps admin process payments to your account.</p>
            <input ref={bankQrRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBankQrUpload} />
            <button onClick={() => bankQrRef.current.click()} className="btn-secondary text-xs px-3 py-1.5 mt-2">
              {user?.bank_qr_code_url ? 'Change QR Code' : 'Upload QR Code'}
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="card space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
          <input name="full_name" value={form.full_name} onChange={handleChange} className="input" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className="input"
            placeholder="e.g. +60 12-345 6789"
            required
          />
          <p className="text-xs text-gray-400 mt-1">Used for identity verification and admin contact.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
          <input name="location" value={form.location} onChange={handleChange} className="input" placeholder="e.g. New York, NY" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Bio</label>
          <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} className="input resize-none" placeholder="Tell employers about yourself..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Skills</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
                {s}
                <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillKeyDown}
            className="input"
            placeholder="Type a skill and press Enter..."
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SKILLS_SUGGESTIONS.filter((s) => !form.skills.includes(s)).map((s) => (
              <button key={s} type="button" onClick={() => addSkill(s)} className="text-xs bg-gray-100 hover:bg-primary-100 text-gray-600 hover:text-primary-700 px-2 py-1 rounded-full transition-colors">
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* Personal Details */}
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personal Details</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nationality</label>
              <input
                name="nationality"
                value={form.nationality}
                onChange={handleChange}
                className="input"
                placeholder="e.g. Malaysian"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Race</label>
              <select name="race" value={form.race} onChange={handleChange} className="input">
                <option value="">— Select —</option>
                {RACES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Academic Qualification</label>
              <select name="academic_qualification" value={form.academic_qualification} onChange={handleChange} className="input">
                <option value="">— Select —</option>
                {ACADEMIC_QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Body Height (cm) <span className="text-red-500">*</span></label>
              <input
                name="body_height_cm"
                type="number"
                min="50"
                max="250"
                step="0.1"
                value={form.body_height_cm}
                onChange={handleChange}
                className="input"
                placeholder="e.g. 170"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">NRIC / Passport No. <span className="text-red-500">*</span></label>
            <input
              name="nric_passport"
              value={form.nric_passport}
              onChange={handleChange}
              className="input"
              placeholder="e.g. 900101-14-1234 or A12345678"
              autoComplete="off"
              required
            />
            <p className="text-xs text-gray-400 mt-1">This information is kept confidential and only used for identity verification.</p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  )
}