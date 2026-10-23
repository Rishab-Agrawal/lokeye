import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store/tasks';
import { useToast } from '../hooks/useToast';
import { colors as C } from '../theme';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const typeConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; text: string }> = {
  photo: { icon: 'camera-outline', bg: C.blue50, text: C.blue700 },
  video: { icon: 'videocam-outline', bg: C.purple50, text: C.purple700 },
};

export default function TaskDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>();
  const insets = useSafeAreaInsets();
  const { task, accepted } = route.params;
  const { acceptAndStartTask, startTask } = useTaskStore();
  const [loading, setLoading] = useState(false);
  const { toastMsg, showToast } = useToast();
  const isAccepted = !!accepted;

  const handleAcceptAndStart = async () => {
    setLoading(true);
    try {
      await acceptAndStartTask(task.id);
      navigation.replace('Capture', { taskId: task.id, taskType: task.type, taskTitle: task.title });
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    // If already in_progress (e.g. kept from camera), skip the API call
    if (task.status === 'in_progress') {
      navigation.replace('Capture', { taskId: task.id, taskType: task.type, taskTitle: task.title });
      return;
    }
    setLoading(true);
    try {
      await startTask(task.id);
      navigation.replace('Capture', { taskId: task.id, taskType: task.type, taskTitle: task.title });
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const deadline = new Date(task.deadline);
  const config = typeConfig[task.type] ?? typeConfig.photo;
  const distanceText = task.distance_meters != null
    ? (task.distance_meters < 1000
      ? `${Math.round(task.distance_meters)}m`
      : `${(task.distance_meters / 1000).toFixed(1)}km`)
    : null;

  const getRelativeDeadline = (): string => {
    const diff = deadline.getTime() - Date.now();
    if (diff <= 0) return t('taskDetail.expired');
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('taskDetail.mLeft', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('taskDetail.hLeft', { count: hrs });
    return t('taskDetail.dLeft', { count: Math.floor(hrs / 24) });
  };

  const typeLabel = task.type === 'photo' ? t('taskList.photo') : t('taskList.video');

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Type pill + Title */}
        <View style={styles.heroSection}>
          <View style={[styles.typePill, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={14} color={config.text} />
            <Text style={[styles.typeLabel, { color: config.text }]}>{typeLabel}</Text>
          </View>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.bounty}>{'\u20B9'}{(task.bounty_rupees).toFixed(0)}</Text>
        </View>

        {/* Info row */}
        <View style={styles.infoCard}>
          {distanceText != null && (
            <>
              <View style={styles.infoPill}>
                <Ionicons name="location-outline" size={16} color={C.neutral500} />
                <Text style={styles.infoValue}>{distanceText}</Text>
                <Text style={styles.infoLabel}>{t('taskDetail.away')}</Text>
              </View>
              <View style={styles.infoDivider} />
            </>
          )}
          <View style={styles.infoPill}>
            <Ionicons name="time-outline" size={16} color={C.neutral500} />
            <Text style={styles.infoValue}>{getRelativeDeadline()}</Text>
            <Text style={styles.infoLabel}>{t('taskDetail.deadline')}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('taskDetail.description')}</Text>
          <Text style={styles.sectionText}>{task.description}</Text>
        </View>

        {/* Instructions */}
        {task.instructions ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('taskDetail.instructions')}</Text>
            <Text style={styles.sectionText}>{task.instructions}</Text>
          </View>
        ) : null}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <TouchableOpacity
          style={[styles.ctaButton, loading && styles.ctaDisabled]}
          onPress={isAccepted ? handleStart : handleAcceptAndStart}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.ctaText}>{isAccepted ? t('taskDetail.start') : t('taskDetail.acceptStart')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Toast */}
      {toastMsg && (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + 70 }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 20 },

  // Hero
  heroSection: { marginBottom: 20 },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  typeLabel: { fontSize: 12, fontWeight: '500' },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: C.neutral900,
    lineHeight: 28,
    marginBottom: 12,
  },
  bounty: {
    fontSize: 32,
    fontWeight: '700',
    color: C.neutral900,
  },

  // Info row
  infoCard: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.neutral200,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  infoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  infoDivider: { width: 1, height: 24, backgroundColor: C.neutral200 },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.neutral900 },
  infoLabel: { fontSize: 13, color: C.neutral400 },

  // Sections
  sectionCard: {
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.neutral200,
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: C.neutral500,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionText: { fontSize: 14, color: C.neutral500, lineHeight: 22 },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.neutral200,
    backgroundColor: C.white,
  },
  ctaButton: {
    backgroundColor: C.neutral900,
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Toast
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: C.neutral900,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
