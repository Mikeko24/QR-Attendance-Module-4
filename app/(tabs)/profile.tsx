import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { cropAvatar, removeAvatar, uploadAvatar } from '@/lib/avatar';
import { signOut, useAuth } from '@/lib/auth';
import {
  createAcademicSubgroup,
  getAcademicGroups,
  getAcademicSubgroups,
  type AcademicGroup,
  type AcademicSubgroup,
} from '@/lib/groups';
import { getProfile, Profile, updateProfile, updateProfileAcademicAssignment, updateProfileAvatar } from '@/lib/profiles';

type ProfileActionProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
};

function ProfileAction({ icon, label, onPress, disabled, muted }: ProfileActionProps) {
  const color = muted ? COLORS.textSecondary : COLORS.primary;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileAction,
        pressed && styles.profileActionPressed,
        disabled && styles.profileActionDisabled,
      ]}
    >
      {disabled ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <MaterialIcons color={color} name={icon} size={21} />
      )}
      <Text style={[styles.profileActionLabel, muted && styles.profileActionLabelMuted]}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<{ uri: string; base64?: string | null } | null>(null);
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [subgroups, setSubgroups] = useState<AcademicSubgroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSubgroupId, setSelectedSubgroupId] = useState<string | null>(null);
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [message, setMessage] = useState('');

  const loadProfile = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const [nextProfile, nextGroups, nextSubgroups] = await Promise.all([
      getProfile(session.user.id),
      getAcademicGroups(),
      getAcademicSubgroups(),
    ]);
    setProfile(nextProfile);
    setGroups(nextGroups);
    setSubgroups(nextSubgroups);
    setFullName(nextProfile?.full_name ?? '');
    setSelectedGroupId(nextProfile?.academic_group_id ?? null);
    setSelectedSubgroupId(nextProfile?.academic_subgroup_id ?? null);
    setNewSubgroupName('');
    setMessage(nextProfile ? '' : 'Unable to load your profile.');
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  async function saveProfile() {
    if (!session?.user.id) return;
    setSaving(true);
    setMessage('');
    const { error } = await updateProfile(session.user.id, {
      full_name: fullName.trim() || null,
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const nextProfile = await getProfile(session.user.id);
    setProfile(nextProfile);
    setEditing(false);
    setMessage('Profile updated.');
  }

  async function chooseAvatar() {
    if (!session?.user.id) return;
    setMessage('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage('Photo access is needed to choose a profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return;
    const cropped = await cropAvatar(result.assets[0].uri);
    setAvatarDraft({ uri: cropped.uri, base64: cropped.base64 });
  }

  async function saveAvatar() {
    if (!session?.user.id || !avatarDraft) return;
    setAvatarSaving(true);
    setMessage('');
    const { avatarUrl, error } = await uploadAvatar(session.user.id, avatarDraft.uri, avatarDraft.base64);
    if (error || !avatarUrl) {
      setAvatarSaving(false);
      setMessage(error?.message ?? 'Unable to upload profile photo.');
      return;
    }
    const { error: updateError } = await updateProfileAvatar(session.user.id, avatarUrl);
    setAvatarSaving(false);
    if (updateError) {
      setMessage(updateError.message);
      return;
    }
    setAvatarDraft(null);
    await loadProfile();
    setMessage('Profile photo updated.');
  }

  async function clearAvatar() {
    if (!session?.user.id) return;
    setAvatarSaving(true);
    setMessage('');
    await removeAvatar(session.user.id);
    const { error } = await updateProfileAvatar(session.user.id, null);
    setAvatarSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadProfile();
    setMessage('Profile photo removed.');
  }

  async function saveAcademicAssignment() {
    if (!session?.user.id || !profile || !selectedGroupId) return;
    const availableSubgroups = subgroups.filter((subgroup) => subgroup.academic_group_id === selectedGroupId);
    if (availableSubgroups.length > 0 && !selectedSubgroupId) {
      setMessage('Choose the subgroup for your course before saving.');
      return;
    }

    setSavingAssignment(true);
    setMessage('');
    let nextSubgroupId = selectedSubgroupId;

    if (availableSubgroups.length === 0 && newSubgroupName.trim()) {
      const { data, error } = await createAcademicSubgroup(selectedGroupId, newSubgroupName);
      if (error || !data) {
        setSavingAssignment(false);
        setMessage(error?.message ?? 'Unable to create subgroup.');
        return;
      }
      const created = data as AcademicSubgroup;
      setSubgroups((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      nextSubgroupId = created.id;
    }

    const { error } = await updateProfileAcademicAssignment(session.user.id, selectedGroupId, nextSubgroupId);
    setSavingAssignment(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    await loadProfile();
    setMessage('Academic group saved. It will apply on your next scan.');
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  const displayName = profile?.full_name || 'No name set';
  const email = session?.user.email ?? 'No email available';
  const initial = (profile?.full_name || email).trim().charAt(0).toUpperCase() || '?';
  const roleLabel = profile?.role === 'admin' ? 'Administrator' : profile?.role === 'teacher' ? 'Teacher' : profile?.role === 'student' ? 'Student' : 'Unavailable';
  const selectedGroup = selectedGroupId ? groups.find((group) => group.id === selectedGroupId) ?? null : null;
  const availableSubgroups = selectedGroupId ? subgroups.filter((subgroup) => subgroup.academic_group_id === selectedGroupId) : [];
  const assignmentLocked = (profile?.academic_assignment_change_count ?? 0) > 0;
  const currentGroup = profile?.academic_group_id ? groups.find((group) => group.id === profile.academic_group_id) ?? null : null;
  const currentSubgroup = profile?.academic_subgroup_id ? subgroups.find((subgroup) => subgroup.id === profile.academic_subgroup_id) ?? null : null;
  const canSaveAssignment = !!selectedGroupId && !assignmentLocked && !savingAssignment;
  const choosingSubgroup = !!selectedGroup && availableSubgroups.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>My profile</Text>
        <Text style={styles.subtitle}>Manage your identity and account details.</Text>

        <View style={[styles.profileCard, isDesktop && styles.profileCardDesktop]}>
          <View style={[styles.identityPanel, isDesktop && styles.identityPanelDesktop]}>
            <View style={styles.avatarShell}>
              {profile?.avatar_url ? (
                <Image
                  accessibilityLabel="Profile photo"
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={profile?.avatar_url ? 'Change profile photo' : 'Upload profile photo'}
                disabled={avatarSaving}
                onPress={chooseAvatar}
                style={({ pressed }) => [styles.avatarEditButton, pressed && styles.profileActionPressed]}
              >
                {avatarSaving ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
                ) : (
                  <MaterialIcons color={COLORS.textOnPrimary} name="photo-camera" size={18} />
                )}
              </Pressable>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
            <Text style={styles.identityName}>{displayName}</Text>
            <Text style={styles.identityEmail}>{email}</Text>
            {profile?.avatar_url && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo"
                disabled={avatarSaving}
                onPress={clearAvatar}
                style={({ pressed }) => [styles.removePhotoButton, pressed && styles.profileActionPressed]}
              >
                <Text style={styles.removePhotoText}>Remove photo</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.detailsPanel}>
            <Text style={styles.sectionLabel}>PROFILE DETAILS</Text>
            <Text style={styles.sectionTitle}>{editing ? 'Edit your profile' : 'Account information'}</Text>
            <Text style={styles.sectionHint}>
              {editing ? 'Update the name shown across QR Attendance.' : 'Your sign-in and profile information.'}
            </Text>

            {editing ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full name</Text>
                <TextInput
                  accessibilityLabel="Full name"
                  autoCapitalize="words"
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.input}
                  value={fullName}
                />
              </View>
            ) : (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <MaterialIcons color={COLORS.primary} name="person" size={20} />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={styles.detailLabel}>Display name</Text>
                  <Text style={styles.detailValue}>{displayName}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MaterialIcons color={COLORS.primary} name={profile?.role === 'admin' ? 'admin-panel-settings' : profile?.role === 'teacher' ? 'badge' : 'school'} size={20} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Account type</Text>
                <Text style={styles.detailValue}>{roleLabel}</Text>
              </View>
            </View>

            {profile?.role === 'student' ? (
              <View style={styles.assignmentPanel}>
                <Text style={styles.detailLabel}>Course and subgroup</Text>
                <Text style={styles.assignmentHint}>
                  {assignmentLocked
                    ? 'Your student course selection is locked. Ask an admin to correct it.'
                    : 'Choose carefully. Students can save this selection once.'}
                </Text>
                <Text style={styles.detailValue}>
                  Current: {currentGroup?.name ?? 'Not selected'}{currentSubgroup ? ` / ${currentSubgroup.name}` : ''}
                </Text>

                {!assignmentLocked ? (
                  <>
                    {!choosingSubgroup ? (
                      <View style={styles.choiceGrid}>
                        {groups.map((group) => {
                          const active = group.id === selectedGroupId;
                          return (
                            <Pressable
                              key={group.id}
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                              onPress={() => {
                                setSelectedGroupId(group.id);
                                setSelectedSubgroupId(null);
                                setNewSubgroupName('');
                              }}
                              style={({ pressed }) => [styles.choiceButton, active && styles.choiceButtonActive, pressed && styles.profileActionPressed]}
                            >
                              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{group.name}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.selectedCourseRow}>
                        <View style={styles.selectedCourseCopy}>
                          <Text style={styles.detailLabel}>Selected course</Text>
                          <Text style={styles.detailValue}>{selectedGroup.name}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Change selected course"
                          onPress={() => {
                            setSelectedGroupId(null);
                            setSelectedSubgroupId(null);
                            setNewSubgroupName('');
                          }}
                          style={({ pressed }) => [styles.changeCourseButton, pressed && styles.profileActionPressed]}
                        >
                          <MaterialIcons color={COLORS.primary} name="swap-horiz" size={18} />
                          <Text style={styles.changeCourseText}>Change</Text>
                        </Pressable>
                      </View>
                    )}

                    {selectedGroup ? (
                      availableSubgroups.length > 0 ? (
                        <>
                          <Text style={styles.subChoiceLabel}>Choose subgroup</Text>
                          <View style={styles.choiceGrid}>
                            {availableSubgroups.map((subgroup) => {
                              const active = subgroup.id === selectedSubgroupId;
                              return (
                                <Pressable
                                  key={subgroup.id}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: active }}
                                  onPress={() => setSelectedSubgroupId(subgroup.id)}
                                  style={({ pressed }) => [styles.choiceButton, active && styles.choiceButtonActive, pressed && styles.profileActionPressed]}
                                >
                                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{subgroup.name}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </>
                      ) : (
                        <TextInput
                          accessibilityLabel="New subgroup"
                          onChangeText={setNewSubgroupName}
                          placeholder={`Optional subgroup for ${selectedGroup.name}`}
                          placeholderTextColor={COLORS.textSecondary}
                          style={styles.input}
                          value={newSubgroupName}
                        />
                      )
                    ) : null}

                    <ProfileAction
                      disabled={!canSaveAssignment}
                      icon="save"
                      label={savingAssignment ? 'Saving...' : 'Save Course'}
                      onPress={saveAcademicAssignment}
                    />
                  </>
                ) : null}
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MaterialIcons color={COLORS.primary} name="fingerprint" size={20} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>User ID</Text>
                <Text selectable style={styles.detailId}>{session?.user.id}</Text>
              </View>
            </View>

            {!!message && (
              <Text style={[styles.message, message === 'Profile updated.' && styles.successMessage]}>
                {message}
              </Text>
            )}

            <View style={styles.actions}>
              <ProfileAction
                disabled={saving}
                icon={editing ? 'check' : 'edit'}
                label={saving ? 'Saving…' : editing ? 'Save Changes' : 'Edit Profile'}
                onPress={editing ? saveProfile : () => setEditing(true)}
              />
              {editing && (
                <ProfileAction
                  icon="close"
                  label="Cancel"
                  muted
                  onPress={() => {
                    setFullName(profile?.full_name ?? '');
                    setEditing(false);
                    setMessage('');
                  }}
                />
              )}
              <ProfileAction icon="logout" label="Sign Out" muted onPress={signOut} />
            </View>
          </View>
        </View>
      </View>
      <Modal
        animationType="fade"
        transparent
        visible={!!avatarDraft}
        onRequestClose={() => setAvatarDraft(null)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.cropSheet}>
            <Text style={styles.cropTitle}>Preview profile photo</Text>
            <Text style={styles.cropHint}>Everything inside the circle will appear on your profile.</Text>
            <View style={styles.cropPreview}>
              {avatarDraft && (
                <Image
                  accessibilityLabel="Profile photo crop preview"
                  source={{ uri: avatarDraft.uri }}
                  style={styles.cropImage}
                />
              )}
            </View>
            <View style={styles.cropActions}>
              <ProfileAction icon="close" label="Cancel" muted onPress={() => setAvatarDraft(null)} />
              <ProfileAction
                disabled={avatarSaving}
                icon="check"
                label={avatarSaving ? 'Saving...' : 'Use Photo'}
                onPress={saveAvatar}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 120 },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, fontSize: 15 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: COLORS.textPrimary, fontSize: 34, fontWeight: '800', marginTop: 12 },
  subtitle: { color: COLORS.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 6, marginBottom: 26 },
  profileCard: {
    width: '100%',
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  profileCardDesktop: { flexDirection: 'row', minHeight: 430 },
  identityPanel: { backgroundColor: COLORS.primary, alignItems: 'center', paddingHorizontal: 28, paddingVertical: 36 },
  identityPanelDesktop: { width: '38%', justifyContent: 'center' },
  avatarShell: { width: 118, height: 118, marginBottom: 18 },
  avatar: { width: 118, height: 118, borderRadius: 59, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft, borderWidth: 3, borderColor: COLORS.textOnPrimary },
  avatarImage: { width: 118, height: 118, borderRadius: 59, borderWidth: 3, borderColor: COLORS.textOnPrimary },
  avatarText: { color: COLORS.primaryDark, fontSize: 36, fontWeight: '800' },
  avatarEditButton: { position: 'absolute', right: 0, bottom: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, borderWidth: 3, borderColor: COLORS.textOnPrimary, alignItems: 'center', justifyContent: 'center' },
  removePhotoButton: { minHeight: 44, justifyContent: 'center', marginTop: 10 },
  removePhotoText: { color: COLORS.textOnPrimary, fontSize: 13, fontWeight: '700' },
  roleBadge: { backgroundColor: COLORS.textOnPrimary, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginBottom: 18 },
  roleText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  identityName: { color: COLORS.textOnPrimary, fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  identityEmail: { color: COLORS.onPrimarySoft, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7 },
  detailsPanel: { flex: 1, padding: 32, backgroundColor: COLORS.card },
  sectionLabel: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.35 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 8 },
  sectionHint: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 24 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
  detailIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  detailValue: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  detailId: { color: COLORS.textPrimary, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  assignmentPanel: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.elevated,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  assignmentHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedCourseRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedCourseCopy: { flex: 1, minWidth: 0 },
  changeCourseButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.elevated,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  changeCourseText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  subChoiceLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800' },
  choiceButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  choiceText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  choiceTextActive: { color: COLORS.textOnPrimary },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { width: '100%', minHeight: 52, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.card, color: COLORS.textPrimary, paddingHorizontal: 16, fontSize: 16 },
  message: { color: COLORS.danger, fontSize: 13, lineHeight: 19, marginTop: 2, marginBottom: 10 },
  successMessage: { color: COLORS.success },
  actions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 32, rowGap: 8, marginTop: 8 },
  profileAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  profileActionPressed: { opacity: 0.6 },
  profileActionDisabled: { opacity: 0.5 },
  profileActionLabel: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  profileActionLabelMuted: { color: COLORS.textSecondary },
  modalScrim: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', padding: 20 },
  cropSheet: { width: '100%', maxWidth: 420, backgroundColor: COLORS.elevated, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, padding: 24, alignItems: 'center' },
  cropTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  cropHint: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  cropPreview: { width: 220, height: 220, borderRadius: 110, overflow: 'hidden', borderWidth: 4, borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  cropImage: { width: '100%', height: '100%' },
  cropActions: { width: '100%', flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 32, marginTop: 20 },
});
