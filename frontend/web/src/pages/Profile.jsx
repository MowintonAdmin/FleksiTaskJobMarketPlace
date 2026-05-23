import { useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { setUser } from '../store/authSlice'
import { authApi } from '../api/auth'

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

export default function Profile() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const photoRef = useRef()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    bio: user?.bio || '',
    location: user?.location || '',
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

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

      {/* Form */}
      <form onSubmit={handleSave} className="card space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
          <input name="full_name" value={form.full_name} onChange={handleChange} className="input" required />
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Body Height (cm)</label>
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
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">NRIC / Passport No.</label>
            <input
              name="nric_passport"
              value={form.nric_passport}
              onChange={handleChange}
              className="input"
              placeholder="e.g. 900101-14-1234 or A12345678"
              autoComplete="off"
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
