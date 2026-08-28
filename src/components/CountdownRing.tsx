import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/**
 * Animated "Are you OK?" countdown visual — SVG-free, uses only the RN
 * Animated API so it needs no extra native deps.
 *
 *  • a static track ring
 *  • a "sonar" ring that pulses outward for urgency
 *  • a marker that sweeps around the ring once over the full grace period
 *  • the big seconds number, which flinches on every tick
 *  • a thin depleting bar underneath for a precise read of time left
 *
 * `total` and `remaining` are in whole seconds. `running` drives the sweep and
 * pulse; freeze it when the countdown is paused or finished.
 */
export function CountdownRing({
  total,
  remaining,
  running,
  size = 176,
}: {
  total: number;
  remaining: number;
  running: boolean;
  size?: number;
}) {
  const elapsed = Math.max(0, total - remaining);
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
  const urgent = remaining <= 5;
  const accent = urgent ? colors.dangerHi : colors.danger;

  const sweep = useRef(new Animated.Value(progress)).current;
  const sonar = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(1)).current;

  // Smoothly glide the sweep marker to the new progress each second.
  useEffect(() => {
    Animated.timing(sweep, {
      toValue: progress,
      duration: running ? 950 : 200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [progress, running, sweep]);

  // Expanding "sonar" pulse while the countdown runs.
  useEffect(() => {
    if (!running) {
      sonar.stopAnimation();
      sonar.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(sonar, {
        toValue: 1,
        duration: urgent ? 750 : 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [running, urgent, sonar]);

  // Flinch the number on each new value.
  useEffect(() => {
    tick.setValue(1.18);
    Animated.spring(tick, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }).start();
  }, [remaining, tick]);

  const rotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const sonarScale = sonar.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.7] });
  const sonarOpacity = sonar.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const marker = Math.max(10, size * 0.07);

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sonar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: accent,
              opacity: sonarOpacity,
              transform: [{ scale: sonarScale }],
            },
          ]}
        />
        <View
          style={[
            styles.track,
            { width: size, height: size, borderRadius: size / 2, borderColor: colors.surfaceHi },
          ]}
        />
        <Animated.View
          style={[
            styles.sweepLayer,
            { width: size, height: size, transform: [{ rotate }] },
          ]}
        >
          <View
            style={{
              width: marker,
              height: marker,
              borderRadius: marker / 2,
              backgroundColor: accent,
              marginTop: -marker / 2 + 3,
            }}
          />
        </Animated.View>
        <Animated.Text
          style={[
            styles.count,
            { color: urgent ? colors.dangerHi : colors.text, transform: [{ scale: tick }] },
          ]}
        >
          {Math.max(0, remaining)}
        </Animated.Text>
      </View>

      <View style={[styles.barTrack, { width: size }]}>
        <View
          style={[
            styles.barFill,
            { width: `${(1 - progress) * 100}%`, backgroundColor: accent },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sonar: { position: 'absolute', borderWidth: 2 },
  track: { position: 'absolute', borderWidth: 6 },
  sweepLayer: { position: 'absolute', alignItems: 'center' },
  count: { fontSize: 72, fontWeight: '900', letterSpacing: -2 },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHi,
    marginTop: 18,
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: 2 },
});
