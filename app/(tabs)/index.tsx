import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { AppScreen, MetricTile, SectionHeader, Surface } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { getAdminStats, type AdminStats } from '@/lib/admin';
import {
  getStudentDashboardStats,
  getTeacherDashboardStats,
  type StudentDashboardStats,
  type TeacherDashboardStats,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

const emptyTeacherStats: TeacherDashboardStats = { totalEvents: 0, totalAttendees: 0, averageAttendance: 0, topEvents: [] };
const emptyStudentStats: StudentDashboardStats = { attendedCount: 0, missedCount: 0, totalEndedEvents: 0, recentRecords: [] };
const emptyAdminStats: AdminStats = {
  totalUsers: 0,
  totalStudents: 0,
  totalTeachers: 0,
  totalAdmins: 0,
  totalEvents: 0,
  totalAttendance: 0,
  recentEvents: [],
};

export default function Index() {
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [teacherStats, setTeacherStats] = useState<TeacherDashboardStats>(emptyTeacherStats);
  const [studentStats, setStudentStats] = useState<StudentDashboardStats>(emptyStudentStats);
  const [adminStats, setAdminStats] = useState<AdminStats>(emptyAdminStats);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const profileRole = (await getProfile(user.id))?.role ?? 'student';
      if (!active) return;
      setRole(profileRole);

      if (profileRole === 'admin') {
        const stats = await getAdminStats();
        if (active) setAdminStats(stats);
      } else if (profileRole === 'teacher') {
        const stats = await getTeacherDashboardStats(user.id);
        if (active) setTeacherStats(stats);
      } else {
        const stats = await getStudentDashboardStats(user.id);
        if (active) setStudentStats(stats);
      }

      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user]));

  const label = role === 'admin' ? 'Admin command center' : role === 'teacher' ? 'Teacher workspace' : 'Student check-in';

  return (
    <AppScreen>
      <SectionHeader eyebrow={label.toUpperCase()} title="Today" />

      {!role || loading ? (
        <Surface style={styles.loadingCard}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Preparing your workspace...</Text>
        </Surface>
      ) : role === 'admin' ? (
        <AdminHome stats={adminStats} />
      ) : role === 'teacher' ? (
        <TeacherHome stats={teacherStats} />
      ) : (
        <StudentHome stats={studentStats} />
      )}
    </AppScreen>
  );
}

function StudentHome({ stats }: { stats: StudentDashboardStats }) {
  const completion = stats.totalEndedEvents ? Math.round((stats.attendedCount / stats.totalEndedEvents) * 100) : 0;

  return (
    <>
      <Surface elevated style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialIcons name="qr-code-scanner" color={COLORS.textOnPrimary} size={30} />
        </View>
        <AppButton compact theme="primary" title="Scan Now" icon="qr-code-scanner" onPress={() => router.push('/scan')} />
      </Surface>

      <View style={styles.metricGrid}>
        <MetricTile icon="check-circle" label="Attended" value={stats.attendedCount} tone="success" />
        <MetricTile icon="cancel" label="Missed" value={stats.missedCount} tone={stats.missedCount ? 'danger' : 'neutral'} />
        <MetricTile icon="percent" label="Completion" value={`${completion}%`} />
      </View>

      <Surface>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelKicker}>RECENT ACTIVITY</Text>
            <Text style={styles.panelTitle}>Latest check-ins</Text>
          </View>
          <AppButton compact theme="ghost" title="History" icon="history" onPress={() => router.push('/history')} />
        </View>
        {stats.recentRecords.length === 0 ? (
          <EmptyInline text="No check-ins" />
        ) : (
          stats.recentRecords.map((record) => (
            <ActivityRow
              key={record.id}
              icon="school"
              title={record.eventTitle || 'Untitled event'}
              meta={`${record.academicGroupName || 'No group'} · ${new Date(record.scannedAt).toLocaleString()}`}
            />
          ))
        )}
      </Surface>
    </>
  );
}

