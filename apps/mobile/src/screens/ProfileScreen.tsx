import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, ActivityIndicator, FlatList, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth';
import { closeAccount, getProfile, requestHumanSupport, updateProfile } from '../services/api';
import { authChangePassword } from '../services/authApi';
import { CloseAccountAction, Human } from '@lokeye/shared';
import { SUPPORTED_LANGUAGES, setLanguage, LanguageCode } from '../i18n';
import { colors as C } from '../theme';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { user, signOut, session } = useAuthStore();
  const [profile, setProfile] = useState<Human | null>(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiInput, setUpiInput] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiError, setUpiError] = useState('');
  const [showLangModal, setShowLangModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportInput, setSupportInput] = useState('');
  const [supportError, setSupportError] = useState('');
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [sendingSupport, setSendingSupport] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showDeleteAccountResultModal, setShowDeleteAccountResultModal] = useState(false);
  const [deleteAccountMessage, setDeleteAccountMessage] = useState('');
  const [deleteAccountAction, setDeleteAccountAction] = useState<CloseAccountAction | null>(null);
  const [closingAccount, setClosingAccount] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
  }, []);

  const handleEditUpi = () => {
    setUpiInput(profile?.upi_vpa || '');
    setUpiError('');
    setShowUpiModal(true);
  };

  const validateUpi = (value: string): string => {
    if (!value) return t('profile.upiRequired');
    const atIndex = value.indexOf('@');
    if (atIndex < 1 || atIndex === value.length - 1) return t('profile.upiInvalid');
    return '';
  };

  const handleSaveUpi = async () => {
    const trimmed = upiInput.trim();
    const error = validateUpi(trimmed);
    if (error) {
      setUpiError(error);
      return;
    }
    setSavingUpi(true);
    setUpiError('');
    try {
      const updated = await updateProfile({ upi_vpa: trimmed });
      setProfile(updated);
      setShowUpiModal(false);
    } catch (err) {
      setUpiError((err as Error).message);
    } finally {
      setSavingUpi(false);
    }
  };

  const handleChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess(false);
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setShowPasswordModal(true);
  };

  const handleSavePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError(t('profile.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }

    setSavingPassword(true);
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      await authChangePassword(currentPassword, newPassword, token);
      setPasswordSuccess(true);
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err) {
      const msg = (err as Error).message;
      setPasswordError(msg.includes('incorrect') ? t('profile.currentPasswordWrong') : msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = () => setShowSignOutModal(true);

  const handleOpenSupport = () => {
    setSupportInput('');
    setSupportError('');
    setSupportSuccess(false);
    setShowSupportModal(true);
  };

  const handleSendSupport = async () => {
    const trimmed = supportInput.trim();
    if (!trimmed) {
      setSupportError('Please enter a short message.');
      return;
    }
    if (trimmed.length > 100) {
      setSupportError('Message must be at most 100 characters.');
      return;
    }

    setSendingSupport(true);
    setSupportError('');
    try {
      await requestHumanSupport(trimmed);
      setSupportSuccess(true);
      setTimeout(() => setShowSupportModal(false), 1200);
    } catch (err) {
      setSupportError((err as Error).message);
    } finally {
      setSendingSupport(false);
    }
  };

  const handleSelectLanguage = async (code: LanguageCode) => {
    setShowLangModal(false);
    await setLanguage(code);
  };

  const handleRequestDeleteAccount = () => {
    setShowDeleteAccountModal(true);
  };

  const handleConfirmDeleteAccount = async () => {
    setClosingAccount(true);
    try {
      const result = await closeAccount();
      setShowDeleteAccountModal(false);
      setDeleteAccountAction(result.action);
      setDeleteAccountMessage(result.message);
      setShowDeleteAccountResultModal(true);
    } catch (err) {
      setShowDeleteAccountModal(false);
      setDeleteAccountAction(null);
      setDeleteAccountMessage((err as Error).message || t('common.error'));
      setShowDeleteAccountResultModal(true);
    } finally {
      setClosingAccount(false);
    }
  };

  const handleDismissDeleteAccountResult = async () => {
    const action = deleteAccountAction;
    setShowDeleteAccountResultModal(false);
    setDeleteAccountAction(null);
    setDeleteAccountMessage('');

    if (action === 'deleted') {
      await signOut();
    }
  };

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  const displayName = profile?.display_name || '';
  const rawPhone = user?.phone || '';
  const phone = rawPhone
    ? rawPhone.replace(/^\+?(\d{1,3})(\d{10})$/, '+$1 $2')
    : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.header')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile info card */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.name')}</Text>
            <Text style={styles.value}>{displayName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile.phoneNumber')}</Text>
            <Text style={styles.value}>{phone}</Text>
          </View>
        </View>

        {/* Settings card */}
        <View style={styles.settingsCard}>
          {/* Language */}
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={() => setShowLangModal(true)}>
            <View>
              <Text style={styles.settingTitle}>{t('profile.language')}</Text>
              <Text style={styles.settingSubtitle}>{currentLang.native}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.neutral400} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          {/* UPI ID */}
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={handleEditUpi}>
            <View>
              <Text style={styles.settingTitle}>{t('profile.upiId')}</Text>
              <Text style={styles.settingSubtitle}>{profile ? (profile.upi_vpa || t('profile.upiNotSet')) : ' '}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.neutral400} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          {/* Change Password */}
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={handleChangePassword}>
            <View style={styles.settingWithIcon}>
              <Ionicons name="lock-closed-outline" size={18} color={C.neutral400} />
              <Text style={styles.settingTitle}>{t('profile.changePassword')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.neutral400} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          {/* Support */}
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.6}
            onPress={handleOpenSupport}
          >
            <View style={styles.settingWithIcon}>
              <Ionicons name="help-circle-outline" size={18} color={C.neutral400} />
              <Text style={styles.settingTitle}>{t('profile.support')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.neutral400} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          {/* Terms */}
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={() => navigation.navigate('Terms')}>
            <View style={styles.settingWithIcon}>
              <Ionicons name="document-text-outline" size={18} color={C.neutral400} />
              <Text style={styles.settingTitle}>{t('signup.termsLink')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.neutral400} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          {/* Privacy Policy */}
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/human/privacy`)}>
            <View style={styles.settingWithIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color={C.neutral400} />
              <Text style={styles.settingTitle}>{t('signup.privacyPolicyLink')}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={C.neutral400} />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccountButton} onPress={handleRequestDeleteAccount} activeOpacity={0.7}>
          <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <View style={styles.versionWrap}>
          <Text style={styles.versionText}>{t('profile.version', { version: '1.0.0' })}</Text>
        </View>
      </ScrollView>

      {/* UPI Edit Modal */}
      <Modal visible={showUpiModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile.updateUpi')}</Text>
            <TextInput
              style={[styles.modalInput, upiError ? styles.modalInputError : null]}
              value={upiInput}
              onChangeText={(v) => { setUpiInput(v); setUpiError(''); }}
              placeholder={t('profile.upiPlaceholder')}
              placeholderTextColor={C.neutral400}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoFocus
            />
            {upiError ? <Text style={styles.errorText}>{upiError}</Text> : null}
            <TouchableOpacity
              style={[styles.modalSaveButton, savingUpi && styles.modalButtonDisabled]}
              onPress={handleSaveUpi}
              disabled={savingUpi}
              activeOpacity={0.85}
            >
              {savingUpi ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalSaveText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowUpiModal(false)}
              disabled={savingUpi}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Support Modal */}
      <Modal visible={showSupportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Support</Text>
            {supportSuccess ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#15803d" />
                <Text style={styles.successText}>Support request sent.</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.modalInput, styles.supportInput, supportError ? styles.modalInputError : null]}
                  value={supportInput}
                  onChangeText={(v) => {
                    setSupportInput(v);
                    setSupportError('');
                  }}
                  placeholder="Describe your issue (max 100 chars)"
                  placeholderTextColor={C.neutral400}
                  maxLength={100}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
                <Text style={styles.charCount}>{supportInput.length}/100</Text>
                {supportError ? <Text style={styles.errorText}>{supportError}</Text> : null}
                <TouchableOpacity
                  style={[styles.modalSaveButton, sendingSupport && styles.modalButtonDisabled]}
                  onPress={handleSendSupport}
                  disabled={sendingSupport}
                  activeOpacity={0.85}
                >
                  {sendingSupport ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>Send</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowSupportModal(false)}
                  disabled={sendingSupport}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={showLangModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.langModalCard}>
            <Text style={styles.modalTitle}>{t('profile.selectLanguage')}</Text>
            <FlatList
              data={SUPPORTED_LANGUAGES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.langRow, item.code === i18n.language && styles.langRowActive]}
                  onPress={() => handleSelectLanguage(item.code)}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={[styles.langNative, item.code === i18n.language && styles.langTextActive]}>{item.native}</Text>
                    <Text style={styles.langLabel}>{item.label}</Text>
                  </View>
                  {item.code === i18n.language && (
                    <Ionicons name="checkmark" size={20} color={C.neutral900} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLangModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile.changePassword')}</Text>
            {passwordSuccess ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#15803d" />
                <Text style={styles.successText}>{t('profile.passwordChanged')}</Text>
              </View>
            ) : (
              <>
                <View style={[styles.passwordRow, passwordError ? styles.modalInputError : null]}>
                  <TextInput
                    style={styles.passwordField}
                    value={currentPassword}
                    onChangeText={(v) => { setCurrentPassword(v); setPasswordError(''); }}
                    placeholder={t('profile.currentPassword')}
                    placeholderTextColor={C.neutral400}
                    secureTextEntry={!showCurrentPw}
                    autoFocus
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)} style={styles.eyeButton} activeOpacity={0.7}>
                    <Ionicons name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.neutral500} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.passwordRow, passwordError ? styles.modalInputError : null]}>
                  <TextInput
                    style={styles.passwordField}
                    value={newPassword}
                    onChangeText={(v) => { setNewPassword(v); setPasswordError(''); }}
                    placeholder={t('profile.newPassword')}
                    placeholderTextColor={C.neutral400}
                    secureTextEntry={!showNewPw}
                  />
                  <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={styles.eyeButton} activeOpacity={0.7}>
                    <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.neutral500} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.passwordRow, { marginBottom: passwordError ? 6 : 20 }, passwordError ? styles.modalInputError : null]}>
                  <TextInput
                    style={styles.passwordField}
                    value={confirmPassword}
                    onChangeText={(v) => { setConfirmPassword(v); setPasswordError(''); }}
                    placeholder={t('profile.confirmPassword')}
                    placeholderTextColor={C.neutral400}
                    secureTextEntry={!showConfirmPw}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={styles.eyeButton} activeOpacity={0.7}>
                    <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.neutral500} />
                  </TouchableOpacity>
                </View>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                <TouchableOpacity
                  style={[styles.modalSaveButton, savingPassword && styles.modalButtonDisabled]}
                  onPress={handleSavePassword}
                  disabled={savingPassword}
                  activeOpacity={0.85}
                >
                  {savingPassword ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowPasswordModal(false)}
                  disabled={savingPassword}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Sign Out Modal */}
      <Modal visible={showSignOutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.signOutIconWrap}>
              <Ionicons name="log-out-outline" size={36} color={C.red600} />
            </View>
            <Text style={styles.modalTitle}>{t('profile.signOut')}</Text>
            <Text style={styles.signOutMessage}>{t('profile.signOutConfirm')}</Text>
            <TouchableOpacity
              style={styles.signOutConfirmButton}
              onPress={() => { setShowSignOutModal(false); signOut(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.signOutConfirmText}>{t('profile.signOut')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowSignOutModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirm Modal */}
      <Modal visible={showDeleteAccountModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={34} color={C.red600} />
            </View>
            <Text style={styles.modalTitle}>{t('profile.deleteAccount')}</Text>
            <Text style={styles.signOutMessage}>{t('profile.deleteAccountConfirm')}</Text>
            <TouchableOpacity
              style={[styles.deleteAccountConfirmButton, closingAccount && styles.modalButtonDisabled]}
              onPress={handleConfirmDeleteAccount}
              disabled={closingAccount}
              activeOpacity={0.85}
            >
              {closingAccount ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.deleteAccountConfirmText}>{t('profile.deleteAccountYes')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowDeleteAccountModal(false)}
              disabled={closingAccount}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{t('profile.deleteAccountNo')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account Result Modal */}
      <Modal visible={showDeleteAccountResultModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile.deleteAccount')}</Text>
            <Text style={styles.signOutMessage}>{deleteAccountMessage}</Text>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleDismissDeleteAccountResult}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.neutral200,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: C.neutral900,
  },

  content: {
    padding: 16,
    gap: 16,
  },

  // Profile info card
  card: {
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.neutral200,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoRow: {},
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: C.neutral500,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: C.neutral900,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: C.neutral100,
    marginVertical: 16,
  },

  // Settings card
  settingsCard: {
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.neutral200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingDivider: {
    height: 1,
    backgroundColor: C.neutral100,
    marginLeft: 20,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C.neutral900,
  },
  settingSubtitle: {
    fontSize: 12,
    color: C.neutral500,
    marginTop: 4,
  },
  settingWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Sign out
  signOutButton: {
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.neutral200,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    color: C.red600,
    fontSize: 14,
    fontWeight: '500',
  },
  deleteAccountButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 16,
    alignItems: 'center',
  },
  deleteAccountText: {
    color: C.red600,
    fontSize: 14,
    fontWeight: '600',
  },

  // Version
  versionWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 12,
    color: C.neutral400,
  },

  // UPI Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.neutral900,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: C.neutral200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.neutral900,
    backgroundColor: C.neutral100,
    marginBottom: 20,
  },
  supportInput: {
    minHeight: 110,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: C.neutral500,
    textAlign: 'right',
    marginBottom: 12,
  },
  modalInputError: {
    borderColor: C.red600,
    marginBottom: 6,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.neutral200,
    borderRadius: 10,
    backgroundColor: C.neutral100,
    marginBottom: 12,
    overflow: 'hidden',
  },
  passwordField: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.neutral900,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: C.red600,
    fontSize: 12,
    marginBottom: 14,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  successText: {
    fontSize: 14,
    color: '#15803d',
    flex: 1,
  },
  modalSaveButton: {
    backgroundColor: C.neutral900,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalCancelButton: {
    backgroundColor: C.neutral100,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: C.neutral900,
    fontSize: 15,
    fontWeight: '600',
  },

  // Language Modal
  langModalCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.neutral100,
  },
  langRowActive: {
    backgroundColor: C.neutral100,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginHorizontal: -8,
  },
  langNative: {
    fontSize: 16,
    fontWeight: '500',
    color: C.neutral900,
  },
  langTextActive: {
    fontWeight: '700',
  },
  langLabel: {
    fontSize: 12,
    color: C.neutral500,
    marginTop: 2,
  },

  // Sign Out Modal
  signOutIconWrap: {
    marginBottom: 12,
    alignSelf: 'center',
  },
  deleteIconWrap: {
    marginBottom: 12,
    alignSelf: 'center',
  },
  signOutMessage: {
    fontSize: 14,
    color: C.neutral500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  signOutConfirmButton: {
    backgroundColor: C.red600,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  signOutConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteAccountConfirmButton: {
    backgroundColor: C.red600,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteAccountConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

