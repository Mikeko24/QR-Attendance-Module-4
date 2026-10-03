import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { FormField, SegmentedControl, Surface } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { signUp } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

type RegisterRole = 'student' | 'teacher';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (loading) return;
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Complete every required field before creating the account.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add the URL and anon key to .env, then restart Expo.');
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: authError } = await signUp(email.trim(), password, {
      full_name: fullName.trim(),
      role,
    });
    setLoading(false);

    if (authError) setError(authError.message || 'Unable to create the account. Check the details and try again.');
    else if (!data.session) setError('Check your email to confirm your account, then sign in.');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Surface elevated style={styles.panel}>
          <Text style={styles.eyebrow}>NEW WORKSPACE ACCESS</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Choose the role that matches how you will use QR Attendance.</Text>

          <View style={styles.formStack}>
            <FormField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" />
            <FormField label="Email" value={email} onChangeText={setEmail} placeholder="your.email@school.edu" autoCapitalize="none" keyboardType="email-address" />
            <View style={styles.roleBlock}>
              <Text style={styles.fieldLabel}>Account type</Text>
              <SegmentedControl
                value={role}
                onChange={setRole}
                options={[
                  { value: 'student', label: 'Student', icon: 'school' },
                  { value: 'teacher', label: 'Teacher', icon: 'badge' },
                ]}
              />
            </View>
            <FormField label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
            <FormField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" secureTextEntry />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <AppButton title="Create Account" icon="person-add" theme="primary" loading={loading} onPress={handleRegister} />
            <Link href="/login" style={styles.link}>Already have an account? Sign in</Link>
          </View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 36 },
  panel: { width: '100%', maxWidth: 540, padding: 28 },
  eyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: COLORS.textPrimary, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  subtitle: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  formStack: { gap: 14 },
  roleBlock: { gap: 7 },
  fieldLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerSoft, borderRadius: RADIUS.md, padding: 12, marginTop: 16, fontWeight: '700' },
  actions: { marginTop: SPACING.xl, gap: 14, alignItems: 'center' },
  link: { color: COLORS.primary, fontSize: 15, fontWeight: '800', paddingVertical: 8 },
});
