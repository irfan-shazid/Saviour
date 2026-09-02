import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../storage';
import { syncUp } from '../services/sync';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  loading: boolean;
  /** Merge a partial patch into settings and persist it on-device. */
  update: (patch: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next)
          // Mirror to the server when signed in. Fire-and-forget: settings are
          // already safe on disk, and a failed sync must never surface here.
          .then(() => syncUp())
          .catch(() => undefined);
        return next;
      });
    },
    []
  );

  return (
    <SettingsContext.Provider value={{ settings, loading, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
