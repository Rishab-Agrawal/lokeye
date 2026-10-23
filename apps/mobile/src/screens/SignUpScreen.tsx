import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  StatusBar, ScrollView, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [upiId, setUpiId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmedUpi, setConfirmedUpi] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signUp } = useAuthStore();

  const canSubmit = confirmedUpi && acceptedTerms && !loading;

  const handleSignUp = async () => {
    setError('');
    if (!name.trim()) {
      setError(t('signup.invalidName'));
      return;
    }
    if (phone.length !== 10) {
      setError(t('signup.invalidPhone'));
      return;
    }
    if (password.length < 6) {
      setError(t('signup.invalidPassword'));
      return;
    }
    if (!upiId.match(/^[\w.-]+@[\w]+$/)) {
      setError(t('signup.invalidUpi'));
      return;
    }

    setLoading(true);
    try {
      await signUp('+91' + phone, password, name.trim(), upiId);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('already exists')) {
        setError(t('signup.phoneAlreadyExists'));
      } else if (msg.includes('Rate limit') || msg.includes('429')) {
        setError(t('signup.tooManyAttempts'));
      } else {
        setError(t('signup.genericError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fafafa" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('signup.headerTitle')}</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.form}>
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('signup.nameLabel')}</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Phone number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('signup.phoneLabel')}</Text>
            <View style={styles.phoneContainer}>
              <Text style={styles.phonePrefix}>+91</Text>
              <View style={styles.phoneSeparator} />
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                placeholderTextColor="#a3a3a3"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('signup.passwordLabel')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder={t('signup.passwordPlaceholder')}
                placeholderTextColor="#a3a3a3"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#737373"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* UPI ID */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('signup.upiLabel')}</Text>
            <TextInput
              style={styles.textInput}
              value={upiId}
              onChangeText={setUpiId}
              placeholder={t('signup.upiPlaceholder')}
              placeholderTextColor="#a3a3a3"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.upiHelp}>{t('signup.upiHelp')}</Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1, minHeight: 24 }} />

        {/* Checkboxes */}
        <View style={styles.checkboxes}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setConfirmedUpi(!confirmedUpi)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={confirmedUpi ? 'checkbox' : 'square-outline'}
              size={20}
              color={confirmedUpi ? '#171717' : '#d4d4d4'}
            />
            <Text style={styles.checkboxText}>{t('signup.confirmUpi')}</Text>
          </TouchableOpacity>

          <View style={styles.checkboxRow}>
            <TouchableOpacity
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={acceptedTerms ? 'checkbox' : 'square-outline'}
                size={20}
                color={acceptedTerms ? '#171717' : '#d4d4d4'}
              />
            </TouchableOpacity>
            <Text style={styles.checkboxText}>
              {t('signup.acceptTermsPre')}{' '}
              <Text
                style={styles.termsLink}
                onPress={() => navigation.navigate('Terms' as any)}
              >
                {t('signup.termsLink')}
              </Text>
              {' '}{t('signup.acceptTermsAnd')}{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/human/privacy`)}
              >
                {t('signup.privacyPolicyLink')}
              </Text>
            </Text>
          </View>
        </View>

        {/* Bottom */}
        <View style={styles.bottom}>
          <TouchableOpacity
            style={[styles.createBtn, !canSubmit && styles.btnDisabled]}
            onPress={handleSignUp}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.createBtnText}>
              {loading ? t('common.loading') : t('signup.createAccount')}
            </Text>
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('signup.haveAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
              <Text style={styles.switchLink}>{t('signup.logInLink')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  header: { paddingTop: 32, paddingBottom: 40 },
  headerTitle: { fontSize: 30, fontWeight: '600', color: '#171717', marginBottom: 8 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 20,
  },
  errorText: { fontSize: 14, color: '#b91c1c', flex: 1 },
  form: { gap: 10 },
  fieldGroup: {},
  label: { fontSize: 14, fontWeight: '500', color: '#171717', marginBottom: 8 },
  phoneContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d4d4d4',
    borderRadius: 8, overflow: 'hidden',
  },
  phonePrefix: {
    fontSize: 16, fontWeight: '500', color: '#171717',
    paddingLeft: 16, paddingRight: 12,
  },
  phoneSeparator: { width: 1, height: 20, backgroundColor: '#d4d4d4' },
  phoneInput: {
    flex: 1, fontSize: 16, color: '#171717',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d4d4d4',
    borderRadius: 8, overflow: 'hidden',
  },
  passwordInput: {
    flex: 1, fontSize: 16, color: '#171717',
    paddingHorizontal: 16, paddingVertical: 9,
  },
  eyeBtn: { paddingHorizontal: 16, paddingVertical: 9 },
  textInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d4d4d4',
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9,
    fontSize: 16, color: '#171717',
  },
  upiHelp: { fontSize: 12, color: '#737373', marginTop: 8 },
  checkboxes: { gap: 16, paddingTop: 24 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkboxText: { fontSize: 14, color: '#404040', flex: 1, lineHeight: 20 },
  termsLink: { fontWeight: '500', color: '#2563eb' },
  bottom: { paddingTop: 24, paddingBottom: 16 },
  createBtn: {
    backgroundColor: '#171717', borderRadius: 8, paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#d4d4d4' },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  switchText: { fontSize: 14, color: '#737373' },
  switchLink: { fontSize: 14, fontWeight: '500', color: '#171717' },
});
