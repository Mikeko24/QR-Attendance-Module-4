import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ColorValue } from 'react-native';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

type GoogleIconName = keyof typeof MaterialIcons.glyphMap;

function GoogleTabIcon({
  color,
  focused,
  label,
  name,
}: {
  color: ColorValue;
  focused: boolean;
  label: string;
  name: GoogleIconName;
}) {
  return (
    <View style={styles.tabContent}>
      <View style={[styles.iconShell, focused && styles.iconShellActive]}>
        <MaterialIcons name={name} color={String(color)} size={25} />
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

function TabButton({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  children,
  onLongPress,
  onPress,
  testID,
}: any) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      android_ripple={{ color: 'transparent' }}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [role, setRole] = useState<ProfileRole | null>(null);
  const desktop = Platform.OS === 'web' && width >= 768;
  const navWidth = Math.min(width - 48, 760);

  useEffect(() => {
    let active = true;
    if (!user) {
      setRole(null);
      return;
    }
    getProfile(user.id).then((profile) => {
      if (active) setRole(profile?.role ?? 'student');
    });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarActiveBackgroundColor: 'transparent',
        headerShown: false,
        headerStyle: { backgroundColor: COLORS.card },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarShowLabel: false,
        tabBarIconStyle: { flex: 1, width: '100%', height: '100%' },
        tabBarItemStyle: {
          height: 64,
          minHeight: 64,
          backgroundColor: 'transparent',
          marginHorizontal: 0,
          marginVertical: 0,
          paddingVertical: 0,
          borderRadius: 0,
        },
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarHideOnKeyboard: true,
        tabBarStyle: desktop
          ? {
              position: 'absolute',
              width: navWidth,
              left: (width - navWidth) / 2,
              bottom: 22,
              height: 78,
              borderRadius: 24,
              backgroundColor: COLORS.elevated,
              borderWidth: 1,
              borderTopWidth: 1,
              borderColor: COLORS.border,
              paddingTop: 6,
              paddingHorizontal: 10,
              paddingBottom: 6,
              shadowColor: COLORS.shadow,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.1,
              shadowRadius: 24,
            }
          : {
              height: width < 360 ? 76 : 80,
              backgroundColor: COLORS.elevated,
              borderTopColor: COLORS.border,
              borderTopWidth: 1,
              paddingTop: 6,
              paddingHorizontal: 8,
              paddingBottom: Platform.OS === 'ios' ? 8 : 6,
            },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <GoogleTabIcon name="home" label="Home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: role === 'student' ? '/scan' : null,
          tabBarIcon: ({ color, focused }) => <GoogleTabIcon name="qr-code-scanner" label="Scan" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: role === 'teacher' ? 'Attendance' : 'History',
          href: role === 'admin' ? null : '/history',
          tabBarIcon: ({ color, focused }) => <GoogleTabIcon name="history" label={role === 'teacher' ? 'Attendance' : 'History'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Events',
          href: role === 'student' ? null : '/teacher',
          tabBarIcon: ({ color, focused }) => <GoogleTabIcon name="event-note" label="Events" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: role === 'admin' ? '/admin' : null,
          tabBarIcon: ({ color, focused }) => <GoogleTabIcon name="admin-panel-settings" label="Admin" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <GoogleTabIcon name="person" label="Profile" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    width: '100%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconShell: {
    width: 42,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShellActive: {
    backgroundColor: COLORS.primarySoft,
  },
  tabLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  tabButton: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabButtonPressed: {
    opacity: 0.72,
  },
});
