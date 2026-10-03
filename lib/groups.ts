import { supabase } from './supabase';

export type AcademicGroup = {
  id: string;
  name: string;
  icon_name: string;
  icon_color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AcademicSubgroup = {
  id: string;
  academic_group_id: string;
  name: string;
  icon_name: string;
  icon_color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AcademicStyleInput = {
  iconName: string;
  iconColor: string;
};

export async function getAcademicGroups(): Promise<AcademicGroup[]> {
  const { data, error } = await supabase
    .from('academic_groups')
    .select('*')
    .order('name', { ascending: true });

  return error ? [] : ((data ?? []) as AcademicGroup[]);
}

export async function getAcademicSubgroups(): Promise<AcademicSubgroup[]> {
  const { data, error } = await supabase
    .from('academic_subgroups')
    .select('*')
    .order('name', { ascending: true });

  return error ? [] : ((data ?? []) as AcademicSubgroup[]);
}

export async function createAcademicGroup(name: string, style?: AcademicStyleInput) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { data: null, error: authError ?? new Error('You must be signed in.') };
  }

  return supabase
    .from('academic_groups')
    .insert({
      name: name.trim(),
      icon_name: style?.iconName ?? 'school',
      icon_color: style?.iconColor ?? '#2563EB',
      created_by: authData.user.id,
    })
    .select('*')
    .single();
}

export async function updateAcademicGroup(groupId: string, name: string, style?: AcademicStyleInput) {
  return supabase
    .from('academic_groups')
    .update({
      name: name.trim(),
      ...(style ? { icon_name: style.iconName, icon_color: style.iconColor } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId);
}

export async function deleteAcademicGroup(groupId: string) {
  const { data: groups, error: groupsError } = await supabase
    .from('academic_groups')
    .select('id, name')
    .order('name', { ascending: true });

  if (groupsError) return { data: null, error: groupsError };

  const fallback = (groups ?? []).find((group) => group.id !== groupId && group.name === 'General')
    ?? (groups ?? []).find((group) => group.id !== groupId);

  if (!fallback) {
    return { data: null, error: new Error('Create another group before deleting the last group.') };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ academic_group_id: fallback.id, academic_subgroup_id: null, updated_at: new Date().toISOString() })
    .eq('academic_group_id', groupId);
  if (profileError) return { data: null, error: profileError };

  const { error: eventError } = await supabase
    .from('events')
    .update({ academic_group_id: fallback.id, academic_subgroup_id: null, academic_subgroup_ids: [] })
    .eq('academic_group_id', groupId);
  if (eventError) return { data: null, error: eventError };

  return supabase.from('academic_groups').delete().eq('id', groupId);
}

export async function createAcademicSubgroup(academicGroupId: string, name: string, style?: AcademicStyleInput) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { data: null, error: authError ?? new Error('You must be signed in.') };
  }

  return supabase
    .from('academic_subgroups')
    .insert({
      academic_group_id: academicGroupId,
      name: name.trim(),
      icon_name: style?.iconName ?? 'category',
      icon_color: style?.iconColor ?? '#2563EB',
      created_by: authData.user.id,
    })
    .select('*')
    .single();
}

export async function updateAcademicSubgroup(subgroupId: string, name: string, style?: AcademicStyleInput) {
  return supabase
    .from('academic_subgroups')
    .update({
      name: name.trim(),
      ...(style ? { icon_name: style.iconName, icon_color: style.iconColor } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subgroupId);
}

export async function deleteAcademicSubgroup(subgroupId: string) {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ academic_subgroup_id: null, updated_at: new Date().toISOString() })
    .eq('academic_subgroup_id', subgroupId);
  if (profileError) return { data: null, error: profileError };

  let { data: events, error: readEventsError } = await supabase
    .from('events')
    .select('id, academic_subgroup_id, academic_subgroup_ids');
  if (readEventsError) {
    const fallback = await supabase
      .from('events')
      .select('id, academic_subgroup_id');
    events = fallback.data?.map((event) => ({ ...event, academic_subgroup_ids: [] })) ?? null;
    readEventsError = fallback.error;
  }
  if (readEventsError) return { data: null, error: readEventsError };

  const affectedEvents = (events ?? []).filter((event) => {
    const subgroupIds = ((event.academic_subgroup_ids ?? []) as string[]);
    return event.academic_subgroup_id === subgroupId || subgroupIds.includes(subgroupId);
  });

  const eventUpdates = await Promise.all(
    affectedEvents.map((event) =>
      supabase
        .from('events')
        .update({
          academic_subgroup_id: event.academic_subgroup_id === subgroupId ? null : event.academic_subgroup_id,
          academic_subgroup_ids: ((event.academic_subgroup_ids ?? []) as string[]).filter((id) => id !== subgroupId),
        })
        .eq('id', event.id)
    )
  );
  const eventError = eventUpdates.find((result) => result.error)?.error;
  if (eventError) return { data: null, error: eventError };

  return supabase.from('academic_subgroups').delete().eq('id', subgroupId);
}
