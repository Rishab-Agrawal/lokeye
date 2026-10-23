import { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  ActivityIndicator, AppState, AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getEarnings, requestWithdrawal } from '../services/api';
import { WithdrawalRequest } from '@lokeye/shared';
import { useToast } from '../hooks/useToast';
import * as Notifications from 'expo-notifications';
import { isWalletDirty, clearWalletDirty } from '../hooks/useNotifications';
import { colors as C } from '../theme';

interface TaskHistoryItem {
  id: string;
  title: string;
  bounty_rupees: number;
  outcome: 'submitted' | 'completed' | 'rejected';
  updated_at: string;
}

type DisplayStatus = 'completed' | 'pending' | 'rejected';

function getDisplayStatus(item: TaskHistoryItem): DisplayStatus {
  if (item.outcome === 'completed') return 'completed';
  if (item.outcome === 'rejected') return 'rejected';
  return 'pending'; // submitted = waiting for agent review
}

interface EarningsData {
  wallet_rupees: number;
  lifetime_earned: number;
  tasks_completed: number;
  task_history: TaskHistoryItem[];
  pending_withdrawal: WithdrawalRequest | null;
}

export default function WalletScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const { toastMsg, showToast } = useToast();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const fetchEarnings = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const earnings = await getEarnings() as unknown as EarningsData;
      setData(earnings);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { fetchEarnings(); }, []);

  // Refresh when tab is focused (covers tab switches + initial dirty check)
  useEffect(() => {
    if (isFocused) {
      if (isWalletDirty()) clearWalletDirty();
      fetchEarnings({ silent: true });
    }
  }, [isFocused]);

  // Refresh immediately when a wallet notification arrives in foreground
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const type = notification.request.content.data?.type;
      if (type === 'task_completed' || type === 'withdrawal_update' || type === 'task_rejected') {
        clearWalletDirty();
        fetchEarnings({ silent: true });
      }
    });
    return () => subscription.remove();
  }, []);

  // Refresh when app resumes from background (covers background notifications)
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active' && isFocused) {
        if (isWalletDirty()) clearWalletDirty();
        fetchEarnings({ silent: true });
      }
      appState.current = nextState;
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [isFocused]);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await requestWithdrawal();
      await fetchEarnings();
      showToast(t('wallet.withdrawalProcessing'));
    } catch (err) {
      showToast((err as Error).message || t('common.error'));
    } finally {
      setWithdrawing(false);
    }
  };

  const availableBalance = data ? data.wallet_rupees : null;
  const lifetimeEarnings = data ? data.lifetime_earned : null;
  const hasPendingWithdrawal = !!data?.pending_withdrawal;
  const withdrawDisabled = withdrawing || hasPendingWithdrawal || (data?.wallet_rupees ?? 0) <= 0;

  const renderTransaction = ({ item }: { item: TaskHistoryItem }) => {
    const amount = item.bounty_rupees;
    const dateStr = item.updated_at;
    const date = new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const displayStatus = getDisplayStatus(item);

    return (
      <View style={styles.txRow}>
        <View style={styles.txInfo}>
          <Text style={styles.txTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.txDate}>{date}</Text>
        </View>
        <View style={styles.txRight}>
          {displayStatus === 'completed' && (
            <>
              <Text style={styles.txAmountCompleted}>+{'\u20B9'}{amount.toFixed(0)}</Text>
              <Text style={styles.txStatusCompleted}>{t('wallet.completed')}</Text>
            </>
          )}
          {displayStatus === 'pending' && (
            <>
              <Text style={styles.txAmountPending}>{'\u20B9'}{amount.toFixed(0)}</Text>
              <Text style={styles.txStatusPending}>{t('wallet.pending')}</Text>
            </>
          )}
          {displayStatus === 'rejected' && (
            <>
              <Text style={styles.txAmountRejected}>{'\u20B9'}{amount.toFixed(0)}</Text>
              <Text style={styles.txStatusRejected}>{t('wallet.rejected')}</Text>
            </>
          )}
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <View style={styles.topSection}>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>{t('wallet.availableBalance')}</Text>
          <Text style={styles.balanceAmount}>{availableBalance !== null ? `${'\u20B9'}${availableBalance.toLocaleString()}` : ' '}</Text>
        </View>
        <TouchableOpacity
          style={[styles.withdrawButton, withdrawDisabled && styles.withdrawButtonDisabled]}
          activeOpacity={0.8}
          onPress={handleWithdraw}
          disabled={withdrawDisabled}
        >
          {withdrawing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={[styles.withdrawText, withdrawDisabled && styles.withdrawTextDisabled]}>
                {hasPendingWithdrawal ? t('wallet.withdrawalPending') : t('wallet.withdraw')}
              </Text>
              {!hasPendingWithdrawal && (
                <Ionicons name="arrow-up-outline" size={16} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Pending withdrawal banner */}
      {data?.pending_withdrawal && (
        <View style={styles.pendingBanner}>
          <Ionicons name="hourglass-outline" size={20} color={C.blue600} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingBannerTitle}>{t('wallet.withdrawalProcessing')}</Text>
            <Text style={styles.pendingBannerAmount}>
              {t('wallet.withdrawalAmount', { amount: `\u20B9${(data.pending_withdrawal.amount_rupees).toFixed(0)}` })}
            </Text>
          </View>
        </View>
      )}

      {/* Earnings summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{t('wallet.totalEarnings')}</Text>
        <Text style={styles.summaryAmount}>{lifetimeEarnings !== null ? `${'\u20B9'}${lifetimeEarnings.toLocaleString()}` : ' '}</Text>
      </View>

      {/* History header */}
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>{t('wallet.history')}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('wallet.header')}</Text>
      </View>

      <FlatList
        data={data?.task_history || []}
        renderItem={renderTransaction}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchEarnings} tintColor={C.neutral400} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={32} color={C.neutral400} />
              <Text style={styles.emptyText}>{t('wallet.noTransactions')}</Text>
            </View>
          ) : null
        }
      />

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
  topSection: {
    gap: 16,
  },

  // Balance card
  balanceCard: {
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.neutral200,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  balanceInfo: {
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: C.neutral500,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '600',
    color: C.neutral900,
  },
  withdrawButton: {
    backgroundColor: C.neutral900,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  withdrawButtonDisabled: {
    backgroundColor: C.neutral400,
    opacity: 0.6,
  },
  withdrawText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  withdrawTextDisabled: {
    color: '#FFFFFF',
  },

  // Pending withdrawal banner
  pendingBanner: {
    backgroundColor: C.blue50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingBannerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C.blue600,
  },
  pendingBannerAmount: {
    fontSize: 13,
    color: C.neutral500,
    marginTop: 2,
  },

  // Earnings summary
  summaryCard: {
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
  summaryLabel: {
    fontSize: 14,
    color: C.neutral500,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '600',
    color: C.neutral900,
  },

  // History
  historyCard: {
    backgroundColor: C.white,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.neutral200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.neutral200,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.neutral900,
  },

  // Transaction row
  txRow: {
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.neutral200,
    borderBottomColor: C.neutral100,
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C.neutral900,
  },
  txDate: {
    fontSize: 12,
    color: C.neutral500,
    marginTop: 4,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmountCompleted: {
    fontSize: 14,
    fontWeight: '600',
    color: C.neutral900,
  },
  txStatusCompleted: {
    fontSize: 12,
    color: C.green600,
    marginTop: 4,
  },
  txAmountPending: {
    fontSize: 14,
    fontWeight: '600',
    color: C.neutral500,
  },
  txStatusPending: {
    fontSize: 12,
    color: C.blue600,
    marginTop: 4,
  },
  txAmountRejected: {
    fontSize: 14,
    fontWeight: '600',
    color: C.neutral400,
    textDecorationLine: 'line-through',
  },
  txStatusRejected: {
    fontSize: 12,
    color: C.red600,
    marginTop: 4,
  },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyText: { textAlign: 'center', color: C.neutral400, fontSize: 14 },

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

