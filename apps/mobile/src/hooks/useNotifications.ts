import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { updatePushToken } from '../services/api';
import { useTaskStore } from '../store/tasks';
import { navigationRef } from '../navigation/navigationRef';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;

    // Suppress new_task alerts when the app is foregrounded —
    // the realtime channel + the received-listener below handle the refresh.
    if (data?.type === 'new_task') {
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

// Flag indicating wallet data may be stale (set when a wallet-related notification arrives).
// WalletScreen checks and clears this on focus/resume.
let _walletDirty = false;

export function isWalletDirty(): boolean { return _walletDirty; }
export function clearWalletDirty(): void { _walletDirty = false; }
function markWalletDirty(): void { _walletDirty = true; }

export function useNotifications(location?: { latitude: number; longitude: number } | null) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) {
        setExpoPushToken(token);
        updatePushToken(token).catch(console.error);
      }
    });

    // When a notification arrives in the foreground, refresh data immediately
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      const { fetchNearbyTasks, fetchActiveTask } = useTaskStore.getState();

      if (data?.type === 'new_task' || data?.type === 'task_rejected') {
        // New task available or a previously submitted task was rejected and returned to pool —
        // either way, refresh the nearby tasks list
        const loc = locationRef.current;
        if (loc) fetchNearbyTasks(loc.latitude, loc.longitude);
      }

      if (data?.type === 'task_completed' || data?.type === 'withdrawal_update' || data?.type === 'task_rejected') {
        markWalletDirty();
      }
    });

    // When the user taps a notification, navigate accordingly
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      if (navigationRef.isReady()) {
        switch (data.type) {
          case 'new_task':
          case 'task_rejected':
            navigationRef.navigate('Main');
            break;
          case 'task_completed':
          case 'withdrawal_update':
            navigationRef.navigate('Main');
            markWalletDirty();
            break;
        }
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken };
}

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22d3ee',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  return tokenData.data;
}
