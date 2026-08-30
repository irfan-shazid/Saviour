import React, { useEffect, useRef } from 'react';
import {
  AccessibilityRole,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, spacing, type } from '../theme';

/* ------------------------------------------------------------------ *
 * smoothLayout — one call before a setState that changes layout
 * (list add/remove/reorder, a form expanding) so the change eases
 * into place instead of snapping. Cheaper and lighter than pulling in
 * Reanimated for what is mostly height/position tweening.
 * ------------------------------------------------------------------ */
export function smoothLayout(duration = 240) {
  LayoutAnimation.configureNext({
    duration,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'spring', springDamping: 0.8 },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });
}

/* ------------------------------------------------------------------ *
 * MountFade — fades + lifts its children in on first render. Used to
 * stagger a screen's cards so content arrives instead of blinking on.
 * Native-driven, so it stays at 60fps even during nav transitions.
 * ------------------------------------------------------------------ */
export function MountFade({
  children,
  delay = 0,
  offset = 10,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 340,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);

  return (
    <Animated.View
      style={[
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ *
 * AnimatedPressable — subtle press-in scale + optional haptic tick.
 * ------------------------------------------------------------------ */
function AnimatedPressable({
  onPress,
  disabled,
  haptic = 'selection',
  scaleTo = 0.97,
  style,
  children,
  accessibilityRole = 'button',
  accessibilityLabel,
}: {
  onPress?: () => void;
  disabled?: boolean;
  haptic?: 'selection' | 'medium' | 'none';
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>);
  children: React.ReactNode;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (haptic === 'selection') Haptics.selectionAsync().catch(() => {});
        else if (haptic === 'medium')
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.();
      }}
      onPressIn={() => spring(scaleTo)}
      onPressOut={() => spring(1)}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={style as StyleProp<ViewStyle>}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */
type ButtonVariant = 'primary' | 'danger' | 'safe' | 'ghost' | 'subtle';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md' | 'sm';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: '#fff' },
    danger: { bg: colors.danger, fg: '#fff' },
    safe: { bg: colors.safe, fg: '#05231B' },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    subtle: { bg: colors.surfaceHi, fg: colors.text },
  };
  const p = palette[variant];
  const height = size === 'lg' ? 54 : size === 'md' ? 46 : 38;
  const fontSize = size === 'sm' ? 14 : 16;
  const inactive = disabled || loading;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={inactive}
      haptic={variant === 'danger' ? 'medium' : 'selection'}
      accessibilityLabel={title}
      style={style}
    >
      <View
        style={[
          styles.button,
          {
            height,
            backgroundColor: p.bg,
            borderWidth: p.border ? 1 : 0,
            borderColor: p.border,
            opacity: inactive ? 0.55 : 1,
          },
          variant !== 'ghost' && variant !== 'subtle' && shadow.card,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <Text style={[styles.buttonText, { color: p.fg, fontSize }]}>
            {icon ? `${icon}  ` : ''}
            {title}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

/* ------------------------------------------------------------------ *
 * IconButton — round tap target for row actions.
 * ------------------------------------------------------------------ */
export function IconButton({
  glyph,
  onPress,
  label,
  tint = colors.text,
  bg = colors.surfaceHi,
  disabled,
}: {
  glyph: string;
  onPress: () => void;
  label: string;
  tint?: string;
  bg?: string;
  disabled?: boolean;
}) {
  return (
    <AnimatedPressable onPress={onPress} disabled={disabled} accessibilityLabel={label} scaleTo={0.9}>
      <View style={[styles.iconButton, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }]}>
        <Text style={{ fontSize: 16, color: tint }}>{glyph}</Text>
      </View>
    </AnimatedPressable>
  );
}

/* ------------------------------------------------------------------ *
 * Field — labelled text input with helper/error slots.
 * ------------------------------------------------------------------ */
export function Field({
  label,
  helper,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; helper?: string; error?: string | null }) {
  return (
    <View style={[{ marginBottom: spacing(2) }, style as StyleProp<ViewStyle>]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, !!error && { borderColor: colors.danger }]}
        {...props}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */
export function Card({
  children,
  style,
  padded = true,
  elevated = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        padded && { padding: spacing(2) },
        elevated && shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * SectionLabel
 * ------------------------------------------------------------------ */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.section, style]}>{children}</Text>;
}

/* ------------------------------------------------------------------ *
 * Chip — selectable pill.
 * ------------------------------------------------------------------ */
export function Chip({
  label,
  active,
  onPress,
  wide,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <AnimatedPressable onPress={onPress} accessibilityLabel={label} accessibilityRole="radio" scaleTo={0.94}>
      <View
        style={[
          styles.chip,
          wide && { alignSelf: 'stretch', alignItems: 'center' },
          active && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
      >
        <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

/* ------------------------------------------------------------------ *
 * Badge — small status pill.
 * ------------------------------------------------------------------ */
export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Avatar — initials circle.
 * ------------------------------------------------------------------ */
export function Avatar({ initials, color = colors.primary, size = 44 }: { initials: string; color?: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '22',
        borderWidth: 1,
        borderColor: color + '55',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Banner — inline info/warning/danger message with optional action.
 * ------------------------------------------------------------------ */
export function Banner({
  tone = 'info',
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'safe';
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const toneColor = {
    info: colors.primary,
    warning: colors.warning,
    danger: colors.danger,
    safe: colors.safe,
  }[tone];
  return (
    <View style={[styles.banner, { borderColor: toneColor + '55', backgroundColor: toneColor + '14' }]}>
      <Text style={styles.bannerIcon}>{icon ?? (tone === 'safe' ? '✅' : '⚠️')}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerTitle, { color: toneColor }]}>{title}</Text>
        {message ? <Text style={styles.bannerMsg}>{message}</Text> : null}
        {actionLabel && onAction ? (
          <Text onPress={onAction} style={[styles.bannerAction, { color: toneColor }]}>
            {actionLabel} →
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * EmptyState
 * ------------------------------------------------------------------ */
export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * ScreenHeader — consistent title block for every tab.
 * ------------------------------------------------------------------ */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing(2.5) }}>
      <Text style={type.h1}>{title}</Text>
      {subtitle ? <Text style={[type.caption, { marginTop: 4, lineHeight: 20 }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  buttonText: { fontWeight: '800', letterSpacing: 0.2 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.label, marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    minHeight: 50,
    color: colors.text,
    fontSize: 15,
  },
  helperText: { color: colors.textFaint, fontSize: 12, marginTop: 6 },
  errorText: { color: colors.dangerHi, fontSize: 12, marginTop: 6, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  section: { ...type.label, marginTop: spacing(2), marginBottom: spacing(1) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  banner: {
    flexDirection: 'row',
    gap: spacing(1.5),
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(1.5),
  },
  bannerIcon: { fontSize: 16 },
  bannerTitle: { fontWeight: '800', fontSize: 14 },
  bannerMsg: { color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  bannerAction: { fontWeight: '800', fontSize: 13, marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: spacing(5), paddingHorizontal: spacing(3) },
  emptyIcon: { fontSize: 40, marginBottom: spacing(1.5) },
  emptyTitle: { ...type.h3, textAlign: 'center' },
  emptySub: { ...type.caption, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
