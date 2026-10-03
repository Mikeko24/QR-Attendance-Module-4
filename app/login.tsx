import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { FormField, StatusPill, Surface } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { signIn } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Enter your school email and password to continue.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add the URL and anon key to .env, then restart Expo.');
      return;
    }

    setLoading(true);
    setError(null);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) setError(authError.message || 'Unable to sign in. Check your email and password.');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.shell, compact && styles.compactShell]}>
          <View style={styles.brandPanel}>
            <StatusPill label="SECURE ATTENDANCE" tone="primary" />
            <View>
              <Text style={styles.brandTitle}>QR Attendance</Text>
              <Text style={styles.brandCopy}>Fast check-ins for students, event QR creation for teachers, and clean attendance oversight for admins.</Text>
            </View>
            <View style={styles.brandStats}>
              <Text style={styles.brandStat}>Scan</Text>
              <Text style={styles.brandStat}>Verify</Text>
              <Text style={styles.brandStat}>Review</Text>
            </View>
          </View>

          <Surface elevated style={styles.panel}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue to your role-specific workspace.</Text>
            <View style={styles.formStack}>
              <FormField label="Email" value={email} onChangeText={setEmail} placeholder="your.email@school.edu" autoCapitalize="none" keyboardType="email-address" editable={!loading} />
              <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry editable={!loading} />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <AppButton title="Sign In" icon="login" theme="primary" loading={loading} onPress={handleLogin} />
              <Link href="/register" style={styles.link}>Create an account</Link>
            </View>
          </Surface>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 36 },
  shell: { width: '100%', maxWidth: 960, alignSelf: 'center', flexDirection: 'row', gap: SPACING.xl, alignItems: 'stretch' },
  compactShell: { flexDirection: 'column' },
  brandPanel: {
    flex: 1,
    minHeight: 360,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primaryDark,
    padding: SPACING.xxl,
    justifyContent: 'space-between',
    shadowColor: COLORS.shadow,
    ...SHADOWS.card,
  },
  brandTitle: { color: COLORS.textOnPrimary, fontSize: 42, lineHeight: 48, fontWeight: '900', marginTop: 20 },
  brandCopy: { color: COLORS.onPrimarySoft, fontSize: 16, lineHeight: 24, marginTop: 14 },
  brandStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 },
  brandStat: { overflow: 'hidden', color: COLORS.textOnPrimary, borderColor: COLORS.onPrimaryMuted, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 8, fontWeight: '800' },
  panel: { flex: 1, minWidth: 0, justifyContent: 'center', padding: 28 },
  title: { color: COLORS.textPrimary, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  subtitle: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  formStack: { gap: 14 },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerSoft, borderRadius: RADIUS.md, padding: 12, marginTop: 16, fontWeight: '700' },
  actions: { marginTop: 22, gap: 14, alignItems: 'center' },
  link: { color: COLORS.primary, fontSize: 15, fontWeight: '800', paddingVertical: 8 },
});