function TeacherHome({ stats }: { stats: TeacherDashboardStats }) {
  const maxCount = Math.max(1, ...stats.topEvents.map((event) => event.attendeeCount));

  return (
    <>
      <Surface elevated style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialIcons name="event-note" color={COLORS.textOnPrimary} size={30} />
        </View>
        <AppButton compact theme="primary" title="Create Event" icon="add-circle" onPress={() => router.push('/teacher')} />
      </Surface>

      <View style={styles.metricGrid}>
        <MetricTile icon="event-note" label="Events" value={stats.totalEvents} />
        <MetricTile icon="groups" label="Attendees" value={stats.totalAttendees} tone="success" />
        <MetricTile icon="bar-chart" label="Avg. per event" value={stats.averageAttendance} tone="neutral" />
      </View>

      <Surface>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelKicker}>ATTENDANCE MOMENTUM</Text>
            <Text style={styles.panelTitle}>Top events</Text>
          </View>
          <AppButton compact theme="ghost" title="Attendance" icon="history" onPress={() => router.push('/history')} />
        </View>
        {stats.topEvents.length === 0 ? (
          <EmptyInline text="No attendance" />
        ) : (
          stats.topEvents.map((event) => (
            <View key={event.eventId} style={styles.chartRow}>
              <View style={styles.chartCopy}>
                <Text style={styles.chartLabel} numberOfLines={1}>{event.title}</Text>
                <Text style={styles.chartMeta}>
                  {event.eventCode} · {event.academicGroupName || 'No group'} · {event.academicSubgroupNames.length ? event.academicSubgroupNames.join(', ') : 'All'}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(8, (event.attendeeCount / maxCount) * 100)}%` }]} />
              </View>
              <Text style={styles.chartValue}>{event.attendeeCount}</Text>
            </View>
          ))
        )}
      </Surface>
    </>
  );
}

function AdminHome({ stats }: { stats: AdminStats }) {
  return (
    <>
      <Surface elevated style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialIcons name="admin-panel-settings" color={COLORS.textOnPrimary} size={30} />
        </View>
        <AppButton compact theme="primary" title="Manage" icon="manage-search" onPress={() => router.push('/admin')} />
      </Surface>

      <View style={styles.metricGrid}>
        <MetricTile icon="groups" label="Users" value={stats.totalUsers} />
        <MetricTile icon="school" label="Students" value={stats.totalStudents} tone="neutral" />
        <MetricTile icon="badge" label="Teachers" value={stats.totalTeachers} tone="neutral" />
        <MetricTile icon="event-note" label="Events" value={stats.totalEvents} />
        <MetricTile icon="fact-check" label="Attendance" value={stats.totalAttendance} tone="success" />
        <MetricTile icon="admin-panel-settings" label="Admins" value={stats.totalAdmins} tone="warning" />
      </View>

      <Surface>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelKicker}>RECENT EVENTS</Text>
            <Text style={styles.panelTitle}>System activity</Text>
          </View>
          <AppButton compact theme="ghost" title="Open Admin" icon="chevron-right" onPress={() => router.push('/admin')} />
        </View>
        {stats.recentEvents.length === 0 ? (
          <EmptyInline text="No events" />
        ) : (
          stats.recentEvents.map((event) => (
            <Pressable key={event.id} accessibilityRole="button" onPress={() => router.push('/admin')} style={({ pressed }) => [pressed && styles.pressed]}>
              <ActivityRow icon="event-note" title={event.title || 'Untitled event'} meta={event.event_code} />
            </Pressable>
          ))
        )}
      </Surface>
    </>
  );
}

function ActivityRow({ icon, title, meta }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; meta: string }) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}>
        <MaterialIcons name={icon} color={COLORS.primary} size={20} />
      </View>
      <View style={styles.activityCopy}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityMeta}>{meta}</Text>
      </View>
    </View>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <Text style={styles.emptyInline}>{text}</Text>;
}

const styles = StyleSheet.create({
  loadingCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '800' },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.lg, backgroundColor: COLORS.card },
  heroIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  panelKicker: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  panelTitle: { color: COLORS.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: '900', marginTop: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.divider },
  activityIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  activityMeta: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.divider },
  chartCopy: { width: 120, minWidth: 0 },
  chartLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '900' },
  chartMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  barTrack: { flex: 1, height: 12, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: COLORS.primary },
  chartValue: { width: 30, textAlign: 'right', color: COLORS.textPrimary, fontSize: 14, fontWeight: '900' },
  emptyInline: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', paddingVertical: 22 },
  pressed: { opacity: 0.72 },
});
