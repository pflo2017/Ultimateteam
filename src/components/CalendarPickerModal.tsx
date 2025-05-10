import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
// @ts-ignore: If type declarations are missing for react-native-paper-dates, ignore for now
import { DatePickerModal } from 'react-native-paper-dates';

interface CalendarPickerModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  value: Date;
  onValueChange: (date: Date) => void;
}

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  value,
  onValueChange,
}) => {
  // iOS: spinner in modal (as before)
  if (Platform.OS === 'ios') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCentered}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderText}>Select date</Text>
              <Pressable onPress={onCancel}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>
            <DateTimePicker
              testID="CalendarPickerModal"
              value={value}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) onValueChange(selectedDate);
              }}
              maximumDate={new Date()}
              textColor={COLORS.text}
              themeVariant="light"
            />
            <View style={styles.modalButtonsRow}>
              <Pressable onPress={onCancel} style={styles.modalTextButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onConfirm} style={styles.modalTextButton}>
                <Text style={styles.okText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
  // Android: use react-native-paper-dates
  if (Platform.OS === 'android') {
    const today = new Date();
    const fortyYearsAgo = new Date();
    fortyYearsAgo.setFullYear(today.getFullYear() - 40);
    return (
      <DatePickerModal
        visible={visible}
        date={value}
        onDismiss={onCancel}
        onConfirm={({ date }: { date: Date | undefined }) => {
          if (date) onValueChange(date);
          onConfirm();
        }}
        mode="single"
        validRange={{ startDate: fortyYearsAgo, endDate: today }}
        saveLabel="OK"
        label="Select date"
        animationType="slide"
        locale="en"
      />
    );
  }
  return null;
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentCentered: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.lg,
    width: 340,
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalHeaderText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Urbanist',
  },
  closeButton: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
    gap: 16,
  },
  modalTextButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  okText: {
    color: '#0CC1EC',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
}); 