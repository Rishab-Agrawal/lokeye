import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage, LanguageCode } from '../i18n';

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [selectedLanguage, setSelectedLang] = useState(i18n.language || 'en');
  const [showLanguages, setShowLanguages] = useState(false);

  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

  const handleContinue = async () => {
    await setLanguage(selectedLanguage as LanguageCode);
    navigation.navigate('Login');
  };

  const handleSelectLanguage = async (code: string) => {
    setSelectedLang(code);
    setShowLanguages(false);
    await setLanguage(code as LanguageCode);
  };

  const getDisplayName = (lang: typeof SUPPORTED_LANGUAGES[number]) =>
    lang.code === 'en' ? lang.native : `${lang.native} (${lang.label})`;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fafafa" />

      {/* Center content */}
      <View style={styles.centerContent}>
        <Image source={require('../../assets/icon.png')} style={styles.appIcon} />
        <Text style={styles.title}>{t('welcome.title')}</Text>
      </View>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Language selector button */}
        <TouchableOpacity
          style={styles.langButton}
          onPress={() => setShowLanguages(!showLanguages)}
          activeOpacity={0.7}
        >
          <View>
            <Text style={styles.langLabel}>{t('welcome.languageLabel')}</Text>
            <Text style={styles.langValue}>{selectedLang ? getDisplayName(selectedLang) : 'English'}</Text>
          </View>
          <Ionicons
            name="chevron-down"
            size={20}
            color="#737373"
            style={showLanguages ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </TouchableOpacity>

        {/* Language dropdown */}
        {showLanguages && (
          <View style={styles.langList}>
            <ScrollView style={styles.langScroll} bounces={false}>
              {SUPPORTED_LANGUAGES.map((lang, i) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    i < SUPPORTED_LANGUAGES.length - 1 && styles.langOptionBorder,
                  ]}
                  onPress={() => handleSelectLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.langOptionText}>{getDisplayName(lang)}</Text>
                  {selectedLanguage === lang.code && (
                    <Ionicons name="checkmark" size={18} color="#171717" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.hint}>{t('welcome.languageHint')}</Text>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueBtnText}>{t('welcome.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appIcon: {
    width: 120, height: 120, borderRadius: 24, marginBottom: 48,
  },
  title: {
    fontSize: 48, fontWeight: '600', color: '#171717', textAlign: 'center',
  },
  bottomSection: { paddingHorizontal: 24, paddingBottom: 32 },
  langButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d4d4d4',
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 16,
  },
  langLabel: { fontSize: 12, fontWeight: '500', color: '#737373', marginBottom: 2 },
  langValue: { fontSize: 14, fontWeight: '500', color: '#171717' },
  langList: {
    marginTop: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d4d4d4',
    borderRadius: 8, overflow: 'hidden', maxHeight: 256,
  },
  langScroll: {},
  langOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  langOptionBorder: { borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  langOptionText: { fontSize: 14, color: '#171717' },
  hint: { fontSize: 12, color: '#737373', textAlign: 'center', marginTop: 12 },
  continueBtn: {
    backgroundColor: '#171717', borderRadius: 8, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
