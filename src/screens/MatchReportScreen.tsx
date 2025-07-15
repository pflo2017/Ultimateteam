import React, { useEffect, useState } from 'react';
import { View, ScrollView, Alert, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Text, Button, Appbar, TextInput, Portal, Dialog } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getEventsForActivity, addEventsForActivity, addSingleEvent, ActivityEvent, ActivityEventType } from '../services/activityEventsService';
import { COLORS } from '../constants/theme';
import { filterValidPlayers } from '../utils/playerValidation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

// Types
interface MatchReportScreenRouteParams {
  activityId: string;
  lineupPlayers: { id: string; name: string }[];
}

type MatchReportScreenRouteProp = RouteProp<{ params: MatchReportScreenRouteParams }, 'params'>;

// Type guard to ensure event type is valid
const isValidEventType = (type: string): type is ActivityEventType => {
  return ['goal', 'assist', 'yellow_card', 'red_card', 'man_of_the_match'].includes(type);
};

// Type guard to ensure half is valid
const isValidHalf = (half: string): half is 'first' | 'second' => {
  return ['first', 'second'].includes(half);
};

export default function MatchReportScreen() {
  const navigation = useNavigation();
  const route = useRoute<MatchReportScreenRouteProp>();
  const { activityId, lineupPlayers } = route.params;
  const { t } = useTranslation();

  const eventTypeOptions = [
    { label: t('activity.goal'), value: 'goal' as const },
    { label: t('activity.assist'), value: 'assist' as const },
    { label: t('activity.yellowCard'), value: 'yellow_card' as const },
    { label: t('activity.redCard'), value: 'red_card' as const },
    { label: t('activity.manOfTheMatch'), value: 'man_of_the_match' as const },
  ];

  const halfOptions = [
    { label: t('activity.firstHalf'), value: 'first' as const },
    { label: t('activity.secondHalf'), value: 'second' as const },
  ];

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<ActivityEvent | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<ActivityEvent | null>(null);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [showHalfPicker, setShowHalfPicker] = useState(false);
  const [showMinuteInput, setShowMinuteInput] = useState(false);
  const [userRole, setUserRole] = useState<'parent' | 'coach' | 'admin' | null>(null);

  // Form state
  const [formType, setFormType] = useState<ActivityEventType>('goal');
  const [formPlayerId, setFormPlayerId] = useState<string>('');
  const [formMinute, setFormMinute] = useState<string>('');
  const [formHalf, setFormHalf] = useState<'first' | 'second'>('first');

  useEffect(() => {
    fetchEvents();
    determineUserRole();
  }, [activityId]);

  const determineUserRole = async () => {
    try {
      const parentData = await AsyncStorage.getItem('parent_data');
      const coachData = await AsyncStorage.getItem('coach_data');
      const adminData = await AsyncStorage.getItem('admin_data');
      const userData = await AsyncStorage.getItem('user_data');
      
      if (parentData) {
        setUserRole('parent');
        return;
      }
      if (coachData) {
        setUserRole('coach');
        return;
      }
      if (adminData) {
        setUserRole('admin');
        return;
      }
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user && (user.role === 'admin' || user.isAdmin)) {
            setUserRole('admin');
            return;
          }
        } catch (e) {
          // ignore parse error
        }
      }
    } catch (error) {
      console.error('Error determining user role:', error);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await getEventsForActivity(activityId);
    if (!error && data) {
      // Sort events: first half before second half, then by minute within each half
      const sortedEvents = data.sort((a, b) => {
        // First sort by half (1st half before 2nd half)
        if (a.half !== b.half) {
          return a.half === 'first' ? -1 : 1;
        }
        // Then sort by minute within the same half
        const minuteA = a.minute || 0;
        const minuteB = b.minute || 0;
        return minuteA - minuteB;
      });
      setEvents(sortedEvents);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormType('goal');
    setFormPlayerId('');
    setFormMinute('');
    setFormHalf('first');
    setEditingEvent(null);
  };

  const handleSave = async () => {
    if (!formPlayerId || !formType) {
      Alert.alert(t('common.error'), t('activity.selectEventType'));
      return;
    }

    // Validate event type
    if (!isValidEventType(formType)) {
      Alert.alert(t('common.error'), t('activity.invalidEventType'));
      return;
    }

    // Validate half
    if (!isValidHalf(formHalf)) {
      Alert.alert(t('common.error'), t('activity.invalidHalf'));
      return;
    }

    // Validate minute is required for all events except man_of_the_match
    if (formType !== 'man_of_the_match' && !formMinute.trim()) {
      Alert.alert(t('common.error'), t('activity.minuteRequired'));
      return;
    }

    const newEvent: ActivityEvent = {
      id: editingEvent?.id,
      activity_id: activityId,
      event_type: formType,
      player_id: formPlayerId,
      minute: formMinute ? parseInt(formMinute) : undefined,
      half: formHalf,
      created_at: new Date().toISOString(),
    };

    if (editingEvent) {
      // Edit existing - replace all events
      const updatedEvents = events.map(ev => (ev.id === editingEvent.id ? { ...ev, ...newEvent } : ev));
      const { error } = await addEventsForActivity(activityId, updatedEvents);
      if (error) {
        Alert.alert(t('common.error'), t('activity.couldNotSaveEvent') + ': ' + error.message);
        return;
      }
      setEvents(updatedEvents);
    } else {
      // Add new event
      const { data, error } = await addSingleEvent(newEvent);
      if (error) {
        Alert.alert(t('common.error'), t('activity.couldNotSaveEvent') + ': ' + error.message);
        return;
      }
      // Refresh events to get the new one with proper ID
      fetchEvents();
    }
    resetForm();
  };

  const handleEdit = (event: ActivityEvent) => {
    setEditingEvent(event);
    setFormType(event.event_type);
    setFormPlayerId(event.player_id || '');
    setFormMinute(event.minute ? event.minute.toString() : '');
    setFormHalf(event.half === 'first' || event.half === 'second' ? event.half : 'first');
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;
    const updatedEvents = events.filter(ev => ev.id !== eventToDelete.id);
    const { error } = await addEventsForActivity(activityId, updatedEvents);
    if (error) {
      Alert.alert(t('common.error'), t('activity.couldNotDeleteEvent') + ': ' + error.message);
      return;
    }
    setEvents(updatedEvents);
    setShowDeleteDialog(false);
    setEventToDelete(null);
  };

  const getEventIcon = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'goal':
        return 'soccer';
      case 'assist':
        return 'handshake';
      case 'yellow_card':
        return 'cards';
      case 'red_card':
        return 'cards';
      case 'man_of_the_match':
        return 'star';
      default:
        return 'star';
    }
  };

  const getEventColor = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'goal':
        return '#43a047';
      case 'assist':
        return '#1976d2';
      case 'yellow_card':
        return '#fbc02d';
      case 'red_card':
        return '#d32f2f';
      case 'man_of_the_match':
        return '#FFD700';
      default:
        return '#FFD700';
    }
  };

  const getEventLabel = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'goal':
        return 'Gol';
      case 'assist':
        return 'Assist';
      case 'yellow_card':
        return 'Galben';
      case 'red_card':
        return 'Roșu';
      case 'man_of_the_match':
        return 'Man of the match';
      default:
        return 'Eveniment';
    }
  };

  const getHalfLabel = (half: string) => {
    switch (half) {
      case 'first':
        return '1 repriză';
      case 'second':
        return '2 repriză';
      default:
        return '';
    }
  };

  const selectedPlayerName = formPlayerId ? lineupPlayers.find(p => p.id === formPlayerId)?.name : '';

  return (
    <View style={{ flex: 1, backgroundColor: '#f7fafd' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', elevation: 0, shadowOpacity: 0 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Appbar.Content title={t('activity.matchReport')} titleStyle={{ fontWeight: 'bold', fontSize: 20 }} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>{t('activity.events')}</Text>
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : events.length === 0 ? (
          <Text style={{ color: COLORS.grey[600] }}>{t('activity.noEventsYet')}</Text>
        ) : (
          events.map(ev => (
            <View key={ev.id || ev.player_id + ev.event_type + ev.minute} style={styles.eventCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MaterialCommunityIcons
                  name={getEventIcon(ev.event_type)}
                  color={getEventColor(ev.event_type)}
                  size={22}
                  style={{ marginRight: 12 }}
                />
                <Text style={{ fontSize: 13, flex: 1, fontWeight: '500', color: '#222' }}>
                  {ev.event_type === 'man_of_the_match'
                    ? `${lineupPlayers.find(p => p.id === ev.player_id)?.name || ''}`
                    : `${lineupPlayers.find(p => p.id === ev.player_id)?.name || ''} (${getHalfLabel(ev.half || 'first')}, min ${ev.minute || ''})`
                  }
                </Text>
              </View>
              {userRole === 'coach' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                  <TouchableOpacity onPress={() => handleEdit(ev)} style={styles.iconButton}>
                    <MaterialCommunityIcons name="pencil" size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEventToDelete(ev); setShowDeleteDialog(true); }} style={styles.iconButton}>
                    <MaterialCommunityIcons name="delete" size={14} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 32 }} />
        {userRole === 'coach' && (
          <View style={styles.formCard}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>{editingEvent ? t('activity.editEvent') : t('activity.addEvent')}</Text>
            <Text style={{ marginBottom: 8, fontWeight: '500' }}>{t('activity.eventType')}:</Text>
            <View style={styles.pillRow}>
              {eventTypeOptions.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pill, formType === opt.value && styles.pillActive]}
                  onPress={() => setFormType(opt.value)}
                >
                  <Text style={[styles.pillText, formType === opt.value && styles.pillTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <Text style={{ fontWeight: '500', marginBottom: 4 }}>{t('activity.player')}</Text>
              <View style={styles.playerMinuteRow}>
                <TouchableOpacity
                  style={styles.playerSelector}
                  onPress={() => setShowPlayerPicker(true)}
                >
                  <Text style={[styles.playerSelectorText, !selectedPlayerName && styles.placeholderText]}>
                    {selectedPlayerName || t('activity.selectPlayer')}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.primary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <Text style={{ fontWeight: '500', marginBottom: 4 }}>{t('activity.halfAndMinute')}</Text>
              <View style={styles.halfMinuteRow}>
                <TouchableOpacity
                  style={styles.halfSelector}
                  onPress={() => setShowHalfPicker(true)}
                >
                  <Text style={[styles.halfSelectorText, !formHalf && styles.placeholderText]}>
                    {formHalf === 'first' ? t('activity.firstHalf') : formHalf === 'second' ? t('activity.secondHalf') : t('activity.half') + ':'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.primary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                <TextInput
                  value={formMinute}
                  onChangeText={setFormMinute}
                  keyboardType="number-pad"
                  style={styles.simpleMinuteInput}
                  placeholder="min"
                  placeholderTextColor={COLORS.grey[500]}
                  maxLength={3}
                />

              </View>
            </View>
            <Button mode="contained" onPress={handleSave} style={styles.addButton}>{editingEvent ? t('activity.saveChanges') : t('activity.addEvent')}</Button>
            {editingEvent && (
              <Button mode="text" onPress={resetForm} style={{ marginTop: 4 }}>{t('activity.cancelEdit')}</Button>
            )}
          </View>
        )}
      </ScrollView>

      {/* Player Picker Modal */}
      {userRole === 'coach' && (
        <Modal
          visible={showPlayerPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPlayerPicker(false)}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('activity.selectPlayer')}</Text>
              <TouchableOpacity onPress={() => setShowPlayerPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {filterValidPlayers(lineupPlayers).map(player => (
                <TouchableOpacity
                  key={player.id}
                  style={styles.playerOption}
                  onPress={() => {
                    setFormPlayerId(player.id);
                    setShowPlayerPicker(false);
                  }}
                >
                  <Text style={styles.playerOptionText}>{player.name}</Text>
                </TouchableOpacity>
              ))}
                        </ScrollView>
          </View>
        </View>
      </Modal>
      )}

      {/* Half Picker Modal */}
      {userRole === 'coach' && (
        <Modal
          visible={showHalfPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowHalfPicker(false)}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('activity.selectHalf')}</Text>
              <TouchableOpacity onPress={() => setShowHalfPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {halfOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.playerOption}
                  onPress={() => {
                    setFormHalf(option.value);
                    setShowHalfPicker(false);
                  }}
                >
                  <Text style={styles.playerOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}

      <Portal>
        {userRole === 'coach' && (
          <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
            <Dialog.Title>{t('activity.deleteEventConfirmation')}</Dialog.Title>
            <Dialog.Content>
              <Text>{t('activity.deleteEventConfirmation')}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDeleteDialog(false)}>{t('activity.cancel')}</Button>
              <Button onPress={handleDelete} color={COLORS.error}>{t('activity.delete')}</Button>
            </Dialog.Actions>
          </Dialog>
        )}
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  iconButton: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f2f6fa',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 32,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 8,
  },
  pill: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f7fafd',
    minHeight: 28,
    minWidth: 0,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 13,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  simpleMinuteInput: {
    width: 60,
    height: 15,
    fontSize: 12,
    color: COLORS.primary,
    textAlign: 'center',
    backgroundColor: 'transparent',
    marginRight: 8,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    lineHeight: 15,
  },

  addButton: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 8,
    fontWeight: 'bold',
    fontSize: 16,
  },
  playerMinuteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  playerSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    marginRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  playerSelectorText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 14,
    flex: 1,
  },
  placeholderText: {
    color: COLORS.grey[500],
    fontStyle: 'italic',
  },
  halfMinuteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginBottom: 8,
  },
  halfSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    marginRight: 0,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  halfSelectorText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 14,
    flex: 1,
  },
  minuteSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    marginRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  minuteSelectorText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 14,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[200],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  modalScrollView: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  playerOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grey[100],
  },
  playerOptionText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
}); 