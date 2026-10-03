import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS } from '@/constants/theme';

type Props = {
  title: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  theme?: 'primary' | 'secondary' | 'ghost' | 'danger';
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
};

export default function AppButton({ title, icon, theme = 'secondary', onPress, disabled, loading, compact }: Props) {
  const primary = theme === 'primary';
  const danger = theme === 'danger';
  const ghost = theme === 'ghost';
  const muted = disabled || loading;
  const contentColor = primary || danger ? COLORS.textOnPrimary : ghost ? COLORS.primary : COLORS.textPrimary;

  return (
    <View style={[styles.buttonOuter, compact && styles.compactOuter, muted && styles.disabled]}>
      <Pressable
        style={({ pressed }) => [
          styles.buttonInner,
          compact && styles.compactButton,
          primary && styles.primaryButton,
          danger && styles.dangerButton,
          ghost && styles.ghostButton,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        disabled={muted}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: muted, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator color={contentColor} size="small" style={styles.icon} />
        ) : icon ? (
          <MaterialIcons name={icon} size={compact ? 18 : 21} color={contentColor} style={styles.icon} />
        ) : null}
        <Text style={[styles.label, { color: contentColor }, compact && styles.compactLabel]}>{title}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  compactOuter: { width: 'auto', alignSelf: 'auto' },
  buttonInner: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    minHeight: 52,
  },
  compactButton: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 14 },
  primaryButton: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dangerButton: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  ghostButton: { backgroundColor: 'transparent', borderColor: 'transparent' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
  icon: { paddingRight: 10 },
  label: { fontSize: 16, fontWeight: '800' },
  compactLabel: { fontSize: 14 },
});
