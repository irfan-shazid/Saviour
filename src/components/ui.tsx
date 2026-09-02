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
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import { radius, spacing } from '../theme';

/* ------------------------------------------------------------------ *
 * smoothLayout — one call before a setState that changes layout
 * (list add/remove/reorder, a form expanding) so the change eases
 * into place instead of snapping.
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
 * MountFade — fades + lifts its children in on first render, so a
 * screen's content arrives instead of blinking on.
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
  style?: StyleProp<ViewStyle>;
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
      style={style}
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
  const { colors, shadow } = useTheme();
  const s = useThemedStyles(makeStyles);

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onAccent },
    danger: { bg: colors.danger, fg: colors.onAccent },
    safe: { bg: colors.safe, fg: colors.onSafe },
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
          s.button,
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
          <Text style={[s.buttonText, { color: p.fg, fontSize }]}>
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
  tint,
  bg,
  disabled,
}: {
  glyph: string;
  onPress: () => void;
  label: string;
  tint?: string;
  bg?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <AnimatedPressable onPress={onPress} disabled={disabled} accessibilityLabel={label} scaleTo={0.9}>
      <View
        style={[
          s.iconButton,
          { backgroundColor: bg ?? colors.surfaceHi, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        <Text style={{ fontSize: 16, color: tint ?? colors.text }}>{glyph}</Text>
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
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[{ marginBottom: spacing(2) }, style as StyleProp<ViewStyle>]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[s.input, !!error && { borderColor: colors.danger }]}
        {...props}
      />
      {error ? (
        <Text style={s.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={s.helperText}>{helper}</Text>
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
  const { shadow } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.card, padded && { padding: spacing(2) }, elevated && shadow.card, style]}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * SectionLabel
 * ------------------------------------------------------------------ */
export function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const s = useThemedStyles(makeStyles);
  return <Text style={[s.section, style]}>{children}</Text>;
}

/* ------------------------------------------------------------------ *
 * Segmented — one-of-N picker. Replaces scattered chip rows so related
 * choices read as a single control.
 * ------------------------------------------------------------------ */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, shadow } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={[
              s.segment,
              active && { backgroundColor: colors.surface },
              active && shadow.card,
            ]}
          >
            <Text style={[s.segmentText, active && { color: colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * ToggleRow — title + description + switch, the shape most settings take.
 * ------------------------------------------------------------------ */
export function ToggleRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        {description ? <Text style={s.toggleDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync().catch(() => {});
          onValueChange(v);
        }}
        trackColor={{ true: colors.safe, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Badge — small status pill.
 * ------------------------------------------------------------------ */
export function Badge({ text, color }: { text: string; color: string }) {
  const { tint } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.badge, { backgroundColor: tint(color), borderColor: tint(color, 'edge') }]}>
      <View style={[s.badgeDot, { backgroundColor: color }]} />
      <Text style={[s.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Avatar — initials circle.
 * ------------------------------------------------------------------ */
export function Avatar({
  initials,
  color,
  size = 44,
}: {
  initials: string;
  color?: string;
  size?: number;
}) {
  const { colors, tint } = useTheme();
  const c = color ?? colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint(c),
        borderWidth: 1,
        borderColor: tint(c, 'edge'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: c, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
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
  const { colors, tint } = useTheme();
  const s = useThemedStyles(makeStyles);
  const toneColor = {
    info: colors.primary,
    warning: colors.warning,
    danger: colors.danger,
    safe: colors.safe,
  }[tone];
  return (
    <View style={[s.banner, { borderColor: tint(toneColor, 'edge'), backgroundColor: tint(toneColor) }]}>
      <Text style={s.bannerIcon}>{icon ?? (tone === 'safe' ? '✅' : '⚠️')}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.bannerTitle, { color: toneColor }]}>{title}</Text>
        {message ? <Text style={s.bannerMsg}>{message}</Text> : null}
        {actionLabel && onAction ? (
          <Text onPress={onAction} style={[s.bannerAction, { color: toneColor }]}>
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
export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.empty}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={s.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * ScreenHeader — consistent title block for every tab.
 * ------------------------------------------------------------------ */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { type } = useTheme();
  return (
    <View style={{ marginBottom: spacing(2.5) }}>
      <Text style={type.h1}>{title}</Text>
      {subtitle ? (
        <Text style={[type.caption, { marginTop: 4, lineHeight: 20 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, type }: ThemeState) =>
  StyleSheet.create({
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
    section: { ...type.label, marginTop: spacing(2.5), marginBottom: spacing(1) },
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
    toggleTitle: { ...type.h3, fontSize: 15 },
    toggleDesc: { color: colors.textMuted, marginTop: 2, fontSize: 13, lineHeight: 18 },
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
