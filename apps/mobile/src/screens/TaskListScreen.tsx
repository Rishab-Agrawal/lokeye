import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store/tasks';
import { useToast } from '../hooks/useToast';
import { colors as C } from '../theme';
import { NearbyTask } from '@lokeye/shared';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const typeConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; text: string }> = {
  photo: { icon: 'camera-outline', bg: C.blue50, text: C.blue700 },
  video: { icon: 'videocam-outline', bg: C.purple50, text: C.purple700 },
};

function TaskCard({ item, onPress, onAccept, disabled, t }: { item: NearbyTask; onPress: () => void; onAccept: () => void; disabled: boolean; t: any }) {
  const config = typeConfig[item.type] ?? typeConfig.photo;
  const distanceText = item.distance_meters < 1000
    ? `${Math.round(item.distance_meters)}m`
    : `${(item.distance_meters / 1000).toFixed(1)}km`;

  const typeLabel = item.type === 'photo' ? t('taskList.photo') : t('taskList.video');

  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      activeOpacity={disabled ? 0.7 : 0.7}
    >
      {/* Top row: Title + type pill */}
      <View style={styles.cardTop}>
        <View style={styles.cardTitleArea}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.distanceRow}>
            <Ionicons name="location-outline" size={13} color={C.neutral500} />
            <Text style={styles.distanceText}>{distanceText}</Text>
          </View>
        </View>
        <View style={[styles.typePill, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={14} color={config.text} />
          <Text style={[styles.typeLabel, { color: config.text }]}>{typeLabel}</Text>
        </View>
      </View>

      {/* Bottom row: Payout + Accept */}
      <View style={styles.cardBottom}>
        <Text style={styles.payout}>{'\u20B9'}{(item.bounty_rupees).toFixed(0)}</Text>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={onAccept}
          activeOpacity={disabled ? 1 : 0.8}
          disabled={disabled}
        >
          <Text style={styles.acceptText}>{t('taskList.accept')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function TaskListScreen({ location }: { location?: { latitude: number; longitude: number } | null }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { nearbyTasks, activeTask, isLoading, error, fetchNearbyTasks, fetchActiveTask, acceptTask, abandonTask } = useTaskStore();
  const [initialLoad, setInitialLoad] = useState(true);
  const { toastMsg, showToast } = useToast();

  const hasActive = !!activeTask && (activeTask.status === 'assigned' || activeTask.status === 'in_progress');

  useEffect(() => { fetchActiveTask(); }, []);

  useEffect(() => {
    if (location) {
      fetchNearbyTasks(location.latitude, location.longitude).then(() => setInitialLoad(false));
    }
  }, [location]);

  const onRefresh = useCallback(() => {
    fetchActiveTask();
    if (location) fetchNearbyTasks(location.latitude, location.longitude);
  }, [location]);

  const handleActiveTaskPress = () => {
    if (!activeTask) return;
    if (activeTask.status === 'in_progress' || activeTask.status === 'assigned') {
      navigation.navigate('TaskDetail', {
        taskId: activeTask.id,
        task: activeTask,
        accepted: true,
      });
    }
  };

  const handleCancelTask = async () => {
    if (!activeTask) return;
    try {
      await abandonTask(activeTask.id);
      if (location) fetchNearbyTasks(location.latitude, location.longitude);
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleAcceptOnly = async (item: NearbyTask) => {
    if (hasActive) return;
    try {
      await acceptTask(item.id);
      navigation.navigate('TaskDetail', { taskId: item.id, task: item, accepted: true });
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleCardPress = (item: NearbyTask) => {
    if (hasActive) {
      showToast(t('taskList.completeActiveFirst'));
      return;
    }
    navigation.navigate('TaskDetail', { taskId: item.id, task: item });
  };

  const renderTask = ({ item }: { item: NearbyTask }) => (
    <TaskCard
      item={item}
      t={t}
      disabled={hasActive}
      onPress={() => handleCardPress(item)}
      onAccept={() => handleAcceptOnly(item)}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('taskList.header')}</Text>
      </View>

      {/* Active task banner */}
      {activeTask && (activeTask.status === 'assigned' || activeTask.status === 'in_progress') && (
        <TouchableOpacity style={styles.activeBanner} onPress={handleActiveTaskPress} activeOpacity={0.7}>
          <View style={styles.bannerTop}>
            <View style={styles.bannerStatusRow}>
              <View style={styles.bannerDot} />
              <Text style={styles.bannerLabel}>{t('taskList.activeTask')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.neutral400} />
          </View>
          <Text style={styles.bannerTitle} numberOfLines={2}>{activeTask.title}</Text>
          <View style={styles.bannerBottom}>
            <Text style={styles.bannerPayout}>{'\u20B9'}{(activeTask.bounty_rupees).toFixed(0)}</Text>
            <View style={styles.bannerActions}>
              <TouchableOpacity style={styles.bannerContinueBtn} onPress={handleActiveTaskPress} activeOpacity={0.8}>
                <Text style={styles.bannerContinueText}>{t('taskList.continue')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancelTask} activeOpacity={0.7}>
                <Text style={styles.bannerCancelText}>{t('taskList.cancelTask')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Task list */}
      <FlatList
        data={nearbyTasks}
        renderItem={renderTask}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={C.neutral400} />}
        ListEmptyComponent={
          !initialLoad ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={32} color={C.neutral400} />
              <Text style={styles.emptyText}>{t('taskList.noTasks')}</Text>
              <Text style={styles.emptySubtext}>{t('taskList.noTasksHint')}</Text>
            </View>
          ) : null
        }
      />

      {/* Toast */}
      {toastMsg && (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
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

  // List
  list: {
    padding: 16,
    gap: 12,
  },

  // Task card
  card: {
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.neutral200,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  cardTitleArea: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C.neutral900,
    lineHeight: 20,
    marginBottom: 6,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    color: C.neutral500,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  payout: {
    fontSize: 24,
    fontWeight: '600',
    color: C.neutral900,
  },
  acceptButton: {
    backgroundColor: C.neutral900,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Active task banner
  activeBanner: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: C.neutral200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bannerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green500,
    marginRight: 8,
  },
  bannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.green500,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C.neutral900,
    lineHeight: 20,
    marginBottom: 12,
  },
  bannerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerPayout: {
    fontSize: 20,
    fontWeight: '600',
    color: C.neutral900,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerContinueBtn: {
    backgroundColor: C.neutral900,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bannerContinueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  bannerCancelText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.neutral400,
  },

  // Disabled card
  cardDisabled: {
    opacity: 0.7,
  },

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

  // Empty state
  emptyContainer: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, color: C.neutral900, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: C.neutral500, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});

