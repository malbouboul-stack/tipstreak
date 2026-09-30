import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { SearchIcon, HeartIcon, ClockIcon, UserIcon } from '../components/Icons';
import DiscoverScreen from '../screens/DiscoverScreen';
import SupportScreen from '../screens/SupportScreen';
import HistoryScreen from '../screens/HistoryScreen';
import CreatorSetupScreen from '../screens/CreatorSetupScreen';
import { useLanguage } from '../i18n/LanguageContext';

export type TabParamList = {
  Discover: undefined;
  Support: undefined;
  History: undefined;
  CreatorSetup: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function BottomTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(21,15,34,0.96)',
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 10 },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          title: t('tabs.discover'),
          tabBarIcon: ({ focused }) => <SearchIcon size={19} color={focused ? colors.green : colors.textFaint} />,
        }}
      />
      <Tab.Screen
        name="Support"
        component={SupportScreen}
        options={{
          title: t('tabs.support'),
          tabBarIcon: ({ focused }) => <HeartIcon size={19} color={focused ? colors.green : colors.textFaint} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ focused }) => <ClockIcon size={19} color={focused ? colors.green : colors.textFaint} />,
        }}
      />
      <Tab.Screen
        name="CreatorSetup"
        component={CreatorSetupScreen}
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <UserIcon size={19} color={focused ? colors.green : colors.textFaint} />,
        }}
      />
    </Tab.Navigator>
  );
}
