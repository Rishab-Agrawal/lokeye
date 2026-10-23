import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { updateLocation } from '../services/api';
import { BACKGROUND_LOCATION_TASK } from '../tasks/backgroundLocation';

// Module-level cache so remounts get the last known location instantly
let cachedLocation: { latitude: number; longitude: number } | null = null;
// Track whether user has already seen the background location disclosure this session
let bgDisclosureShown = false;

async function tryStartBackgroundLocation(): Promise<void> {
  // Android 12+ blocks foreground service starts when app is in background
  if (AppState.currentState !== 'active') return;
  const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) return;
  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: 'Lokeye',
        notificationBody: 'Tracking your location for nearby tasks',
        notificationColor: '#4f46e5',
      },
    });
  } catch (err) {
    console.warn('Background location start deferred:', err);
  }
}

export function useLocation() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(cachedLocation);
  const [error, setError] = useState<string | null>(null);
  const [showBgDisclosure, setShowBgDisclosure] = useState(false);
  const fallbackInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgConsentResolver = useRef<((consented: boolean) => void) | null>(null);

  const handleBgConsentResponse = useCallback((consented: boolean) => {
    setShowBgDisclosure(false);
    bgConsentResolver.current?.(consented);
    bgConsentResolver.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;

    function startForegroundPolling() {
      console.warn('Background location not available, using foreground polling');
      fallbackInterval.current = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          cachedLocation = coords;
          if (mounted) setLocation(coords);
          updateLocation(coords).catch(console.error);
        } catch (err) {
          if (mounted) setError((err as Error).message);
        }
      }, 60000);
    }

    async function startTracking() {
      // Request foreground permission first
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setError('Location permission denied');
        return;
      }

      // Use last known position for instant UI, then refine with a fresh fix
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && !cachedLocation) {
          const coords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
          cachedLocation = coords;
          if (mounted) setLocation(coords);
        }
      } catch {
        // Ignore — will fall through to fresh fix
      }

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        cachedLocation = coords;
        if (mounted) setLocation(coords);
        updateLocation(coords).catch(console.error);
      } catch (err) {
        if (mounted) setError((err as Error).message);
      }

      // Check if background permission is already granted (e.g. from a previous session)
      const { status: existingBgStatus } = await Location.getBackgroundPermissionsAsync();
      if (existingBgStatus === 'granted') {
        await tryStartBackgroundLocation();
      } else if (!bgDisclosureShown) {
        // Show prominent disclosure before requesting background location
        bgDisclosureShown = true;
        const userConsented = await new Promise<boolean>((resolve) => {
          bgConsentResolver.current = resolve;
          setShowBgDisclosure(true);
        });
        if (userConsented) {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (bgStatus === 'granted') {
            await tryStartBackgroundLocation();
          } else {
            startForegroundPolling();
          }
        } else {
          startForegroundPolling();
        }
      } else {
        startForegroundPolling();
      }
    }

    startTracking();

    return () => {
      mounted = false;
      if (fallbackInterval.current) clearInterval(fallbackInterval.current);
    };
  }, []);

  // Refresh foreground location when app returns to active
  useEffect(() => {
    const handleAppState = async (state: AppStateStatus) => {
      if (state === 'active') {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          cachedLocation = coords;
          setLocation(coords);
        } catch {
          // Ignore - background task handles server updates
        }
        // Retry starting background location if it failed earlier
        tryStartBackgroundLocation().catch(() => {});
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  return { location, error, showBgDisclosure, handleBgConsentResponse };
}

/** Stop background location updates. Call before signing out. */
export async function stopBackgroundLocation(): Promise<void> {
  try {
    const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Ignore - task may not be registered
  }
}
