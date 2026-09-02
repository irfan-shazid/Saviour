import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { clearIncidents, loadIncidents } from '../storage';
import type { Incident, IncidentStatus, SmsOutcome } from '../types';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import { Badge, Button, Card, EmptyState, MountFade, ScreenHeader, smoothLayout } from '../components/ui';
import { fullTime, mapsUrl, relativeTime } from '../utils/format';
import { radius, spacing } from '../theme';

const OUTCOME_LABEL: Record<SmsOutcome, string> = {
  sent: 'SMS sent',
  unknown: 'SMS composer opened',
  cancelled: 'SMS cancelled',
  unavailable: 'SMS unavailable',
  'no-contacts': 'no contacts',
};

export function IncidentsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const statusColor: Record<IncidentStatus, string> = {
    PENDING: colors.warning,
    SAFE: colors.safe,
    EMERGENCY: colors.danger,
    CANCELLED: colors.textMuted,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIncidents(await loadIncidents());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: incidents.length,
      safe: incidents.filter((i) => i.status === 'SAFE').length,
      emergency: incidents.filter((i) => i.status === 'EMERGENCY').length,
    }),
    [incidents]
  );

  const confirmClear = () =>
    Alert.alert('Clear history?', 'This permanently deletes every recorded incident.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearIncidents();
          smoothLayout();
          setIncidents([]);
        },
      },
    ]);

  const openMap = (lat: number, lng: number) =>
    Linking.openURL(mapsUrl(lat, lng)).catch(() =>
      Alert.alert('Cannot open Maps', 'No app is available to open the location.')
    );

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={incidents}
      keyExtractor={(i) => i.id}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.textMuted} />
      }
      ListHeaderComponent={
        <View>
          <ScreenHeader title="History" subtitle="Everything Saviour has logged, newest first." />
          {incidents.length > 0 && (
            <>
              <View style={styles.stats}>
                <Stat label="Total" value={stats.total} tint={colors.text} />
                <Stat label="Marked safe" value={stats.safe} tint={colors.safe} />
                <Stat label="Escalated" value={stats.emergency} tint={colors.danger} />
              </View>
              <Button
                title="Clear history"
                icon="🗑️"
                variant="ghost"
                size="sm"
                onPress={confirmClear}
                style={{ alignSelf: 'flex-start', marginBottom: spacing(2) }}
              />
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <EmptyState icon="🛟" title="No incidents recorded" subtitle="Stay safe out there." />
        ) : null
      }
      renderItem={({ item, index }) => {
        const hasCoords = item.latitude != null && item.longitude != null;
        return (
          <MountFade delay={Math.min(index, 8) * 40}>
            <Card style={{ marginBottom: spacing(1.5) }}>
              <View style={styles.rowTop}>
                <Badge text={item.status} color={statusColor[item.status]} />
                <Text style={styles.date}>{relativeTime(item.detectedAt)}</Text>
              </View>
              <Text style={styles.line}>
                {item.source === 'MANUAL_SOS' ? '🆘 Manual SOS' : '🤕 Fall detected'}
                {item.impactMagnitude ? ` · ${item.impactMagnitude.toFixed(1)} g impact` : ''}
              </Text>
              <Text style={styles.timestamp}>{fullTime(item.detectedAt)}</Text>
              {item.address ? <Text style={styles.meta}>📍 {item.address}</Text> : null}
              {hasCoords && (
                <Text
                  style={styles.mapLink}
                  onPress={() => openMap(item.latitude as number, item.longitude as number)}
                >
                  Open location in Maps →
                </Text>
              )}
              {item.contactsAlerted && item.contactsAlerted.length > 0 ? (
                <Text style={styles.meta}>
                  {item.contactsAlerted.length} contact(s) alerted
                  {item.smsOutcome ? ` · ${OUTCOME_LABEL[item.smsOutcome]}` : ''}
                </Text>
              ) : null}
            </Card>
          </MountFade>
        );
      }}
    />
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = ({ colors, type }: ThemeState) =>
  StyleSheet.create({
    container: { padding: spacing(2), paddingBottom: spacing(6) },
    stats: { flexDirection: 'row', gap: spacing(1), marginBottom: spacing(1.5) },
    stat: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingVertical: spacing(1.5),
      alignItems: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '900' },
    statLabel: { ...type.label, fontSize: 10, marginTop: 2 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    date: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    line: { color: colors.text, marginTop: spacing(1.5), fontWeight: '700', fontSize: 14 },
    timestamp: { color: colors.textFaint, fontSize: 12, marginTop: 3 },
    meta: { color: colors.textMuted, marginTop: 6, fontSize: 13, lineHeight: 18 },
    mapLink: { color: colors.primaryHi, marginTop: 6, fontSize: 13, fontWeight: '700' },
  });
