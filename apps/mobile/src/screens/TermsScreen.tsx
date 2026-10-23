import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors as C } from '../theme';

const PRIVACY_POLICY_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/human/privacy`;

export default function TermsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.neutral900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('terms.header')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('terms.intro')}</Text>

        {/* 1. Safety */}
        <Text style={styles.sectionTitle}>1. {t('terms.safety')}</Text>
        <Text style={styles.bullet}>{t('terms.safetyDontAccept')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.safetyDangerous')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.safetyRestricted')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.safetyConflict')}</Text>
        <Text style={[styles.bullet, { marginTop: 12 }]}>{t('terms.safetyDontPerform')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.safetyDriving')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.safetyMachinery')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.safetyAttention')}</Text>
        <Text style={[styles.bullet, { marginTop: 12 }]}>{t('terms.safetyResponsible')}</Text>

        <View style={styles.divider} />

        {/* 2. Task Assignment & Review */}
        <Text style={styles.sectionTitle}>2. {t('terms.taskAssignment')}</Text>
        <Text style={styles.bullet}>{t('terms.taskAssignmentAI')}</Text>

        <View style={styles.divider} />

        {/* 3. Payments */}
        <Text style={styles.sectionTitle}>3. {t('terms.payments')}</Text>
        <Text style={styles.bullet}>{t('terms.paymentsManual')}</Text>
        <Text style={styles.bullet}>{t('terms.paymentsUpi')}</Text>
        <Text style={styles.bullet}>{t('terms.paymentsResponsible')}</Text>
        <Text style={styles.bullet}>{t('terms.paymentsFailed')}</Text>

        <View style={styles.divider} />

        {/* 4. Data & Permissions */}
        <Text style={styles.sectionTitle}>4. {t('terms.dataPermissions')}</Text>
        <Text style={styles.bullet}>
          {t('terms.dataSummary')}{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            {t('terms.dataPolicyLink')}
          </Text>
          .
        </Text>

        <View style={styles.divider} />

        {/* 5. Liability */}
        <Text style={styles.sectionTitle}>5. {t('terms.liability')}</Text>
        <Text style={styles.bullet}>{t('terms.liabilityAge')}</Text>
        <Text style={styles.bullet}>{t('terms.liabilityIndependent')}</Text>
        <Text style={styles.bullet}>{t('terms.liabilityNotResponsible')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.liabilityAccidents')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.liabilityInjuries')}</Text>
        <Text style={styles.subBullet}>{'\u2022'} {t('terms.liabilityLoss')}</Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.neutral200,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 32 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.neutral900,
  },
  content: {
    padding: 20,
  },
  intro: {
    fontSize: 14,
    color: C.neutral500,
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.neutral900,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    color: C.neutral900,
    lineHeight: 22,
    marginBottom: 4,
  },
  subBullet: {
    fontSize: 14,
    color: C.neutral500,
    lineHeight: 22,
    paddingLeft: 16,
    marginBottom: 2,
  },
  link: {
    color: '#4f46e5',
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: C.neutral200,
    marginVertical: 20,
  },
});
