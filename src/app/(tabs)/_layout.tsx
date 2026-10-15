import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { ChatProvider, useChat } from '@/providers/ChatProvider';
import { ShoppingProvider } from '@/providers/ShoppingProvider';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <ShoppingProvider>
      <ChatProvider>
        <AppTabs />
      </ChatProvider>
    </ShoppingProvider>
  );
}

function AppTabs() {
  const { unreadCount } = useChat();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} badges={{ chat: unreadCount > 0 }} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ground } }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses' }} />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarAccessibilityLabel: unreadCount > 0 ? `Chat, ${unreadCount} non lu${unreadCount > 1 ? 's' : ''}` : 'Chat',
        }}
      />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="documents" options={{ title: 'Documents' }} />
    </Tabs>
  );
}
