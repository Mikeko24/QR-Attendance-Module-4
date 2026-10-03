import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { COLORS } from '@/constants/colors';
import {
  deleteAdminEvent,
  deleteAdminAttendance,
  getAdminAttendance,
  getAdminEvents,
  getAdminUsers,
  updateUserRole,
  updateUserAcademicAssignment,
  type AdminAttendanceRow,
  type AdminEvent,
  type AdminUser,
} from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { buildQRPayload } from '@/lib/qr';
import {
  createAcademicGroup,
  createAcademicSubgroup,
  deleteAcademicGroup,
  deleteAcademicSubgroup,
  getAcademicGroups,
  getAcademicSubgroups,
  updateAcademicGroup,
  updateAcademicSubgroup,
  type AcademicGroup,
  type AcademicSubgroup,
} from '@/lib/groups';
import { getProfile, type ProfileRole } from '@/lib/profiles';

type AdminView = 'users' | 'events' | 'attendance' | 'groups';
type QRRef = {
  toDataURL?: (callback: (data: string) => void) => void;
};
type QRDownloadFormat = 'png' | 'jpg' | 'svg';
type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

const ICON_OPTIONS: MaterialIconName[] = ['school', 'category', 'business', 'computer', 'science', 'menu-book', 'psychology', 'sports', 'palette', 'groups'];
const COLOR_OPTIONS = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#4F46E5', '#DB2777'];

