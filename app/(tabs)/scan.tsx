import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { EmptyState } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { registerAttendance } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getAcademicGroups, getAcademicSubgroups, type AcademicGroup, type AcademicSubgroup } from '@/lib/groups';
import { getProfile, type ProfileRole, updateProfileAcademicGroup, updateProfileAcademicSubgroup } from '@/lib/profiles';

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [academicGroupId, setAcademicGroupId] = useState<string | null>(null);
  const [academicSubgroupId, setAcademicSubgroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [subgroups, setSubgroups] = useState<AcademicSubgroup[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      const [profile, nextGroups, nextSubgroups] = await Promise.all([getProfile(user.id), getAcademicGroups(), getAcademicSubgroups()]);
      if (!active) return;
      setRole(profile?.role ?? 'student');
      setAcademicGroupId(profile?.academic_group_id ?? null);
      setAcademicSubgroupId(profile?.academic_subgroup_id ?? null);
      setGroups(nextGroups);
      setSubgroups(nextSubgroups);
    };
    void load();
    return () => { active = false; };
  }, [user]));

  const chooseGroup = async (groupId: string) => {
    if (!user) return;
    setSavingGroup(true);
    const { error } = await updateProfileAcademicGroup(user.id, groupId);
    setSavingGroup(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setAcademicGroupId(groupId);
    setAcademicSubgroupId(null);
    setMessage(null);
  };

  const chooseSubgroup = async (subgroupId: string) => {
    if (!user) return;
    setSavingGroup(true);
    const { error } = await updateProfileAcademicSubgroup(user.id, subgroupId);
    setSavingGroup(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setAcademicSubgroupId(subgroupId);
    setMessage(null);
  };

  const resetScan = () => {
    setScanned(false);
    setLastData(null);
    setMessage(null);
    setEventTitle(null);
    setScannedAt(null);
    setSuccess(false);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    setLastData(data);
    const result = await registerAttendance(data);
    setMessage(result.message);
    setSuccess(result.success);
    setEventTitle(result.eventTitle ?? null);
    setScannedAt(result.scannedAt ?? null);
  };

  if (!role) {
    return <CenteredState icon="manage-accounts" title="Checking your account" body="We are confirming your role before opening the scanner." />;
  }
  if (role !== 'student') {
    return <CenteredState icon="lock" title="Students only" body="QR attendance scanning is available to student accounts." />;
  }
  if (!academicGroupId) {
    return (
      <GroupRequiredState
        groups={groups}
        saving={savingGroup}
        message={message}
        onSelect={chooseGroup}
      />
    );
  }
  const availableSubgroups = subgroups.filter((subgroup) => subgroup.academic_group_id === academicGroupId);
  if (availableSubgroups.length > 0 && !academicSubgroupId) {
    return (
      <SubgroupRequiredState
        subgroups={availableSubgroups}
        saving={savingGroup}
        message={message}
        onSelect={chooseSubgroup}
      />
    );
  }
  if (!permission) {
    return <View style={styles.blank} />;
  }
  if (!permission.granted) {
    return (
      <CenteredState
        icon="photo-camera"
        title="Camera permission needed"
        body="Allow camera access so QR Attendance can scan event codes."
        action={<AppButton theme="primary" title="Grant Permission" icon="camera-alt" onPress={requestPermission} />}
      />
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View pointerEvents="none" style={styles.scrim}>
        <View style={styles.topScrim} />
        <View style={styles.middleRow}>
          <View style={styles.sideScrim} />
          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.sideScrim} />
        </View>
        <View style={styles.bottomScrim} />
      </View>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>STUDENT CHECK-IN</Text>
        <Text style={styles.title}>{scanned ? 'QR detected' : 'Scan event QR'}</Text>
        <Text style={styles.subtitle}>Keep the code inside the frame. Attendance is recorded only for valid event windows.</Text>
      </View>

      <View style={[styles.sheet, success ? styles.successSheet : message ? styles.errorSheet : null]}>
        <View style={styles.sheetIcon}>
          <MaterialIcons name={success ? 'check-circle' : message ? 'error-outline' : 'qr-code-scanner'} color={success ? COLORS.success : message ? COLORS.danger : COLORS.primary} size={24} />
        </View>
        <View style={styles.sheetCopy}>
          <Text style={styles.sheetTitle}>{eventTitle || (success ? 'Attendance recorded' : message ? 'Scan needs attention' : 'Ready to scan')}</Text>
          {message ? <Text style={styles.sheetBody}>{message}</Text> : <Text style={styles.sheetBody}>Point your camera at an event QR code.</Text>}
          {scannedAt ? <Text style={styles.sheetMeta}>Scanned {new Date(scannedAt).toLocaleString()}</Text> : null}
          {lastData && !success ? <Text style={styles.sheetMeta}>The scanned QR could not be used for attendance.</Text> : null}
        </View>
        {scanned ? <AppButton compact title="Scan Again" icon="refresh" theme="primary" onPress={resetScan} /> : null}
      </View>
    </View>
  );
}

function SubgroupRequiredState({
  subgroups,
  saving,
  message,
  onSelect,
}: {
  subgroups: AcademicSubgroup[];
  saving: boolean;
  message: string | null;
  onSelect: (subgroupId: string) => void;
}) {
  return (
    <View style={styles.centered}>
      <EmptyState
        icon="category"
        title="Choose your subgroup"
        body="Some events are assigned to a specific subgroup. Choose yours before scanning."
        action={
          <View style={styles.groupPicker}>
            {subgroups.map((subgroup) => (
              <Pressable
                key={subgroup.id}
                accessibilityRole="button"
                disabled={saving}
                onPress={() => onSelect(subgroup.id)}
                style={({ pressed }) => [styles.groupButton, pressed && styles.groupButtonPressed, saving && styles.groupButtonDisabled]}
              >
                <Text style={styles.groupButtonText}>{subgroup.name}</Text>
              </Pressable>
            ))}
            {message ? <Text style={styles.groupError}>{message}</Text> : null}
          </View>
        }
      />
    </View>
  );
}

function CenteredState({ icon, title, body, action }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={styles.centered}>
      <EmptyState icon={icon} title={title} body={body} action={action} />
    </View>
  );
}

