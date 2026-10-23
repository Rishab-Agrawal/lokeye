import { ExpoConfig, ConfigContext } from 'expo/config';
import path from 'path';

export default ({ config }: ConfigContext): ExpoConfig => {
  const buildProfile = process.env.EAS_BUILD_PROFILE || '';
  const isProductionBuild = buildProfile === 'production';
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const isEasBuild = process.env.EAS_BUILD === 'true';

  if (isEasBuild && !googleServicesFile) {
    throw new Error(
      'Missing GOOGLE_SERVICES_JSON file environment variable. Configure it in EAS as a File variable.'
    );
  }

  // During EAS builds, GOOGLE_SERVICES_JSON should be an injected absolute file path
  // from an EAS File environment variable, not a repo-relative path like ./google-services.json.
  if (isEasBuild && googleServicesFile && !path.isAbsolute(googleServicesFile)) {
    throw new Error(
      'GOOGLE_SERVICES_JSON must be configured as an EAS File variable (injected absolute path). Remove any plain-text/path value like ./google-services.json.'
    );
  }

  return ({
  name: 'Lokeye',
  slug: 'rtworld',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'lokeye',
  userInterfaceStyle: 'light',
  splash: {
    backgroundColor: '#FFFFFF',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#FFFFFF',
    },
    package: 'com.lokeye.app',
    versionCode: 1,
    usesCleartextTraffic: !isProductionBuild,
    permissions: [
      'CAMERA',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.MODIFY_AUDIO_SETTINGS',
    ],
    googleServicesFile,
  },
  plugins: [
    'expo-audio',
    'expo-camera',
    [
      'expo-location',
      {
        isAndroidBackgroundLocationEnabled: true,
        locationAlwaysAndWhenInUsePermission:
          'Allow Lokeye to access your location in the background so we can match you with nearby tasks.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#FFFFFF',
      },
    ],
    [
      'expo-av',
      {
        microphonePermission: 'Allow Lokeye to access your microphone for video recording.',
      },
    ],
    'expo-task-manager',
  ],
  extra: {
    eas: {
      projectId: 'c205821d-91f1-4923-aac2-561bd5c0c482',
    },
  },
  owner: 'rishabagrawal',
  } as ExpoConfig);
};


