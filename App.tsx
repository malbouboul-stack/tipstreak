import './polyfills';

import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import BottomTabs, { TabParamList } from './src/navigation/BottomTabs';
import { linking } from './src/navigation/linking';
import CreatorProfileScreen from './src/screens/CreatorProfileScreen';
import TipScreen from './src/screens/TipScreen';
import { WalletProvider } from './src/context/WalletContext';
import { DataProvider } from './src/context/DataContext';
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

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.purple} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <WalletProvider>
          <DataProvider>
            <NavigationContainer linking={linking}>
              <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
                <Stack.Screen name="Tabs" component={BottomTabs} />
                <Stack.Screen name="CreatorProfile" component={CreatorProfileScreen} />
                <Stack.Screen name="Tip" component={TipScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </DataProvider>
        </WalletProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
