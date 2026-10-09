import './polyfills';

import 'react-native-gesture-handler';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, NavigationContainer, NavigatorScreenParams, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';

import BottomTabs, { TabParamList } from './src/navigation/BottomTabs';
import { linking } from './src/navigation/linking';
import CreatorProfileScreen from './src/screens/CreatorProfileScreen';
import TipScreen from './src/screens/TipScreen';
import { WalletProvider } from './src/context/WalletContext';
import { DataProvider, useData } from './src/context/DataContext';
import LaunchScreen from './src/components/LaunchScreen';
import { DialogProvider } from './src/components/Dialog';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { colors } from './src/theme';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  // creatorId depuis l'app, handle depuis un lien profond tipstreak://<handle>
  CreatorProfile: { creatorId: string; handle?: never } | { handle: string; creatorId?: never };
  Tip: { creatorId: string };
};

// Type globalement useNavigation() : navigate('CreatorProfile', { creatorId }) est vérifié partout
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const Stack = createNativeStackNavigator<RootStackParamList>();

// Thème sombre de navigation : évite tout flash blanc entre deux écrans
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.cyan, border: colors.borderSoft },
};

// L'app + son écran de lancement. Les données commencent à charger tout de suite (DataProvider),
// mais la navigation n'est montée qu'une fois l'animation de lancement jouée : monter l'app
// pendant l'animation la rendrait saccadée, voire invisible (surtout en développement).
function AppShell() {
  const { loading } = useData();
  const [introPlayed, setIntroPlayed] = useState(false);
  const [launchVisible, setLaunchVisible] = useState(true);
  const mountApp = useCallback(() => setIntroPlayed(true), []);
  const hideLaunch = useCallback(() => setLaunchVisible(false), []);

  return (
    <>
      {introPlayed && (
        <NavigationContainer linking={linking} theme={navigationTheme}>
          <Stack.Navigator
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}
          >
            <Stack.Screen name="Tabs" component={BottomTabs} />
            <Stack.Screen name="CreatorProfile" component={CreatorProfileScreen} />
            <Stack.Screen name="Tip" component={TipScreen} options={{ animation: 'slide_from_bottom' }} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
      {launchVisible && <LaunchScreen ready={introPlayed && !loading} onIntroPlayed={mountApp} onDone={hideLaunch} />}
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  // Quelques millisecondes : même fond que l'écran de lancement, pour un enchaînement sans saut
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      {/* Icônes de la barre d'état en clair, sur le fond sombre de l'app */}
      <StatusBar style="light" />
      <LanguageProvider>
        <WalletProvider>
          <DataProvider>
            <DialogProvider>
              <AppShell />
            </DialogProvider>
          </DataProvider>
        </WalletProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
