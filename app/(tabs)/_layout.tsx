import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { useT } from '../../constants/i18n';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4, width: 64 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontSize: 10,
          fontFamily: focused ? typography.fonts.bodyMed : typography.fonts.body,
          color: focused ? colors.accent.primary : colors.text.tertiary,
          marginTop: 3,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 70,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 6,
        },
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label={t('tabs.home')} focused={focused} /> }} />
      <Tabs.Screen name="nutrition" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🥗" label={t('tabs.nutrition')} focused={focused} /> }} />
      <Tabs.Screen name="workout" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💪" label={t('tabs.workout')} focused={focused} /> }} />
      <Tabs.Screen name="recovery" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="😴" label={t('tabs.recovery')} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label={t('tabs.profile')} focused={focused} /> }} />
    </Tabs>
  );
}
