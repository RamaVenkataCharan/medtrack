import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import { getReminders, addReminder } from '../db/database';
import FilterPills from '../components/FilterPills';

export default function RemindersScreen({ navigation }) {
  const [filter, setFilter] = useState('upcoming');
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRemindersList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReminders();
      setReminders(data || []);
    } catch (err) {
      console.warn('Failed to load reminders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRemindersList();
  }, [loadRemindersList]);

  const handleAddReminder = async () => {
    if (!newTitle.trim()) {
      const msg = 'Please enter a reminder title.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }
    if (!newDate.trim()) {
      const msg = 'Please enter a reminder date (YYYY-MM-DD).';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }

    setSaving(true);
    try {
      await addReminder({
        title: newTitle.trim(),
        due_date: newDate.trim(),
        notes: newNotes.trim(),
      });
      setShowAddModal(false);
      setNewTitle('');
      setNewDate('');
      setNewNotes('');
      loadRemindersList();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save reminder');
    } finally {
      setSaving(false);
    }
  };

  const filteredReminders = reminders.filter((item) => {
    if (filter === 'upcoming') return !item.is_expired;
    if (filter === 'history') return item.is_expired;
    return true;
  });

  const filterOptions = [
    { key: 'upcoming', label: 'Upcoming', count: reminders.filter((r) => !r.is_expired).length },
    { key: 'history', label: 'History' },
    { key: 'all', label: 'All', count: reminders.length },
  ];

  const primaryLicence = reminders.find((r) => r.type === 'pharmacist') || reminders.find((r) => r.type === 'shop') || reminders[0];
  const bannerTitle = primaryLicence
    ? primaryLicence.title
    : 'No Active Licences Configured';
  const bannerDescription = primaryLicence
    ? (primaryLicence.is_expired
        ? `Licence expired on ${primaryLicence.valid_till || primaryLicence.due_date}. Immediate renewal is required.`
        : `Valid till ${primaryLicence.valid_till || primaryLicence.due_date} (${primaryLicence.days_left != null ? primaryLicence.days_left : 0} days remaining). Advance alert active.`)
    : 'Add your pharmacist or shop licence validity date in Settings to receive automated renewal reminders.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Licence Reminders</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Add reminder"
        >
          <Ionicons name="add-circle" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* In-App Expiry Notification Alert Banner */}
      <View style={styles.notificationBanner}>
        <View style={styles.bannerIconWrap}>
          <Ionicons
            name={primaryLicence?.is_expired ? 'alert-circle' : 'shield-checkmark'}
            size={24}
            color={primaryLicence?.is_expired ? COLORS.error : COLORS.primary}
          />
        </View>
        <View style={styles.bannerContent}>
          <View style={styles.bannerHeaderRow}>
            <Text style={styles.bannerAppName}>MedTrack Notification</Text>
            <Text style={styles.bannerTime}>Live Status</Text>
          </View>
          <Text style={styles.bannerTitle}>{bannerTitle}</Text>
          <Text style={styles.bannerDescription}>{bannerDescription}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterWrap}>
        <FilterPills
          options={filterOptions}
          selected={filter}
          onSelect={setFilter}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Checking active reminders...</Text>
        </View>
      ) : filteredReminders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No Reminders Found</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'upcoming'
              ? 'No upcoming reminders. All regulatory licences are in order.'
              : 'No past reminders recorded.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {filteredReminders.map((rem) => {
            const isLicense = rem.type === 'license';
            const daysLeft = rem.days_left;

            return (
              <View key={rem.id} style={styles.reminderCard}>
                <View style={styles.reminderHeader}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: isLicense ? COLORS.primaryLight : '#EBF3FB' },
                    ]}
                  >
                    <Ionicons
                      name={isLicense ? 'shield-checkmark' : 'calendar'}
                      size={20}
                      color={isLicense ? COLORS.primary : '#2B6CB0'}
                    />
                  </View>
                  <View style={styles.reminderInfo}>
                    <Text style={styles.reminderTitle}>{rem.title}</Text>
                    <Text style={styles.reminderSubtitle}>{rem.subtitle || rem.due_date}</Text>
                  </View>
                  {daysLeft !== undefined && (
                    <View
                      style={[
                        styles.daysBadge,
                        daysLeft <= 90 ? styles.daysBadgeUrgent : styles.daysBadgeNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.daysBadgeText,
                          daysLeft <= 90 ? styles.daysBadgeTextUrgent : styles.daysBadgeTextNormal,
                        ]}
                      >
                        {rem.status || `${daysLeft} days`}
                      </Text>
                    </View>
                  )}
                </View>

                {rem.notes ? (
                  <View style={styles.reminderNotes}>
                    <Text style={styles.notesText}>{rem.notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add Reminder Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Licence Reminder</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                accessibilityLabel="Close modal"
              >
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Reminder Title *</Text>
                <TextInput
                  style={styles.input}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="e.g. Shop Licence Renewal"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expiry / Due Date (YYYY-MM-DD) *</Text>
                <TextInput
                  style={styles.input}
                  value={newDate}
                  onChangeText={setNewDate}
                  placeholder="2026-12-31"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={newNotes}
                  onChangeText={setNewNotes}
                  placeholder="Additional renewal requirements or notes"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleAddReminder}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalBtnText}>Save Reminder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? 12 : SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    color: COLORS.text,
    fontWeight: '700',
  },
  addBtn: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  notificationBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF4EE',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#F8B4A2',
  },
  bannerIconWrap: {
    marginRight: SPACING.md,
    paddingTop: 2,
  },
  bannerContent: {
    flex: 1,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  bannerAppName: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  bannerTime: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  bannerTitle: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  bannerDescription: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  filterWrap: {
    backgroundColor: COLORS.surface,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  reminderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  reminderSubtitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  daysBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  daysBadgeUrgent: {
    backgroundColor: '#FDECE7',
    borderColor: '#F8B4A2',
  },
  daysBadgeNormal: {
    backgroundColor: '#EBF7EE',
    borderColor: '#BFE7C6',
  },
  daysBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    fontWeight: '700',
  },
  daysBadgeTextUrgent: {
    color: COLORS.error,
  },
  daysBadgeTextNormal: {
    color: COLORS.success,
  },
  reminderNotes: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  notesText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalForm: {},
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.label,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGETS.minHeight,
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.text,
  },
  saveModalBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  saveModalBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
