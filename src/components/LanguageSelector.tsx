import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '../i18n';

interface LanguageSelectorProps {
  style?: any;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ style }) => {
  const { t } = useTranslation();
  const currentLanguage = getCurrentLanguage();

  const handleLanguageChange = async (language: 'en' | 'ro') => {
    await changeLanguage(language);
  };

  return (
    <View style={[styles.buttonContainer, style]}>
      <TouchableOpacity
        style={[
          styles.languageButton,
          currentLanguage === 'en' && styles.activeButton
        ]}
        onPress={() => handleLanguageChange('en')}
      >
        <Text style={[
          styles.languageText,
          currentLanguage === 'en' && styles.activeText
        ]}>
          English
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.languageButton,
          currentLanguage === 'ro' && styles.activeButton
        ]}
        onPress={() => handleLanguageChange('ro')}
      >
        <Text style={[
          styles.languageText,
          currentLanguage === 'ro' && styles.activeText
        ]}>
          Română
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  activeButton: {
    backgroundColor: '#0CC1EC',
    borderColor: '#0CC1EC',
  },
  languageText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeText: {
    color: '#fff',
  },
}); 