import { supabase } from './supabase';

export type ProfileRole = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  avatar_url: string | null;
  academic_group_id: string | null;
  academic_subgroup_id: string | null;
  academic_assignment_change_count: number;
  academic_assignment_changed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'academic_group_id' | 'academic_subgroup_id'>>
) {
  return supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function updateProfileAvatar(userId: string, avatarUrl: string | null) {
  return updateProfile(userId, { avatar_url: avatarUrl });
}

export async function updateProfileAcademicGroup(userId: string, academicGroupId: string) {
  return updateProfile(userId, { academic_group_id: academicGroupId, academic_subgroup_id: null });
}

export async function updateProfileAcademicSubgroup(userId: string, academicSubgroupId: string | null) {
  return updateProfile(userId, { academic_subgroup_id: academicSubgroupId });
}

export async function updateProfileAcademicAssignment(
  userId: string,
  academicGroupId: string,
  academicSubgroupId: string | null
) {
  return updateProfile(userId, {
    academic_group_id: academicGroupId,
    academic_subgroup_id: academicSubgroupId,
  });
}
