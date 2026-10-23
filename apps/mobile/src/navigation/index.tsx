import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskType } from '@lokeye/shared';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { useLocation } from '../hooks/useLocation';
import { useNotifications } from '../hooks/useNotifications';
import { colors as C } from '../theme';
import { navigationRef } from './navigationRef';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import TaskListScreen from '../screens/TaskListScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import CaptureScreen from '../screens/CaptureScreen';
import SubmitScreen from '../screens/SubmitScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TermsScreen from '../screens/TermsScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  Terms: undefined;
Main: undefined;
  TaskDetail: { taskId: string; task: any; accepted?: boolean };
  Capture: { taskId: string; taskType: TaskType; taskTitle?: string };
  Submit: { taskId: string; mediaUri?: string; mediaType?: 'photo' | 'video'; taskTitle?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { location, showBgDisclosure, handleBgConsentResponse } = useLocation();

  useNotifications(location);

  return (
    <>
    <Modal visible={showBgDisclosure} transparent animationType="fade">
      <View style={bgStyles.overlay}>
        <View style={bgStyles.card}>
          <View style={bgStyles.iconWrap}>
            <Ionicons name="location" size={36} color="#4f46e5" />
          </View>
          <Text style={bgStyles.title}>{t('bgLocation.title')}</Text>
          <Text style={bgStyles.message}>{t('bgLocation.message')}</Text>
          <TouchableOpacity
            style={bgStyles.allowBtn}
            onPress={() => handleBgConsentResponse(true)}
            activeOpacity={0.85}
          >
            <Text style={bgStyles.allowText}>{t('bgLocation.allow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={bgStyles.notNowBtn}
            onPress={() => handleBgConsentResponse(false)}
            activeOpacity={0.85}
          >
            <Text style={bgStyles.notNowText}>{t('bgLocation.notNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        tabBarActiveTintColor: C.neutral900,
        tabBarInactiveTintColor: C.neutral400,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.neutral200,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          elevation: 0,
        },
      }}
    >
      <Tab.Screen
        name="Tasks"
        children={() => <TaskListScreen location={location} />}
        options={{
          tabBarLabel: t('tabs.tasks'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarLabel: t('tabs.wallet'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
    </>
  );
}

const bgStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  iconWrap: {
    marginBottom: 12,
    alignSelf: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.neutral900,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: C.neutral500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  allowBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  allowText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  notNowBtn: {
    backgroundColor: C.neutral100,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  notNowText: {
    color: C.neutral900,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default function Navigation() {
  const { session, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.white }}>
        <ActivityIndicator size="large" color={C.neutral900} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: C.white },
          headerTintColor: C.neutral900,
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: 17, fontWeight: '600', color: C.neutral900 },
          contentStyle: { backgroundColor: C.white },
          animation: 'slide_from_right',
        }}
      >
        {!session ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="Capture" component={CaptureScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Submit" component={SubmitScreen} options={{ title: 'Review' }} />
            <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