function GroupRequiredState({
  groups,
  saving,
  message,
  onSelect,
}: {
  groups: AcademicGroup[];
  saving: boolean;
  message: string | null;
  onSelect: (groupId: string) => void;
}) {
  return (
    <View style={styles.centered}>
      <EmptyState
        icon="school"
        title="Choose your course or grade"
        body="Attendance is counted only for events assigned to your selected group."
        action={
          <View style={styles.groupPicker}>
            {groups.map((group) => (
              <Pressable
                key={group.id}
                accessibilityRole="button"
                disabled={saving}
                onPress={() => onSelect(group.id)}
                style={({ pressed }) => [styles.groupButton, pressed && styles.groupButtonPressed, saving && styles.groupButtonDisabled]}
              >
                <Text style={styles.groupButtonText}>{group.name}</Text>
              </Pressable>
            ))}
            {groups.length === 0 ? <Text style={styles.groupHint}>Ask an admin to create a course or grade level first.</Text> : null}
            {message ? <Text style={styles.groupError}>{message}</Text> : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: 20 },
  groupPicker: { width: '100%', gap: 10, alignItems: 'stretch' },
  groupButton: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  groupButtonPressed: { opacity: 0.75 },
  groupButtonDisabled: { opacity: 0.5 },
  groupButtonText: { color: COLORS.textOnPrimary, fontSize: 14, fontWeight: '900' },
  groupHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  groupError: { color: COLORS.danger, fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '700' },
  container: { flex: 1, backgroundColor: '#000000' },
  camera: StyleSheet.absoluteFill,
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  topScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  middleRow: { height: 270, flexDirection: 'row' },
  sideScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  bottomScrim: { flex: 1.4, backgroundColor: 'rgba(0,0,0,0.52)' },
  frame: { width: 270, height: 270 },
  corner: { position: 'absolute', width: 58, height: 58, borderColor: COLORS.scan },
  topLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 18 },
  topRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 18 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 18 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 },
  header: { position: 'absolute', top: 54, left: 22, right: 22 },
  eyebrow: { color: COLORS.scan, fontSize: 11, letterSpacing: 1.3, fontWeight: '900', marginBottom: 8 },
  title: { color: COLORS.textOnPrimary, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  subtitle: { color: '#D6DEE9', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 440 },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 98,
    backgroundColor: COLORS.elevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: COLORS.shadow,
    ...SHADOWS.sheet,
  },
  successSheet: { borderWidth: 1, borderColor: COLORS.successLight },
  errorSheet: { borderWidth: 1, borderColor: COLORS.dangerSoft },
  sheetIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  sheetCopy: { flex: 1, minWidth: 0 },
  sheetTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '900' },
  sheetBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 },
  sheetMeta: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
});
