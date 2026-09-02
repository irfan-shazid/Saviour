import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { genId, loadContacts, saveContactOrder, saveContacts } from '../storage';
import type { EmergencyContact } from '../types';
import { useTheme, useThemedStyles, type ThemeState } from '../context/ThemeContext';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  MountFade,
  ScreenHeader,
  smoothLayout,
} from '../components/ui';
import { syncUp } from '../services/sync';
import { initials, looksLikePhone, normalisePhone, telUri } from '../utils/format';
import { spacing } from '../theme';

type Draft = { name: string; phone: string; relationship: string };
const EMPTY: Draft = { name: '', phone: '', relationship: '' };

export function ContactsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const load = useCallback(async () => {
    try {
      setContacts(await loadContacts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    smoothLayout();
    setDraft(EMPTY);
    setEditingId(null);
    setErrors({});
  };

  const startEdit = (c: EmergencyContact) => {
    smoothLayout();
    setEditingId(c.id);
    setDraft({ name: c.name, phone: c.phone, relationship: c.relationship ?? '' });
    setErrors({});
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = 'Name is required';
    if (!draft.phone.trim()) next.phone = 'Phone is required';
    else if (!looksLikePhone(draft.phone)) next.phone = 'That doesn’t look like a phone number';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const clean = {
        name: draft.name.trim(),
        phone: normalisePhone(draft.phone),
        relationship: draft.relationship.trim() || undefined,
      };
      let next: EmergencyContact[];
      if (editingId) {
        next = contacts.map((c) => (c.id === editingId ? { ...c, ...clean } : c));
      } else {
        next = [...contacts, { id: genId(), priority: contacts.length + 1, ...clean }];
      }
      await saveContacts(next);
      syncUp().catch(() => undefined); // mirror to the server when signed in
      smoothLayout();
      setContacts(next);
      resetForm();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= contacts.length) return;
    const next = [...contacts];
    [next[index], next[target]] = [next[target], next[index]];
    smoothLayout(200);
    setContacts(next.map((c, i) => ({ ...c, priority: i + 1 }))); // optimistic
    await saveContactOrder(next); // persist + renumber on disk
    syncUp().catch(() => undefined);
  };

  const remove = (c: EmergencyContact) =>
    Alert.alert('Remove contact', `Remove ${c.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const next = contacts.filter((x) => x.id !== c.id);
          const saved = await saveContactOrder(next);
          syncUp().catch(() => undefined);
          smoothLayout();
          setContacts(saved);
          if (editingId === c.id) resetForm();
        },
      },
    ]);

  const call = (c: EmergencyContact) =>
    Linking.openURL(telUri(c.phone)).catch(() =>
      Alert.alert('Cannot call', 'This device can’t place calls.')
    );

  const ordered = contacts.length > 1;

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={contacts}
      keyExtractor={(c) => c.id}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.textMuted} />
      }
      ListHeaderComponent={
        <View>
          <ScreenHeader
            title="Emergency contacts"
            subtitle={
              ordered
                ? 'Texted your location in priority order when an incident escalates.'
                : 'Texted your location when an incident escalates.'
            }
          />
          <Card style={{ marginBottom: spacing(2) }}>
            <Text style={styles.formTitle}>{editingId ? 'Edit contact' : 'Add a contact'}</Text>
            <Field
              label="Name"
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder="Jane Doe"
              error={errors.name}
            />
            <Field
              label="Phone (with country code)"
              value={draft.phone}
              onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))}
              placeholder="+1 555 000 1234"
              keyboardType="phone-pad"
              error={errors.phone}
            />
            <Field
              label="Relationship (optional)"
              value={draft.relationship}
              onChangeText={(relationship) => setDraft((d) => ({ ...d, relationship }))}
              placeholder="Spouse, Parent…"
            />
            <Button
              title={editingId ? 'Save changes' : 'Add contact'}
              icon={editingId ? '💾' : '＋'}
              onPress={submit}
              loading={saving}
            />
            {editingId ? (
              <Button
                title="Cancel"
                variant="ghost"
                size="md"
                onPress={resetForm}
                style={{ marginTop: spacing(1) }}
              />
            ) : null}
          </Card>
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <EmptyState
            icon="👥"
            title="No contacts yet"
            subtitle="Add the people you'd want alerted after an accident."
          />
        ) : null
      }
      renderItem={({ item, index }) => (
        <MountFade delay={Math.min(index, 6) * 45}>
          <Card style={styles.row} padded={false}>
            <View style={styles.rowMain}>
              <Avatar
                initials={initials(item.name)}
                color={index === 0 && ordered ? colors.safe : colors.primary}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.nameLine}>
                  <Text style={styles.name}>{item.name}</Text>
                  {index === 0 && ordered && <Badge text="FIRST" color={colors.safe} />}
                </View>
                <Text style={styles.meta}>
                  {item.phone}
                  {item.relationship ? ` · ${item.relationship}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              {ordered && (
                <>
                  <IconButton
                    glyph="↑"
                    label="Move up"
                    onPress={() => move(index, -1)}
                    disabled={index === 0}
                  />
                  <IconButton
                    glyph="↓"
                    label="Move down"
                    onPress={() => move(index, 1)}
                    disabled={index === contacts.length - 1}
                  />
                </>
              )}
              <View style={{ flex: 1 }} />
              <IconButton glyph="✏️" label={`Edit ${item.name}`} onPress={() => startEdit(item)} />
              <IconButton
                glyph="📞"
                label={`Call ${item.name}`}
                onPress={() => call(item)}
                tint={colors.safeHi}
              />
              <IconButton
                glyph="✕"
                label={`Remove ${item.name}`}
                onPress={() => remove(item)}
                tint={colors.dangerHi}
              />
            </View>
          </Card>
        </MountFade>
      )}
    />
  );
}

const makeStyles = ({ colors, type }: ThemeState) =>
  StyleSheet.create({
    container: { padding: spacing(2), paddingBottom: spacing(6) },
    formTitle: { ...type.h3, marginBottom: spacing(1.5) },
    row: { marginBottom: spacing(1.5), overflow: 'hidden' },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), padding: spacing(2) },
    nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), flexWrap: 'wrap' },
    name: { color: colors.text, fontWeight: '800', fontSize: 16 },
    meta: { color: colors.textMuted, marginTop: 3, fontSize: 13 },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing(0.75),
      paddingHorizontal: spacing(1.5),
      paddingBottom: spacing(1.5),
    },
  });
