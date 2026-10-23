import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getAccessToken } from '../services/authToken';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error.message);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const latest = locations[locations.length - 1];
  const token = await getAccessToken();
  if (!token) return;

  try {
    await fetch(`${API_URL}/api/v1/human/location`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
      }),
    });
  } catch (err) {
    console.error('Background location update failed:', err);
  }
});
