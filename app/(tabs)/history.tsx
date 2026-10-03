import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { COLORS } from '@/constants/colors';
import { getAttendanceHistory, getTeacherEventAttendance, type AttendanceRecord, type TeacherEventAttendance } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { buildQRPayload } from '@/lib/qr';
import { getProfile, type ProfileRole } from '@/lib/profiles';

type QRRef = {
  toDataURL?: (callback: (data: string) => void) => void;
};

type QRDownloadFormat = 'png' | 'jpg' | 'svg';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole>('student');
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const profileRole = (await getProfile(user.id))?.role ?? 'student';
      if (!active) return;
      setRole(profileRole);
      if (profileRole === 'teacher') setTeacherEvents(await getTeacherEventAttendance(user.id));
      else setStudentRecords(await getAttendanceHistory(user.id));
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user]));

  const empty = role === 'teacher' ? teacherEvents.length === 0 : studentRecords.length === 0;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{role === 'teacher' ? 'TEACHER HISTORY' : 'STUDENT HISTORY'}</Text>
      <Text style={styles.title}>{role === 'teacher' ? 'Event Attendance' : 'Attendance History'}</Text>
      <Text style={styles.subtitle}>
        {role === 'teacher'
          ? 'Tap an event to show its QR code, attendance count, and scan times.'
          : 'Your past attendance records.'}
      </Text>
      {loading ? (
        <Text style={styles.center}>Loading records...</Text>
      ) : empty ? (
        <Text style={styles.center}>
          {role === 'teacher' ? 'No events created yet. Create an event QR to begin.' : 'No attendance records yet. Scan your first event QR to begin.'}
        </Text>
      ) : role === 'teacher' ? (
        teacherEvents.map((event) => (
          <TeacherCard
            key={event.eventId}
            event={event}
            expanded={expandedEventId === event.eventId}
            onPress={() => setExpandedEventId((current) => current === event.eventId ? null : event.eventId)}
          />
        ))
      ) : (
        studentRecords.map((record) => <StudentCard key={record.id} record={record} />)
      )}
    </ScrollView>
  );
}

function StudentCard({ record }: { record: AttendanceRecord }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{record.eventTitle || 'Untitled event'}</Text>
      <Text style={styles.meta}>Event: {record.eventId}</Text>
      <Text style={styles.meta}>Group: {record.academicGroupName || 'Not selected'}</Text>
      <Text style={styles.meta}>Scanned: {new Date(record.scannedAt).toLocaleString()}</Text>
    </View>
  );
}

