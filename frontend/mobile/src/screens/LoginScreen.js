import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { loginWithGoogle } from '../store/slices/authSlice'
import { authService } from '../services/auth'

export default function LoginScreen() {
  const dispatch = useDispatch()
  const { loading, error } = useSelector((s) => s.auth)

  const handleGoogleSignIn = async () => {
    try {
      const idToken = await authService.googleSignIn()
      await dispatch(loginWithGoogle(idToken)).unwrap()
    } catch (err) {
      Alert.alert('Sign-in Error', err.message || 'Google sign-in failed')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>⚡</Text>
      <Text style={styles.title}>FlekxiTask</Text>
      <Text style={styles.subtitle}>Find flexible work near you</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={loading}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.features}>
          {['Instant job matching', 'One-tap applications', 'Push notifications', 'Track your earnings'].map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: '#1d4ed8', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, gap: 10, marginBottom: 16 },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  error: { color: '#dc2626', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  features: { marginTop: 8, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkmark: { color: '#16a34a', fontSize: 14, fontWeight: '700' },
  featureText: { fontSize: 13, color: '#6b7280' },
})
