import { getEventByCode } from './events';
import { parseQRPayload } from './qr';
import { supabase } from './supabase';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  academicGroupName: string | null;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
  scannedAt?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  start: string | null;
  end: string | null;
  academicGroupId: string;
  academicGroupName: string | null;
  academicSubgroupId: string | null;
  academicSubgroupName: string | null;
  academicSubgroupIds: string[];
  academicSubgroupNames: string[];
  attendees: Array<{
    studentId: string;
    studentName: string | null;
    scannedAt: string;
  }>;
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  academicGroupName: string | null;
  academicSubgroupName: string | null;
  academicSubgroupNames: string[];
  attendeeCount: number;
};

export type TeacherDashboardStats = {
  totalEvents: number;
  totalAttendees: number;
  averageAttendance: number;
  topEvents: TeacherEventSummary[];
};

export type StudentDashboardStats = {
  attendedCount: number;
  missedCount: number;
  totalEndedEvents: number;
  recentRecords: AttendanceRecord[];
};

export async function registerAttendance(rawPayload: string): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const payload = parsed.payload;

  if (!payload.start || !payload.end) {
    return { success: false, message: 'Invalid QR code.' };
  }

  const startTime = new Date(payload.start).getTime();
  const endTime = new Date(payload.end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return { success: false, message: 'Invalid date format.' };
  }

  const now = Date.now();
  if (now < startTime) return { success: false, message: 'Event has not started yet.' };
  if (now > endTime) return { success: false, message: 'Event has already ended.' };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { success: false, message: 'You must be signed in.' };
  }

  let event = await getEventByCode(payload.event);
  if (!event) return { success: false, message: 'Event not found. Ask the teacher to create a new QR code.' };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('academic_group_id, academic_subgroup_id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError || !profile?.academic_group_id) {
    return { success: false, message: 'Choose your course or grade level before scanning.' };
  }
  if (profile.academic_group_id !== event.academic_group_id) {
    return { success: false, message: 'This QR code is for a different course or grade level.' };
  }
  const eventSubgroupIds = event.academic_subgroup_ids ?? (event.academic_subgroup_id ? [event.academic_subgroup_id] : []);
  if (eventSubgroupIds.length > 0 && (!profile.academic_subgroup_id || !eventSubgroupIds.includes(profile.academic_subgroup_id))) {
    return { success: false, message: 'This QR code is for a different subgroup.' };
  }

  const { error } = await supabase.from('attendance').insert({
    student_id: authData.user.id,
    event_id: event.id,
  });

  if (error?.code === '23505') {
    return { success: false, message: 'Already registered for this event.' };
  }
  if (error) return { success: false, message: 'Could not record attendance.' };

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
    scannedAt: new Date().toISOString(),
  };
}