function TeacherCard({
  event,
  expanded,
  onPress,
}: {
  event: TeacherEventAttendance;
  expanded: boolean;
  onPress: () => void;
}) {
  const status = getEventStatus(event.start, event.end);
  const qrRef = useRef<QRRef | null>(null);
  const [downloadPromptVisible, setDownloadPromptVisible] = useState(false);
  const qrPayload = buildQRPayload({
    eventId: event.eventCode,
    title: event.title,
    start: event.start ?? '',
    end: event.end ?? '',
    academicGroupId: event.academicGroupId,
    academicGroupName: event.academicGroupName,
    academicSubgroupIds: event.academicSubgroupIds,
    academicSubgroupNames: event.academicSubgroupNames,
  });

  const openDownloadPrompt = () => setDownloadPromptVisible(true);

  const downloadQR = async (format: QRDownloadFormat) => {
    setDownloadPromptVisible(false);
    const pngDataUri = await getQRDataUri(qrRef.current);
    if (!pngDataUri) return;

    const fileName = safeFileName(`${event.eventCode}-${event.title || 'event-qr'}`);
    if (format === 'png') {
      downloadDataUri(pngDataUri, `${fileName}.png`);
      return;
    }

    if (format === 'svg') {
      const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">',
        `<image href="${pngDataUri}" width="240" height="240" />`,
        '</svg>',
      ].join('');
      downloadDataUri(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, `${fileName}.svg`);
      return;
    }

    const jpgDataUri = await pngToJpgDataUri(pngDataUri);
    downloadDataUri(jpgDataUri ?? pngDataUri, `${fileName}.jpg`);
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${event.attendees.length} attendees`}
        onPress={onPress}
        style={({ pressed }) => [styles.cardToggle, pressed && styles.pressedCard]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.grow}>
            <Text style={styles.cardTitle}>{event.title}</Text>
            <Text style={styles.meta}>{event.eventCode}</Text>
            <Text style={styles.meta}>Group: {event.academicGroupName || 'Not selected'}</Text>
            <Text style={styles.meta}>Subgroups: {event.academicSubgroupNames.length ? event.academicSubgroupNames.join(', ') : 'All subgroups'}</Text>
          </View>
          <View style={styles.countBox}>
            <Text style={styles.count}>{event.attendees.length}</Text>
            <Text style={styles.countLabel}>attended</Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusPill}>{status}</Text>
          <Text style={styles.meta}>{expanded ? 'Hide event QR and details' : 'Tap to show QR and attendees'}</Text>
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.qrPanel}>
            <Text style={styles.qrTitle}>Event QR</Text>
            <Text style={styles.qrMeta}>
              Students can scan this code during the valid event time. Hold or tap the QR to download.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Download QR code for ${event.title}`}
              onLongPress={openDownloadPrompt}
              onPress={openDownloadPrompt}
              style={({ pressed }) => [styles.qrBox, pressed && styles.pressedCard]}
            >
              <QRCode value={qrPayload} size={190} getRef={(ref) => { qrRef.current = ref; }} />
            </Pressable>
            <Text style={styles.meta}>Code: {event.eventCode}</Text>
            <Text style={styles.meta}>Group: {event.academicGroupName || 'Not selected'}</Text>
            <Text style={styles.meta}>Subgroups: {event.academicSubgroupNames.length ? event.academicSubgroupNames.join(', ') : 'All subgroups'}</Text>
            {event.start && event.end && (
              <Text style={styles.meta}>
                Valid {new Date(event.start).toLocaleString()} - {new Date(event.end).toLocaleString()}
              </Text>
            )}
          </View>

          <Modal
            animationType="fade"
            transparent
            visible={downloadPromptVisible}
            onRequestClose={() => setDownloadPromptVisible(false)}
          >
            <View style={styles.modalScrim}>
              <View style={styles.downloadSheet}>
                <Text style={styles.downloadTitle}>Download QR code</Text>
                <Text style={styles.downloadHint}>Choose an image format for this event QR.</Text>
                <View style={styles.downloadActions}>
                  <DownloadOption label="PNG" onPress={() => downloadQR('png')} />
                  <DownloadOption label="JPG" onPress={() => downloadQR('jpg')} />
                  <DownloadOption label="SVG" onPress={() => downloadQR('svg')} />
                </View>
                {Platform.OS !== 'web' && (
                  <Text style={styles.downloadHint}>Downloads are available when running this app in a browser.</Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDownloadPromptVisible(false)}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.pressedCard]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <View style={styles.attendeeList}>
            <Text style={styles.attendeeListTitle}>Attendees ({event.attendees.length})</Text>
            {event.attendees.length === 0 ? (
              <Text style={styles.meta}>No attendees yet.</Text>
            ) : (
              event.attendees.map((attendee) => (
                <View key={`${attendee.studentId}-${attendee.scannedAt}`} style={styles.attendee}>
                  <Text style={styles.attendeeName}>{attendee.studentName || `Student ...${attendee.studentId.slice(-8)}`}</Text>
                  <Text style={styles.meta}>{new Date(attendee.scannedAt).toLocaleString()}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function DownloadOption({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Download QR as ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.downloadButton, pressed && styles.pressedCard]}
    >
      <Text style={styles.downloadButtonText}>{label}</Text>
    </Pressable>
  );
}

function getQRDataUri(ref: QRRef | null) {
  return new Promise<string | null>((resolve) => {
    if (!ref?.toDataURL) {
      resolve(null);
      return;
    }

    ref.toDataURL((data) => resolve(`data:image/png;base64,${data}`));
  });
}

function downloadDataUri(dataUri: string, fileName: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const link = document.createElement('a');
  link.href = dataUri;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function pngToJpgDataUri(pngDataUri: string) {
  return new Promise<string | null>((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(null);
        return;
      }
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    image.onerror = () => resolve(null);
    image.src = pngDataUri;
  });
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'event-qr';
}

function getEventStatus(start: string | null, end: string | null) {
  const now = Date.now();
  const startTime = start ? new Date(start).getTime() : Number.NaN;
  const endTime = end ? new Date(end).getTime() : Number.NaN;
  if (!Number.isNaN(startTime) && now < startTime) return 'Upcoming';
  if (!Number.isNaN(endTime) && now > endTime) return 'Ended';
  return 'Active';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 120 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: COLORS.primary, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  center: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 28 },
  card: { backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 20, marginBottom: 14 },
  cardToggle: { borderRadius: 14 },
  pressedCard: { opacity: 0.76 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  grow: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  countBox: { minWidth: 72, borderRadius: 14, backgroundColor: COLORS.surface, padding: 8, alignItems: 'center' },
  count: { color: COLORS.primary, fontWeight: '800', fontSize: 20 },
  countLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  statusPill: { overflow: 'hidden', backgroundColor: COLORS.primarySoft, color: COLORS.primaryDark, fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  expandedContent: { marginTop: 14, gap: 14 },
  qrPanel: { alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  qrTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  qrMeta: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 10 },
  modalScrim: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', padding: 20 },
  downloadSheet: { width: '100%', maxWidth: 390, backgroundColor: COLORS.elevated, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 22, alignItems: 'center' },
  downloadTitle: { color: COLORS.textPrimary, fontSize: 21, fontWeight: '800' },
  downloadHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  downloadActions: { width: '100%', flexDirection: 'row', gap: 10 },
  downloadButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  downloadButtonText: { color: COLORS.textOnPrimary, fontSize: 14, fontWeight: '800' },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 18 },
  cancelButtonText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  attendeeList: { marginTop: 0 },
  attendeeListTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  attendee: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 },
  attendeeName: { color: COLORS.textPrimary, fontWeight: '600' },
});
