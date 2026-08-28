import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

interface Options {
  enabled: boolean;
  /** Impact threshold in g (a hard landing spikes well above 1g). */
  sensitivity: number;
  /** Called once when a probable fall is detected, with the peak g-force. */
  onFall: (magnitude: number) => void;
}

const SAMPLE_INTERVAL_MS = 80;
const FREEFALL_THRESHOLD = 0.45; // near weightlessness while dropping
const FREEFALL_WINDOW_MS = 1200; // impact must follow free-fall within this
const COOLDOWN_MS = 8000; // ignore further detections briefly after a hit

/**
 * Detects a drop/fall from the accelerometer using a two-phase heuristic:
 *   1. free-fall  — total acceleration dips toward 0g
 *   2. impact     — a sharp spike above `sensitivity` g shortly after
 * A very hard impact (> sensitivity + 1.5 g) also triggers on its own, so a
 * phone knocked out of a hand without a clean free-fall is still caught.
 */
export function useFallDetection({ enabled, sensitivity, onFall }: Options) {
  const freefallAt = useRef<number>(0);
  const cooldownUntil = useRef<number>(0);
  const onFallRef = useRef(onFall);
  onFallRef.current = onFall;

  useEffect(() => {
    if (!enabled) return;

    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      if (now < cooldownUntil.current) return;

      const magnitude = Math.sqrt(x * x + y * y + z * z);

      if (magnitude < FREEFALL_THRESHOLD) {
        freefallAt.current = now;
        return;
      }

      const recentFreefall = now - freefallAt.current < FREEFALL_WINDOW_MS;
      const hardImpact = magnitude > sensitivity + 1.5;

      if (magnitude > sensitivity && (recentFreefall || hardImpact)) {
        cooldownUntil.current = now + COOLDOWN_MS;
        freefallAt.current = 0;
        onFallRef.current(Number(magnitude.toFixed(2)));
      }
    });

    return () => sub.remove();
  }, [enabled, sensitivity]);
}
