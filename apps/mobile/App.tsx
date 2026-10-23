import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/i18n';
import { loadSavedLanguage } from './src/i18n';
import Navigation from './src/navigation';

export default function App() {
  useEffect(() => { loadSavedLanguage(); }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Navigation />
    </SafeAreaProvider>
  );
}
