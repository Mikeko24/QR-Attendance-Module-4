import { MaterialIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';

type IconName = keyof typeof MaterialIcons.glyphMap;

export function AppScreen({
  children,
  scroll = true,
  maxWidth = 980,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  if (!scroll) {
    return <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, { maxWidth }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Surface({
  children,
  style,
  elevated,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}) {
  return <View style={[styles.surface, elevated && styles.elevated, style]}>{children}</View>;
}

export function MetricTile({
  icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: IconName;
  label: string;
  value: number | string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const color = toneColor(tone);
  return (
    <View style={styles.metricTile}>
      <View style={[styles.metricIcon, { backgroundColor: toneSoftColor(tone) }]}>
        <MaterialIcons name={icon} color={color} size={21} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  return (
    <View style={[styles.pill, { backgroundColor: toneSoftColor(tone) }]}>
      <Text style={[styles.pillText, { color: toneColor(tone) }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Surface style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name={icon} color={COLORS.primary} size={28} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </Surface>
  );
}

export function FormField({
  label,
  error,
  helper,
  containerStyle,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string | null;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={COLORS.textSecondary}
        style={[styles.input, error && styles.inputError, inputProps.style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: IconName }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
          >
            {option.icon ? (
              <MaterialIcons name={option.icon} color={active ? COLORS.textOnPrimary : COLORS.textSecondary} size={18} />
            ) : null}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalScrim}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetBody}>{body}</Text>
          <View style={styles.sheetActions}>
            <AppButton title="Cancel" theme="ghost" compact onPress={onCancel} />
            <AppButton title={confirmLabel} theme={danger ? 'danger' : 'primary'} compact onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function toneColor(tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return COLORS.success;
  if (tone === 'warning') return COLORS.warning;
  if (tone === 'danger') return COLORS.danger;
  if (tone === 'neutral') return COLORS.textSecondary;
  return COLORS.primary;
}

function toneSoftColor(tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return COLORS.successLight;
  if (tone === 'warning') return COLORS.warningSoft;
  if (tone === 'danger') return COLORS.dangerSoft;
  if (tone === 'neutral') return COLORS.muted;
  return COLORS.primarySoft;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  screenContent: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 124,
    gap: SPACING.lg,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
  sectionCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 7 },
  screenTitle: { color: COLORS.textPrimary, fontSize: 32, lineHeight: 38, fontWeight: '900' },
  subtitle: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 7 },
  surface: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  elevated: { shadowColor: COLORS.shadow, ...SHADOWS.card },
  metricTile: {
    flexGrow: 1,
    flexBasis: 142,
    minHeight: 122,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  metricIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: COLORS.textPrimary, fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 12 },
  metricLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 4 },
  pill: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 11, fontWeight: '900' },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6, maxWidth: 440 },
  emptyAction: { marginTop: 16 },
  field: { gap: 7 },
  fieldLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  input: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputError: { borderColor: COLORS.danger },
  fieldHelper: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  fieldError: { color: COLORS.danger, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  segmented: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segment: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
  },
  segmentActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  segmentText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: COLORS.textOnPrimary },
  pressed: { opacity: 0.75 },
  modalScrim: { flex: 1, backgroundColor: COLORS.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: COLORS.elevated, borderRadius: RADIUS.xl, padding: 22, shadowColor: COLORS.shadow, ...SHADOWS.sheet },
  sheetTitle: { color: COLORS.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  sheetBody: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
});
