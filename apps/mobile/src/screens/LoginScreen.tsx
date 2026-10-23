import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { forgotPassword } from '../services/api';

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const { signIn } = useAuthStore();

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (phone.length !== 10) {
      setError(t('login.invalidPhone'));
      return;
    }
    try {
      await forgotPassword(phone);
      setInfo(t('login.forgotPasswordSent'));
    } catch (err) {
      setError((err as Error).message || t('common.error'));
    }
  };

  const handleLogin = async () => {
    setError('');
    setInfo('');
    if (phone.length !== 10) {
      setError(t('login.invalidPhone'));
      return;
    }
    if (password.length < 6) {
      setError(t('login.invalidPassword'));
      return;
    }

    setLoading(true);
    try {
      await signIn('+91' + phone, password);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Incorrect phone number or password') || msg.includes('deleted')) {
        setError(t('login.wrongCredentials'));
      } else if (msg.includes('Rate limit') || msg.includes('429')) {
        setError(t('login.tooManyAttempts'));
      } else {
        setError(t('login.genericError'));
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
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('login.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>{t('login.headerSubtitle')}</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {info ? (
          <View style={styles.infoBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#15803d" />
            <Text style={styles.infoText}>{info}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.form}>
          {/* Phone number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('login.phoneLabel')}</Text>
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
            <View style={styles.passwordHeader}>
              <Text style={styles.label}>{t('login.passwordLabel')}</Text>
              <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                <Text style={styles.forgotPassword}>{t('login.forgotPassword')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
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
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Bottom */}
        <View style={styles.bottom}>
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.loginBtnText}>
              {loading ? t('common.loading') : t('login.logIn')}
            </Text>
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('login.noAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')} activeOpacity={0.7}>
              <Text style={styles.switchLink}>{t('login.signUpLink')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { flex: 1, padding: 24 },
  header: { paddingTop: 32, paddingBottom: 40 },
  headerTitle: { fontSize: 30, fontWeight: '600', color: '#171717', marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: '#737373' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 20,
  },
  errorText: { fontSize: 14, color: '#b91c1c', flex: 1 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 20,
  },
  infoText: { fontSize: 14, color: '#15803d', flex: 1 },
  form: { gap: 20 },
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
    paddingHorizontal: 12, paddingVertical: 14,
  },
  passwordHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  forgotPassword: { fontSize: 14, fontWeight: '500', color: '#525252' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d4d4d4',
    borderRadius: 8, overflow: 'hidden',
  },
  passwordInput: {
    flex: 1, fontSize: 16, color: '#171717',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  eyeBtn: { paddingHorizontal: 16, paddingVertical: 14 },
  bottom: { paddingTop: 24, paddingBottom: 16 },
  loginBtn: {
    backgroundColor: '#171717', borderRadius: 8, paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  switchText: { fontSize: 14, color: '#737373' },
  switchLink: { fontSize: 14, fontWeight: '500', color: '#171717' },
});
