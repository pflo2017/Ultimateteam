import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { HomeScreen } from './src/screens/HomeScreen';
import { AdminLoginScreen } from './src/screens/AdminLoginScreen';
import { CoachLoginScreen } from './src/screens/CoachLoginScreen';
import { ParentLoginScreen } from './src/screens/ParentLoginScreen';
import { AdminRegisterScreen } from './src/screens/AdminRegisterScreen';
import { AdminDashboard } from './src/screens/AdminDashboard';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <PaperProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
            <Stack.Screen name="AdminRegister" component={AdminRegisterScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
            <Stack.Screen name="CoachLogin" component={CoachLoginScreen} />
            <Stack.Screen name="ParentLogin" component={ParentLoginScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </PaperProvider>
  );
}