function formatAdminDateTime(value: string | null | undefined) {
  if (!value) return 'No date';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAdminDateRange(start: string | null | undefined, end: string | null | undefined) {
  return `${formatAdminDateTime(start)} - ${formatAdminDateTime(end)}`;
}

function IconStylePicker({
  color,
  icon,
  onColorChange,
  onIconChange,
}: {
  color: string;
  icon: MaterialIconName;
  onColorChange: (color: string) => void;
  onIconChange: (icon: MaterialIconName) => void;
}) {
  return (
    <View style={styles.stylePicker}>
      <Text style={styles.stylePickerLabel}>Icon</Text>
      <View style={styles.iconGrid}>
        {ICON_OPTIONS.map((option) => {
          const active = option === icon;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Use ${option} icon`}
              onPress={() => onIconChange(option)}
              style={({ pressed }) => [styles.iconChoice, active && styles.iconChoiceActive, pressed && styles.pressed]}
            >
              <MaterialIcons name={option} color={active ? COLORS.textOnPrimary : color} size={20} />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.stylePickerLabel}>Color</Text>
      <View style={styles.colorGrid}>
        {COLOR_OPTIONS.map((option) => {
          const active = option === color;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Use ${option} color`}
              onPress={() => onColorChange(option)}
              style={({ pressed }) => [styles.colorChoice, { backgroundColor: option }, active && styles.colorChoiceActive, pressed && styles.pressed]}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [view, setView] = useState<AdminView>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [attendance, setAttendance] = useState<AdminAttendanceRow[]>([]);
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [subgroups, setSubgroups] = useState<AcademicSubgroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState<MaterialIconName>('school');
  const [newGroupColor, setNewGroupColor] = useState(COLOR_OPTIONS[0]);
  const [newSubgroupIcon, setNewSubgroupIcon] = useState<MaterialIconName>('category');
  const [newSubgroupColor, setNewSubgroupColor] = useState(COLOR_OPTIONS[0]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupIcon, setEditingGroupIcon] = useState<MaterialIconName>('school');
  const [editingGroupColor, setEditingGroupColor] = useState(COLOR_OPTIONS[0]);
  const [editingSubgroupId, setEditingSubgroupId] = useState<string | null>(null);
  const [editingSubgroupName, setEditingSubgroupName] = useState('');
  const [editingSubgroupIcon, setEditingSubgroupIcon] = useState<MaterialIconName>('category');
  const [editingSubgroupColor, setEditingSubgroupColor] = useState(COLOR_OPTIONS[0]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [actionGroupId, setActionGroupId] = useState<string | null>(null);
  const [subgroupModalVisible, setSubgroupModalVisible] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserGroupId, setEditingUserGroupId] = useState<string | null>(null);
  const [editingUserSubgroupId, setEditingUserSubgroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const profileRole = (await getProfile(user.id))?.role ?? 'student';
    setRole(profileRole);
    if (profileRole === 'admin') {
      const [nextUsers, nextEvents, nextAttendance, nextGroups, nextSubgroups] = await Promise.all([
        getAdminUsers(),
        getAdminEvents(),
        getAdminAttendance(),
        getAcademicGroups(),
        getAcademicSubgroups(),
      ]);
      setUsers(nextUsers);
      setEvents(nextEvents);
      setAttendance(nextAttendance);
      setGroups(nextGroups);
      setSubgroups(nextSubgroups);
      setSelectedEventId((current) => current && nextEvents.some((event) => event.id === current) ? current : null);
      setSelectedGroupId((current) => current && nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id ?? null);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    if (!message) return;
    const timeoutId = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(timeoutId);
  }, [message]);

  const actionGroup = actionGroupId ? groups.find((group) => group.id === actionGroupId) ?? null : null;
  const selectedGroup = selectedGroupId ? groups.find((group) => group.id === selectedGroupId) ?? null : null;
  const selectedSubgroups = selectedGroupId
    ? subgroups.filter((subgroup) => subgroup.academic_group_id === selectedGroupId)
    : [];

  const changeRole = async (target: AdminUser, nextRole: 'student' | 'teacher') => {
    setMessage(null);
    const { error } = await updateUserRole(target.id, nextRole);
    if (error) {
      setMessage(error.message);
      return;
    }
    setUsers((current) => current.map((item) => (item.id === target.id ? { ...item, role: nextRole } : item)));
    setMessage(`${target.email} is now a ${nextRole}.`);
  };

  const beginEditUserAssignment = (target: AdminUser) => {
    setEditingUserId(target.id);
    setEditingUserGroupId(target.academic_group_id);
    setEditingUserSubgroupId(target.academic_subgroup_id);
  };

  const saveUserAssignment = async (target: AdminUser) => {
    if (!editingUserGroupId) {
      setMessage('Select a group before saving.');
      return;
    }
    const allowedSubgroups = subgroups.filter((subgroup) => subgroup.academic_group_id === editingUserGroupId);
    const safeSubgroupId = allowedSubgroups.some((subgroup) => subgroup.id === editingUserSubgroupId) ? editingUserSubgroupId : null;
    setMessage(null);
    const { error } = await updateUserAcademicAssignment(target.id, editingUserGroupId, safeSubgroupId);
    if (error) {
      setMessage(error.message);
      return;
    }
    const groupName = groups.find((group) => group.id === editingUserGroupId)?.name ?? null;
    const subgroupName = safeSubgroupId ? subgroups.find((subgroup) => subgroup.id === safeSubgroupId)?.name ?? null : null;
    setUsers((current) => current.map((item) => item.id === target.id
      ? {
          ...item,
          academic_group_id: editingUserGroupId,
          academic_subgroup_id: safeSubgroupId,
          academicGroupName: groupName,
          academicSubgroupName: subgroupName,
        }
      : item
    ));
    setEditingUserId(null);
    setEditingUserGroupId(null);
    setEditingUserSubgroupId(null);
    setMessage(`${target.email} academic group updated.`);
  };

  const removeEvent = async (event: AdminEvent) => {
    const runDelete = async () => {
      setMessage(null);
      const { error } = await deleteAdminEvent(event.id);
      if (error) {
        setMessage(error.message);
        return;
      }
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setAttendance((current) => current.filter((item) => item.event_id !== event.id));
      setSelectedEventId((current) => (current === event.id ? null : current));
      setMessage(`${event.title} was deleted.`);
    };

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Delete "${event.title}" and its attendance records?`)) void runDelete();
      return;
    }

    Alert.alert('Delete event?', `Delete "${event.title}" and its attendance records?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: runDelete },
    ]);
  };

  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) ?? null : null;

  const addGroup = async () => {
    if (!newGroupName.trim()) {
      setMessage('Enter a course or grade level name.');
      return;
    }
    setMessage(null);
    const { data, error } = await createAcademicGroup(newGroupName, { iconName: newGroupIcon, iconColor: newGroupColor });
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data) setGroups((current) => [...current, data as AcademicGroup].sort((a, b) => a.name.localeCompare(b.name)));
    setNewGroupName('');
    setNewGroupIcon('school');
    setNewGroupColor(COLOR_OPTIONS[0]);
    setMessage('Course or grade level created.');
  };

  const beginEditGroup = (group: AcademicGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingGroupIcon((group.icon_name || 'school') as MaterialIconName);
    setEditingGroupColor(group.icon_color || COLOR_OPTIONS[0]);
    setActionGroupId(null);
  };

  const saveGroup = async () => {
    if (!editingGroupId || !editingGroupName.trim()) {
      setMessage('Enter a course or grade level name.');
      return;
    }
    setMessage(null);
    const { error } = await updateAcademicGroup(editingGroupId, editingGroupName, { iconName: editingGroupIcon, iconColor: editingGroupColor });
    if (error) {
      setMessage(error.message);
      return;
    }
    setGroups((current) =>
      current
        .map((group) => group.id === editingGroupId ? { ...group, name: editingGroupName.trim(), updated_at: new Date().toISOString() } : group)
        .map((group) => group.id === editingGroupId ? { ...group, icon_name: editingGroupIcon, icon_color: editingGroupColor } : group)
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditingGroupId(null);
    setEditingGroupName('');
    setMessage('Course or grade level updated.');
  };

  const openSubgroups = (group: AcademicGroup) => {
    setSelectedGroupId(group.id);
    setNewSubgroupName('');
    setEditingSubgroupId(null);
    setEditingSubgroupName('');
    setActionGroupId(null);
    setSubgroupModalVisible(true);
  };

  const removeGroup = async (group: AcademicGroup) => {
    const runDelete = async () => {
      setMessage(null);
      const { error } = await deleteAcademicGroup(group.id);
      if (error) {
        setMessage(error.message);
        return;
      }
      setGroups((current) => current.filter((item) => item.id !== group.id));
      setSubgroups((current) => current.filter((item) => item.academic_group_id !== group.id));
      setSelectedGroupId((current) => (current === group.id ? groups.find((item) => item.id !== group.id)?.id ?? null : current));
      setMessage(`${group.name} was deleted.`);
    };

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Delete "${group.name}" and its subgroups?`)) void runDelete();
      return;
    }

    Alert.alert('Delete group?', `Delete "${group.name}" and its subgroups?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: runDelete },
    ]);
  };

  const addSubgroup = async () => {
    if (!selectedGroupId) {
      setMessage('Select a group first.');
      return;
    }
    if (!newSubgroupName.trim()) {
      setMessage('Enter a subgroup name.');
      return;
    }
    setMessage(null);
    const { data, error } = await createAcademicSubgroup(selectedGroupId, newSubgroupName, { iconName: newSubgroupIcon, iconColor: newSubgroupColor });
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data) setSubgroups((current) => [...current, data as AcademicSubgroup].sort((a, b) => a.name.localeCompare(b.name)));
    setNewSubgroupName('');
    setNewSubgroupIcon('category');
    setNewSubgroupColor(COLOR_OPTIONS[0]);
    setMessage('Subgroup created.');
  };

  const beginEditSubgroup = (subgroup: AcademicSubgroup) => {
    setEditingSubgroupId(subgroup.id);
    setEditingSubgroupName(subgroup.name);
    setEditingSubgroupIcon((subgroup.icon_name || 'category') as MaterialIconName);
    setEditingSubgroupColor(subgroup.icon_color || COLOR_OPTIONS[0]);
  };

  const saveSubgroup = async () => {
    if (!editingSubgroupId || !editingSubgroupName.trim()) {
      setMessage('Enter a subgroup name.');
      return;
    }
    setMessage(null);
    const { error } = await updateAcademicSubgroup(editingSubgroupId, editingSubgroupName, { iconName: editingSubgroupIcon, iconColor: editingSubgroupColor });
    if (error) {
      setMessage(error.message);
      return;
    }
    setSubgroups((current) =>
      current
        .map((subgroup) => subgroup.id === editingSubgroupId
          ? { ...subgroup, name: editingSubgroupName.trim(), icon_name: editingSubgroupIcon, icon_color: editingSubgroupColor, updated_at: new Date().toISOString() }
          : subgroup)
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditingSubgroupId(null);
    setEditingSubgroupName('');
    setMessage('Subgroup updated.');
  };

  const removeSubgroup = async (subgroup: AcademicSubgroup) => {
    const runDelete = async () => {
      setMessage(null);
      const { error } = await deleteAcademicSubgroup(subgroup.id);
      if (error) {
        setMessage(error.message);
        return;
      }
      setSubgroups((current) => current.filter((item) => item.id !== subgroup.id));
      setMessage(`${subgroup.name} was deleted.`);
    };

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Delete "${subgroup.name}"?`)) void runDelete();
      return;
    }

    Alert.alert('Delete subgroup?', `Delete "${subgroup.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: runDelete },
    ]);
  };

  const removeAttendance = async (row: AdminAttendanceRow) => {
    const label = row.eventTitle ?? row.eventCode ?? 'this attendance record';
    const runDelete = async () => {
      setMessage(null);
      const { error } = await deleteAdminAttendance(row.id);
      if (error) {
        setMessage(error.message);
        return;
      }
      setAttendance((current) => current.filter((item) => item.id !== row.id));
      setMessage(`Attendance record for ${label} was deleted.`);
    };

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Delete attendance record for "${label}"?`)) void runDelete();
      return;
    }

    Alert.alert('Delete attendance?', `Delete attendance record for "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: runDelete },
    ]);
  };

  if (!role || loading) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.gateTitle}>Checking administrator access...</Text>
      </View>
    );
  }

  if (role !== 'admin') {
    return (
      <View style={styles.gate}>
        <MaterialIcons name="admin-panel-settings" color={COLORS.primary} size={34} />
        <Text style={styles.gateTitle}>Admins Only</Text>
        <Text style={styles.gateText}>User and event management is available to administrator accounts.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ADMINISTRATION</Text>
          <Text style={styles.title}>Manage Records</Text>
          <Text style={styles.subtitle}>Review users, assign operational roles, and remove invalid events.</Text>
        </View>

        <View style={styles.segment}>
          <SegmentButton active={view === 'users'} icon="groups" label="Users" onPress={() => { setSelectedEventId(null); setView('users'); }} />
          <SegmentButton active={view === 'events'} icon="event-note" label="Events" onPress={() => setView('events')} />
          <SegmentButton active={view === 'attendance'} icon="fact-check" label="Attendance" onPress={() => { setSelectedEventId(null); setView('attendance'); }} />
          <SegmentButton active={view === 'groups'} icon="school" label="Groups" onPress={() => { setSelectedEventId(null); setView('groups'); }} />
        </View>

        {message && <Text style={styles.message}>{message}</Text>}

        {view === 'users' ? (
          <View style={styles.stack}>
            {users.map((item) => {
              const editingAssignment = editingUserId === item.id;
              const editableSubgroups = editingUserGroupId
                ? subgroups.filter((subgroup) => subgroup.academic_group_id === editingUserGroupId)
                : [];

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <MaterialIcons name={item.role === 'teacher' ? 'badge' : item.role === 'admin' ? 'admin-panel-settings' : 'school'} color={COLORS.primary} size={22} />
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle}>{item.full_name || 'Unnamed user'}</Text>
                      <Text style={styles.cardMeta}>{item.email}</Text>
                      <Text style={styles.cardMeta}>Group: {item.academicGroupName || 'Not selected'}</Text>
                      <Text style={styles.cardMeta}>Subgroup: {item.academicSubgroupName || 'None'}</Text>
                      {item.role === 'student' ? <Text style={styles.cardMeta}>Student changes used: {item.academic_assignment_change_count ?? 0}/1</Text> : null}
                    </View>
                    <Text style={styles.rolePill}>{item.role.toUpperCase()}</Text>
                  </View>

                  {item.role === 'admin' ? (
                    <Text style={styles.note}>Admin accounts are promoted manually in Supabase SQL.</Text>
                  ) : (
                    <>
                      <View style={styles.actionRow}>
                        <SmallButton
                          disabled={item.role === 'student'}
                          icon="school"
                          label="Student"
                          onPress={() => changeRole(item, 'student')}
                        />
                        <SmallButton
                          disabled={item.role === 'teacher'}
                          icon="badge"
                          label="Teacher"
                          onPress={() => changeRole(item, 'teacher')}
                        />
                        <SmallButton
                          icon={editingAssignment ? 'close' : 'tune'}
                          label={editingAssignment ? 'Cancel Groups' : 'Fix Groups'}
                          onPress={() => {
                            if (editingAssignment) {
                              setEditingUserId(null);
                              setEditingUserGroupId(null);
                              setEditingUserSubgroupId(null);
                            } else {
                              beginEditUserAssignment(item);
                            }
                          }}
                        />
                      </View>

                      {editingAssignment ? (
                        <View style={styles.assignmentEditor}>
                          <Text style={styles.cardMeta}>Course / grade</Text>
                          <View style={styles.choiceRow}>
                            {groups.map((group) => {
                              const active = group.id === editingUserGroupId;
                              return (
                                <SmallChoice
                                  key={group.id}
                                  active={active}
                                  label={group.name}
                                  onPress={() => {
                                    setEditingUserGroupId(group.id);
                                    setEditingUserSubgroupId(null);
                                  }}
                                />
                              );
                            })}
                          </View>
                          <Text style={styles.cardMeta}>Subgroup</Text>
                          <View style={styles.choiceRow}>
                            <SmallChoice active={!editingUserSubgroupId} label="None" onPress={() => setEditingUserSubgroupId(null)} />
                            {editableSubgroups.map((subgroup) => (
                              <SmallChoice
                                key={subgroup.id}
                                active={subgroup.id === editingUserSubgroupId}
                                label={subgroup.name}
                                onPress={() => setEditingUserSubgroupId(subgroup.id)}
                              />
                            ))}
                          </View>
                          <View style={styles.actionRow}>
                            <SmallButton disabled={!editingUserGroupId} icon="save" label="Save Groups" onPress={() => saveUserAssignment(item)} />
                          </View>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              );
            })}
            {users.length === 0 && <Text style={styles.emptyText}>No users found.</Text>}
          </View>
        ) : view === 'events' ? (
          selectedEvent ? (
            <EventDashboard event={selectedEvent} onBack={() => setSelectedEventId(null)} onDelete={() => removeEvent(selectedEvent)} />
          ) : (
            <View style={styles.stack}>
              {events.map((event) => (
                <View key={event.id} style={styles.card}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${event.title} event dashboard`}
                    onPress={() => setSelectedEventId(event.id)}
                    style={({ pressed }) => [styles.eventPressable, pressed && styles.pressed]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.avatar}>
                        <MaterialIcons name="event-note" color={COLORS.primary} size={22} />
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{event.title}</Text>
                        <Text style={styles.cardMeta}>Code: {event.event_code}</Text>
                        <Text style={styles.cardMeta}>Group: {event.academicGroupName || 'Not selected'}</Text>
                        <Text style={styles.cardMeta}>Subgroups: {event.academicSubgroupNames.length ? event.academicSubgroupNames.join(', ') : 'All subgroups'}</Text>
                        <Text style={styles.cardMeta}>{formatAdminDateRange(event.start_time, event.end_time)}</Text>
                        <Text style={styles.cardMeta}>Created by: {event.creatorName || event.creatorEmail || 'Unknown creator'}</Text>
                      </View>
                      <View style={styles.countPill}>
                        <Text style={styles.countValue}>{event.attendeeCount}</Text>
                        <Text style={styles.countLabel}>attended</Text>
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.eventFooter}>
                    <IconDeleteButton label={`Delete ${event.title}`} onPress={() => removeEvent(event)} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${event.title} event dashboard`}
                      onPress={() => setSelectedEventId(event.id)}
                      style={({ pressed }) => [styles.openHint, pressed && styles.pressed]}
                    >
                      <Text style={styles.openHintText}>View dashboard</Text>
                      <MaterialIcons name="chevron-right" color={COLORS.primary} size={22} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {events.length === 0 && <Text style={styles.emptyText}>No events found.</Text>}
            </View>
          )
        ) : view === 'attendance' ? (
          <View style={styles.stack}>
            {attendance.map((row) => (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <MaterialIcons name="fact-check" color={COLORS.primary} size={22} />
                  </View>
                  <View style={styles.cardCopy}>
                    <View style={styles.titleActionRow}>
                      <Text style={[styles.cardTitle, styles.titleActionText]}>{row.eventTitle || 'Untitled event'}</Text>
                      <IconDeleteButton label={`Delete attendance for ${row.eventTitle || 'event'}`} onPress={() => removeAttendance(row)} />
                    </View>
                    <Text style={styles.cardMeta}>Student: {row.studentName || row.studentEmail || row.student_id}</Text>
                    <Text style={styles.cardMeta}>Code: {row.eventCode || row.event_id}</Text>
                    <Text style={styles.cardMeta}>Group: {row.academicGroupName || 'Not selected'}</Text>
                    <Text style={styles.cardMeta}>Subgroups: {row.academicSubgroupNames.length ? row.academicSubgroupNames.join(', ') : 'All subgroups'}</Text>
                    <Text style={styles.cardMeta}>Scanned: {formatAdminDateTime(row.scanned_at)}</Text>
                  </View>
                </View>
              </View>
            ))}
            {attendance.length === 0 && <Text style={styles.emptyText}>No attendance records found.</Text>}
          </View>
        ) : (
          <View style={styles.stack}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Create Course / Grade Level</Text>
              <TextInput
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="e.g. Information Technology"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
              />
              <IconStylePicker
                color={newGroupColor}
                icon={newGroupIcon}
                onColorChange={setNewGroupColor}
                onIconChange={setNewGroupIcon}
              />
              <View style={styles.actionRow}>
                <SmallButton icon="add-circle" label="Add Group" onPress={addGroup} />
              </View>
            </View>
            {groups.map((group) => (
              editingGroupId === group.id ? (
                <View key={group.id} style={[styles.card, selectedGroupId === group.id && styles.selectedCard]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, { backgroundColor: `${editingGroupColor}1A` }]}>
                      <MaterialIcons name={editingGroupIcon} color={editingGroupColor} size={22} />
                    </View>
                    <View style={styles.cardCopy}>
                      <TextInput
                        value={editingGroupName}
                        onChangeText={setEditingGroupName}
                        placeholder="Group name"
                        placeholderTextColor={COLORS.textSecondary}
                        style={styles.input}
                      />
                      <IconStylePicker
                        color={editingGroupColor}
                        icon={editingGroupIcon}
                        onColorChange={setEditingGroupColor}
                        onIconChange={setEditingGroupIcon}
                      />
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <SmallButton icon="check" label="Save" onPress={saveGroup} />
                    <SmallButton icon="close" label="Cancel" onPress={() => { setEditingGroupId(null); setEditingGroupName(''); }} />
                  </View>
                </View>
              ) : (
                <Pressable
                  key={group.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Manage ${group.name}`}
                  onPress={() => {
                    setSelectedGroupId(group.id);
                    setActionGroupId(group.id);
                  }}
                  style={({ pressed }) => [styles.card, selectedGroupId === group.id && styles.selectedCard, pressed && styles.pressed]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, { backgroundColor: `${group.icon_color || COLORS.primary}1A` }]}>
                      <MaterialIcons name={(group.icon_name || 'school') as MaterialIconName} color={group.icon_color || COLORS.primary} size={22} />
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle}>{group.name}</Text>
                      <Text style={styles.cardMeta}>Created: {formatAdminDateTime(group.created_at)}</Text>
                      <Text style={styles.cardMeta}>Tap to update, delete, or manage subgroups.</Text>
                    </View>
                  </View>
                </Pressable>
              )
            ))}
            {groups.length === 0 && <Text style={styles.emptyText}>No groups found.</Text>}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={!!actionGroup}
        onRequestClose={() => setActionGroupId(null)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.actionSheet}>
            <Text style={styles.downloadTitle}>{actionGroup?.name}</Text>
            <Text style={styles.downloadHint}>Choose what to manage for this group.</Text>
            <View style={styles.sheetButtonStack}>
              {actionGroup ? (
                <>
                  <SheetOption icon="edit" label="Update Group" onPress={() => beginEditGroup(actionGroup)} />
                  <SheetOption icon="category" label="Sub Groups" onPress={() => openSubgroups(actionGroup)} />
                  <SheetOption danger icon="delete" label="Delete Group" onPress={() => { setActionGroupId(null); void removeGroup(actionGroup); }} />
                </>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActionGroupId(null)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={subgroupModalVisible}
        onRequestClose={() => setSubgroupModalVisible(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.subgroupSheet}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.cardCopy}>
                <Text style={styles.downloadTitle}>{selectedGroup?.name || 'Sub Groups'}</Text>
              </View>
              <IconOnlyButton icon="close" label="Close subgroup modal" onPress={() => setSubgroupModalVisible(false)} />
            </View>

            <TextInput
              value={newSubgroupName}
              onChangeText={setNewSubgroupName}
              placeholder="e.g. Physical, Secondary"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.input}
            />
            <IconStylePicker
              color={newSubgroupColor}
              icon={newSubgroupIcon}
              onColorChange={setNewSubgroupColor}
              onIconChange={setNewSubgroupIcon}
            />
            <View style={styles.actionRow}>
              <SmallButton disabled={!selectedGroupId} icon="add-circle" label="Add Sub Group" onPress={addSubgroup} />
            </View>

            <ScrollView style={styles.subgroupList} contentContainerStyle={styles.subgroupListContent}>
              {selectedSubgroups.map((subgroup) => (
                <View key={subgroup.id} style={styles.subgroupCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatar, { backgroundColor: `${(editingSubgroupId === subgroup.id ? editingSubgroupColor : subgroup.icon_color || COLORS.primary)}1A` }]}>
                      <MaterialIcons
                        name={editingSubgroupId === subgroup.id ? editingSubgroupIcon : (subgroup.icon_name || 'category') as MaterialIconName}
                        color={editingSubgroupId === subgroup.id ? editingSubgroupColor : subgroup.icon_color || COLORS.primary}
                        size={22}
                      />
                    </View>
                    <View style={styles.cardCopy}>
                      {editingSubgroupId === subgroup.id ? (
                        <>
                          <TextInput
                            value={editingSubgroupName}
                            onChangeText={setEditingSubgroupName}
                            placeholder="Subgroup name"
                            placeholderTextColor={COLORS.textSecondary}
                            style={styles.input}
                          />
                          <IconStylePicker
                            color={editingSubgroupColor}
                            icon={editingSubgroupIcon}
                            onColorChange={setEditingSubgroupColor}
                            onIconChange={setEditingSubgroupIcon}
                          />
                        </>
                      ) : (
                        <>
                          <Text style={styles.cardTitle}>{subgroup.name}</Text>
                          <Text style={styles.cardMeta}>Created: {formatAdminDateTime(subgroup.created_at)}</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.subgroupActionRow}>
                    {editingSubgroupId === subgroup.id ? (
                      <>
                        <SmallButton icon="check" label="Save" onPress={saveSubgroup} />
                        <SmallButton icon="close" label="Cancel" onPress={() => { setEditingSubgroupId(null); setEditingSubgroupName(''); }} />
                      </>
                    ) : (
                      <>
                        <IconActionButton icon="edit" label={`Update ${subgroup.name}`} onPress={() => beginEditSubgroup(subgroup)} />
                        <IconDeleteButton label={`Delete ${subgroup.name}`} onPress={() => removeSubgroup(subgroup)} />
                      </>
                    )}
                  </View>
                </View>
              ))}
              {selectedSubgroups.length === 0 && <Text style={styles.emptyText}>No subgroups for this group yet.</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function EventDashboard({
  event,
  onBack,
  onDelete,
}: {
  event: AdminEvent;
  onBack: () => void;
  onDelete: () => void;
}) {
  const qrRef = useRef<QRRef | null>(null);
  const [downloadPromptVisible, setDownloadPromptVisible] = useState(false);
  const qrPayload = buildQRPayload({
    eventId: event.event_code,
    title: event.title,
    start: event.start_time ?? '',
    end: event.end_time ?? '',
    academicGroupId: event.academic_group_id,
    academicGroupName: event.academicGroupName,
    academicSubgroupIds: event.academic_subgroup_ids,
    academicSubgroupNames: event.academicSubgroupNames,
  });

  const downloadQR = async (format: QRDownloadFormat) => {
    setDownloadPromptVisible(false);
    const pngDataUri = await getQRDataUri(qrRef.current);
    if (!pngDataUri) return;

    const fileName = safeFileName(`${event.event_code}-${event.title || 'event-qr'}`);
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
    <View style={styles.stack}>
      <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <MaterialIcons name="arrow-back" color={COLORS.primary} size={20} />
        <Text style={styles.backButtonText}>Events</Text>
      </Pressable>

      <View style={styles.detailPanel}>
        <View style={styles.detailHeader}>
          <View style={styles.detailIcon}>
            <MaterialIcons name="event-note" color={COLORS.primary} size={28} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.detailTitle}>{event.title}</Text>
            <Text style={styles.cardMeta}>Code: {event.event_code}</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <MiniMetric icon="groups" label="Attendees" value={event.attendeeCount} />
          <MiniMetric icon="person" label="Created By" value={event.creatorName || event.creatorEmail || 'Unknown'} />
          <MiniMetric icon="schedule" label="Created" value={event.created_at ? formatAdminDateTime(event.created_at) : 'Unknown'} />
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.sectionTitle}>Event Time</Text>
          <Text style={styles.infoText}>{formatAdminDateRange(event.start_time, event.end_time)}</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.sectionTitle}>Course / Grade Level</Text>
          <Text style={styles.infoText}>{event.academicGroupName || 'Not selected'}</Text>
          <Text style={styles.cardMeta}>Subgroups: {event.academicSubgroupNames.length ? event.academicSubgroupNames.join(', ') : 'All subgroups'}</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.sectionTitle}>Creator</Text>
          <Text style={styles.infoText}>{event.creatorName || 'Unnamed creator'}</Text>
          <Text style={styles.cardMeta}>{event.creatorEmail || event.created_by || 'No creator account found'}</Text>
        </View>

        <View style={styles.qrPanel}>
          <Text style={styles.sectionTitle}>Event QR</Text>
          <Text style={styles.infoText}>Download this QR code for the selected event.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Download QR code for ${event.title}`}
            onPress={() => setDownloadPromptVisible(true)}
            onLongPress={() => setDownloadPromptVisible(true)}
            style={({ pressed }) => [styles.qrBox, pressed && styles.pressed]}
          >
            <QRCode value={qrPayload} size={190} getRef={(ref) => { qrRef.current = ref; }} />
          </Pressable>
          <Text style={styles.cardMeta}>Tap the QR to download</Text>
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
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={styles.infoBlock}>
          <Text style={styles.sectionTitle}>Attendees</Text>
          {event.attendees.length === 0 ? (
            <Text style={styles.emptyText}>No students have attended this event yet.</Text>
          ) : (
            event.attendees.map((attendee) => (
              <View key={attendee.attendanceId} style={styles.attendeeRow}>
                <View style={styles.attendeeIcon}>
                  <MaterialIcons name="school" color={COLORS.primary} size={18} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.attendeeName}>{attendee.studentName || 'Unnamed student'}</Text>
                  <Text style={styles.cardMeta}>{attendee.studentEmail || attendee.studentId}</Text>
                  <Text style={styles.cardMeta}>Scanned {formatAdminDateTime(attendee.scannedAt)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.iconActionRow}>
          <IconDeleteButton label={`Delete ${event.title}`} onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

function DownloadOption({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Download QR as ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}
    >
      <Text style={styles.downloadButtonText}>{label}</Text>
    </Pressable>
  );
}

function SheetOption({
  danger,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.sheetOption, danger && styles.sheetOptionDanger, pressed && styles.pressed]}
    >
      {icon ? (
        danger && icon === 'delete' ? (
          <AntDesign name="delete" color={COLORS.danger} size={16} />
        ) : (
          <MaterialIcons name={icon} color={COLORS.primary} size={21} />
        )
      ) : null}
      <Text style={[styles.sheetOptionText, danger && styles.sheetOptionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function IconActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.iconActionButton, pressed && styles.pressed]}
    >
      <MaterialIcons name={icon} color={COLORS.primary} size={18} />
    </Pressable>
  );
}

function IconOnlyButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.iconOnlyButton, pressed && styles.pressed]}
    >
      <MaterialIcons name={icon} color={COLORS.textSecondary} size={22} />
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

function IconDeleteButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.iconDeleteButton, pressed && styles.pressed]}
    >
      <AntDesign name="delete" color={COLORS.danger} size={16} />
    </Pressable>
  );
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: number | string;
}) {
  return (
    <View style={styles.miniMetric}>
      <MaterialIcons name={icon} color={COLORS.primary} size={20} />
      <Text style={styles.miniMetricValue} numberOfLines={2}>{value}</Text>
      <Text style={styles.miniMetricLabel}>{label}</Text>
    </View>
  );
}

function SegmentButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.segmentButton, active && styles.segmentButtonActive, pressed && styles.pressed]}
    >
      <MaterialIcons name={icon} color={active ? COLORS.textOnPrimary : COLORS.textSecondary} size={20} />
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({
  danger,
  disabled,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        danger && styles.dangerButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <MaterialIcons name={icon} color={danger ? COLORS.textOnPrimary : COLORS.textPrimary} size={18} />
      <Text style={[styles.smallButtonText, danger && styles.dangerButtonText]}>{label}</Text>
    </Pressable>
  );
}

function SmallChoice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.smallChoice, active && styles.smallChoiceActive, pressed && styles.pressed]}
    >
      <Text style={[styles.smallChoiceText, active && styles.smallChoiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 120,
  },
  gate: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  gateTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  gateText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 360 },
  header: { marginBottom: 18 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  title: { color: COLORS.textPrimary, fontSize: 34, lineHeight: 40, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  segmentButton: {
    flex: 1,
    minWidth: 120,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  segmentButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  segmentText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: COLORS.textOnPrimary },
  message: {
    color: COLORS.primaryDark,
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.onPrimaryMuted,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  stack: { gap: 12 },
  card: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  selectedCard: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  groupLayout: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  groupColumn: { flexGrow: 1, flexBasis: 320, gap: 12, minWidth: 0 },
  eventPressable: { gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  titleActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleActionText: { flex: 1, minWidth: 0 },
  cardMeta: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
  rolePill: {
    color: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  countPill: {
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  countValue: { color: COLORS.primary, fontSize: 18, fontWeight: '800' },
  countLabel: { color: COLORS.primaryDark, fontSize: 10, fontWeight: '800', marginTop: 1 },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  openHint: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  openHintText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  note: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 12 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  assignmentEditor: { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, gap: 8 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subgroupActionRow: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 14, paddingLeft: 14 },
  iconActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginTop: 14 },
  iconActionButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconDeleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  smallButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  smallButtonText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  smallChoice: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallChoiceActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  smallChoiceText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800' },
  smallChoiceTextActive: { color: COLORS.textOnPrimary },
  input: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  inputSpacing: { marginTop: 12 },
  stylePicker: { gap: 8, marginTop: 12 },
  stylePickerLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChoiceActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChoice: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.textOnPrimary,
  },
  colorChoiceActive: { borderColor: COLORS.textPrimary },
  dangerButton: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  dangerButtonText: { color: COLORS.textOnPrimary },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.75 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', paddingVertical: 24 },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingRight: 12 },
  backButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
  detailPanel: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: { color: COLORS.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniMetric: {
    flexGrow: 1,
    flexBasis: 130,
    minHeight: 112,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    padding: 12,
    justifyContent: 'space-between',
  },
  miniMetricValue: { color: COLORS.textPrimary, fontSize: 17, lineHeight: 22, fontWeight: '800', marginTop: 8 },
  miniMetricLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', marginTop: 4 },
  infoBlock: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  infoText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21 },
  qrPanel: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    gap: 10,
  },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12 },
  modalScrim: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', padding: 20 },
  actionSheet: { width: '100%', maxWidth: 410, backgroundColor: COLORS.elevated, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 22, alignItems: 'stretch' },
  downloadSheet: { width: '100%', maxWidth: 390, backgroundColor: COLORS.elevated, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 22, alignItems: 'center' },
  downloadTitle: { color: COLORS.textPrimary, fontSize: 21, fontWeight: '800' },
  downloadHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  downloadActions: { width: '100%', flexDirection: 'row', gap: 10 },
  downloadButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  downloadButtonText: { color: COLORS.textOnPrimary, fontSize: 14, fontWeight: '800' },
  sheetButtonStack: { gap: 10 },
  sheetOption: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 14,
  },
  sheetOptionDanger: { borderColor: COLORS.dangerSoft, backgroundColor: COLORS.dangerSoft },
  sheetOptionText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  sheetOptionTextDanger: { color: COLORS.danger },
  subgroupSheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    backgroundColor: COLORS.elevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconOnlyButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  subgroupList: { marginTop: 12 },
  subgroupListContent: { gap: 10, paddingBottom: 8 },
  subgroupCard: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 12 },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 18 },
  cancelButtonText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  attendeeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
});
