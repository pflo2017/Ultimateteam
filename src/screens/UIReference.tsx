import React, { useState } from 'react';
import { View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { CalendarPickerModal } from '../components/CalendarPickerModal';

export const UIReference = () => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  return (
    <View style={{ marginVertical: 32 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Calendar Picker Reference</Text>
      <Button mode="outlined" onPress={() => setShowCalendar(true)}>
        Open Calendar Picker
      </Button>
      <Text style={{ marginTop: 12, marginBottom: 8 }}>
        Selected date: {calendarDate.toLocaleDateString()}
      </Text>
      <CalendarPickerModal
        visible={showCalendar}
        onCancel={() => setShowCalendar(false)}
        onConfirm={() => setShowCalendar(false)}
        value={calendarDate}
        onValueChange={setCalendarDate}
      />
    </View>
  );
}; 