export async function getAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, event_id, events ( title, academic_groups ( name ) )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });
  if (error) return [];

  return (data ?? []).map((row: any) => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle: Array.isArray(row.events) ? row.events[0]?.title : row.events?.title,
    academicGroupName: Array.isArray(row.events)
      ? row.events[0]?.academic_groups?.name ?? null
      : row.events?.academic_groups?.name ?? null,
    scannedAt: row.scanned_at,
  }));
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, academic_group_id, academic_subgroup_id, academic_subgroup_ids')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  if (eventsError || !events?.length) return [];

  const eventIds = events.map((event) => event.id);
  const groupIds = [...new Set(events.map((event) => event.academic_group_id).filter(Boolean))];
  const subgroupIds = [
    ...new Set(events.flatMap((event) => event.academic_subgroup_ids?.length ? event.academic_subgroup_ids : event.academic_subgroup_id ? [event.academic_subgroup_id] : [])),
  ];
  const [{ data: attendance, error: attendanceError }, { data: groups }, { data: subgroups }] = await Promise.all([
    supabase
      .from('attendance')
      .select('student_id, scanned_at, event_id')
      .in('event_id', eventIds)
      .order('scanned_at', { ascending: false }),
    groupIds.length
      ? supabase.from('academic_groups').select('id, name').in('id', groupIds)
      : { data: [] as Array<{ id: string; name: string }> },
    subgroupIds.length
      ? supabase.from('academic_subgroups').select('id, name').in('id', subgroupIds)
      : { data: [] as Array<{ id: string; name: string }> },
  ]);
  if (attendanceError) return [];

  const studentIds = [...new Set((attendance ?? []).map((row) => row.student_id))];
  const { data: profiles } = studentIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const groupNames = new Map((groups ?? []).map((group) => [group.id, group.name]));
  const subgroupNames = new Map((subgroups ?? []).map((subgroup) => [subgroup.id, subgroup.name]));

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    start: event.start_time,
    end: event.end_time,
    academicGroupId: event.academic_group_id,
    academicGroupName: groupNames.get(event.academic_group_id) ?? null,
    academicSubgroupId: event.academic_subgroup_id,
    academicSubgroupName: event.academic_subgroup_id ? subgroupNames.get(event.academic_subgroup_id) ?? null : null,
    academicSubgroupIds: event.academic_subgroup_ids ?? [],
    academicSubgroupNames: ((event.academic_subgroup_ids ?? []) as string[]).map((id) => subgroupNames.get(id)).filter(Boolean) as string[],
    attendees: (attendance ?? [])
      .filter((row) => row.event_id === event.id)
      .map((row) => ({
        studentId: row.student_id,
        studentName: names.get(row.student_id) ?? null,
        scannedAt: row.scanned_at,
      })),
  }));
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title, academic_group_id, academic_subgroup_id, academic_subgroup_ids')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  if (eventsError || !events?.length) return [];

  const eventIds = events.map((event) => event.id);
  const groupIds = [...new Set(events.map((event) => event.academic_group_id).filter(Boolean))];
  const subgroupIds = [
    ...new Set(events.flatMap((event) => event.academic_subgroup_ids?.length ? event.academic_subgroup_ids : event.academic_subgroup_id ? [event.academic_subgroup_id] : [])),
  ];
  const [{ data: rows, error }, { data: groups }, { data: subgroups }] = await Promise.all([
    supabase
      .from('attendance')
      .select('event_id')
      .in('event_id', eventIds),
    groupIds.length
      ? supabase.from('academic_groups').select('id, name').in('id', groupIds)
      : { data: [] as Array<{ id: string; name: string }> },
    subgroupIds.length
      ? supabase.from('academic_subgroups').select('id, name').in('id', subgroupIds)
      : { data: [] as Array<{ id: string; name: string }> },
  ]);
  if (error) return [];

  const counts: Record<string, number> = {};
  (rows ?? []).forEach((row) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });
  const groupNames = new Map((groups ?? []).map((group) => [group.id, group.name]));
  const subgroupNames = new Map((subgroups ?? []).map((subgroup) => [subgroup.id, subgroup.name]));

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    academicGroupName: groupNames.get(event.academic_group_id) ?? null,
    academicSubgroupName: event.academic_subgroup_id ? subgroupNames.get(event.academic_subgroup_id) ?? null : null,
    academicSubgroupNames: ((event.academic_subgroup_ids ?? []) as string[]).map((id) => subgroupNames.get(id)).filter(Boolean) as string[],
    attendeeCount: counts[event.id] ?? 0,
  }));
}

export async function getTeacherDashboardStats(
  teacherId: string
): Promise<TeacherDashboardStats> {
  const events = await getTeacherEventSummary(teacherId);
  const totalAttendees = events.reduce((sum, event) => sum + event.attendeeCount, 0);
  const topEvents = [...events]
    .sort((a, b) => b.attendeeCount - a.attendeeCount)
    .slice(0, 5);

  return {
    totalEvents: events.length,
    totalAttendees,
    averageAttendance: events.length ? Math.round(totalAttendees / events.length) : 0,
    topEvents,
  };
}

export async function getStudentDashboardStats(
  studentId: string
): Promise<StudentDashboardStats> {
  const recentRecords = await getAttendanceHistory(studentId);
  const attendedEventIds = new Set(recentRecords.map((record) => record.eventId));

  const { data: profile } = await supabase
    .from('profiles')
    .select('academic_group_id, academic_subgroup_id')
    .eq('id', studentId)
    .maybeSingle();

  if (!profile?.academic_group_id) {
    return {
      attendedCount: attendedEventIds.size,
      missedCount: 0,
      totalEndedEvents: 0,
      recentRecords: recentRecords.slice(0, 3),
    };
  }

  const { data: endedEvents, error } = await supabase
    .from('events')
    .select('id, academic_subgroup_id, academic_subgroup_ids')
    .eq('academic_group_id', profile.academic_group_id)
    .not('end_time', 'is', null)
    .lt('end_time', new Date().toISOString());

  const totalEndedEvents = error ? attendedEventIds.size : (endedEvents ?? []).length;
  const relevantEndedEvents = (endedEvents ?? []).filter((event) => {
    const targetSubgroupIds = event.academic_subgroup_ids?.length
      ? event.academic_subgroup_ids
      : event.academic_subgroup_id
        ? [event.academic_subgroup_id]
        : [];
    if (!targetSubgroupIds.length) return true;
    return !!profile.academic_subgroup_id && targetSubgroupIds.includes(profile.academic_subgroup_id);
  });
  const relevantTotal = error ? attendedEventIds.size : relevantEndedEvents.length;
  const missedCount = error
    ? 0
    : relevantEndedEvents.filter((event) => !attendedEventIds.has(event.id)).length;

  return {
    attendedCount: attendedEventIds.size,
    missedCount,
    totalEndedEvents: relevantTotal,
    recentRecords: recentRecords.slice(0, 3),
  };
}
