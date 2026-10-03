import { supabase } from './supabase';
import type { CloudEvent } from './events';
import type { Profile, ProfileRole } from './profiles';

export type AdminStats = {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalEvents: number;
  totalAttendance: number;
  recentEvents: CloudEvent[];
};

export type AdminUser = Pick<Profile, 'id' | 'email' | 'full_name' | 'role' | 'avatar_url' | 'academic_group_id' | 'academic_subgroup_id' | 'academic_assignment_change_count' | 'created_at'> & {
  academicGroupName: string | null;
  academicSubgroupName: string | null;
};

export type AdminEventAttendee = {
  attendanceId: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  scannedAt: string;
};

export type AdminEvent = CloudEvent & {
  creatorName: string | null;
  creatorEmail: string | null;
  academicGroupName: string | null;
  academicSubgroupNames: string[];
  attendeeCount: number;
  attendees: AdminEventAttendee[];
};

export type AdminAttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
  studentName: string | null;
  studentEmail: string | null;
  eventTitle: string | null;
  eventCode: string | null;
  academicGroupName: string | null;
  academicSubgroupNames: string[];
};

export async function getAdminStats(): Promise<AdminStats> {
  const [{ data: profiles }, { data: events }, { data: attendance }] = await Promise.all([
    supabase.from('profiles').select('id, role'),
    supabase.from('events').select('*').order('created_at', { ascending: false }),
    supabase.from('attendance').select('id'),
  ]);

  const users = profiles ?? [];
  const cloudEvents = (events ?? []) as CloudEvent[];

  return {
    totalUsers: users.length,
    totalStudents: users.filter((profile) => profile.role === 'student').length,
    totalTeachers: users.filter((profile) => profile.role === 'teacher').length,
    totalAdmins: users.filter((profile) => profile.role === 'admin').length,
    totalEvents: cloudEvents.length,
    totalAttendance: attendance?.length ?? 0,
    recentEvents: cloudEvents.slice(0, 5),
  };
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const [{ data, error }, { data: groups }, { data: subgroups }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, academic_group_id, academic_subgroup_id, academic_assignment_change_count, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('academic_groups').select('id, name'),
    supabase.from('academic_subgroups').select('id, name'),
  ]);

  if (error) return [];
  const groupNames = new Map((groups ?? []).map((group) => [group.id, group.name]));
  const subgroupNames = new Map((subgroups ?? []).map((subgroup) => [subgroup.id, subgroup.name]));
  return (data ?? []).map((profile) => ({
    ...(profile as Pick<Profile, 'id' | 'email' | 'full_name' | 'role' | 'avatar_url' | 'academic_group_id' | 'academic_subgroup_id' | 'academic_assignment_change_count' | 'created_at'>),
    academicGroupName: profile.academic_group_id ? groupNames.get(profile.academic_group_id) ?? null : null,
    academicSubgroupName: profile.academic_subgroup_id ? subgroupNames.get(profile.academic_subgroup_id) ?? null : null,
  }));
}

export async function updateUserRole(userId: string, role: Exclude<ProfileRole, 'admin'>) {
  return supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function updateUserAcademicAssignment(
  userId: string,
  academicGroupId: string,
  academicSubgroupId: string | null
) {
  return supabase
    .from('profiles')
    .update({
      academic_group_id: academicGroupId,
      academic_subgroup_id: academicSubgroupId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

export async function getAdminEvents(): Promise<AdminEvent[]> {
  const [{ data: events, error }, { data: profiles }, { data: attendance }, { data: groups }, { data: subgroups }] = await Promise.all([
    supabase.from('events').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, email, full_name'),
    supabase.from('attendance').select('id, student_id, event_id, scanned_at').order('scanned_at', { ascending: false }),
    supabase.from('academic_groups').select('id, name'),
    supabase.from('academic_subgroups').select('id, name'),
  ]);

  if (error) return [];

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const groupNames = new Map((groups ?? []).map((group) => [group.id, group.name]));
  const subgroupNames = new Map((subgroups ?? []).map((subgroup) => [subgroup.id, subgroup.name]));
  const attendanceByEvent = new Map<string, AdminEventAttendee[]>();

  (attendance ?? []).forEach((row) => {
    const student = profileMap.get(row.student_id);
    const current = attendanceByEvent.get(row.event_id) ?? [];
    current.push({
      attendanceId: row.id,
      studentId: row.student_id,
      studentName: student?.full_name ?? null,
      studentEmail: student?.email ?? null,
      scannedAt: row.scanned_at,
    });
    attendanceByEvent.set(row.event_id, current);
  });

  return ((events ?? []) as CloudEvent[]).map((event) => {
    const creator = event.created_by ? profileMap.get(event.created_by) : undefined;
    const attendees = attendanceByEvent.get(event.id) ?? [];
    return {
      ...event,
      creatorName: creator?.full_name ?? null,
      creatorEmail: creator?.email ?? null,
      academicGroupName: groupNames.get(event.academic_group_id) ?? null,
      academicSubgroupNames: ((event.academic_subgroup_ids ?? []) as string[]).map((id) => subgroupNames.get(id)).filter(Boolean) as string[],
      attendeeCount: attendees.length,
      attendees,
    };
  });
}

export async function deleteAdminEvent(eventId: string) {
  return supabase.from('events').delete().eq('id', eventId);
}

export async function getAdminAttendance(): Promise<AdminAttendanceRow[]> {
  const [attendanceResult, profilesResult, eventsResult, groupsResult, subgroupsResult] = await Promise.all([
    supabase.from('attendance').select('id, student_id, event_id, scanned_at').order('scanned_at', { ascending: false }),
    supabase.from('profiles').select('id, email, full_name'),
    supabase.from('events').select('id, event_code, title, academic_group_id, academic_subgroup_ids'),
    supabase.from('academic_groups').select('id, name'),
    supabase.from('academic_subgroups').select('id, name'),
  ]);

  let events = eventsResult.data;
  if (eventsResult.error) {
    const fallback = await supabase.from('events').select('id, event_code, title, academic_group_id');
    events = fallback.data?.map((event) => ({ ...event, academic_subgroup_ids: [] })) ?? null;
  }

  if (attendanceResult.error) return [];

  const profileMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const eventMap = new Map((events ?? []).map((event) => [event.id, event]));
  const groupNames = new Map((groupsResult.data ?? []).map((group) => [group.id, group.name]));
  const subgroupNames = new Map((subgroupsResult.data ?? []).map((subgroup) => [subgroup.id, subgroup.name]));

  return (attendanceResult.data ?? []).map((row) => {
    const profile = profileMap.get(row.student_id);
    const event = eventMap.get(row.event_id);
    return {
      id: row.id,
      student_id: row.student_id,
      event_id: row.event_id,
      scanned_at: row.scanned_at,
      studentName: profile?.full_name ?? null,
      studentEmail: profile?.email ?? null,
      eventTitle: event?.title ?? null,
      eventCode: event?.event_code ?? null,
      academicGroupName: event?.academic_group_id ? groupNames.get(event.academic_group_id) ?? null : null,
      academicSubgroupNames: ((event?.academic_subgroup_ids ?? []) as string[]).map((id) => subgroupNames.get(id)).filter(Boolean) as string[],
    };
  });
}

export async function deleteAdminAttendance(attendanceId: string) {
  return supabase.from('attendance').delete().eq('id', attendanceId);
}
