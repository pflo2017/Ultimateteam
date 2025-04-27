import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, useTheme } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ParentTeamCode'>;
type RouteProps = RouteProp<RootStackParamList, 'ParentTeamCode'>;

export const ParentTeamCodeScreen = () => {
  const [teamCode, setTeamCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { phoneNumber } = route.params;
  const theme = useTheme();

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContinue = async () => {
    try {
      setLoading(true);
      setError('');
      
      const cleanTeamCode = teamCode.trim().toUpperCase();
      console.log('Attempting to verify team code:', cleanTeamCode);
      
      // First, let's check if we can access the teams table at all
      const { data: teamsCheck, error: checkError } = await supabase
        .from('teams')
        .select('count')
        .limit(1);
      
      console.log('Teams access check:', { teamsCheck, checkError });

      // Now try the specific team code query
      const { data: teams, error } = await supabase
        .from('teams')
        .select('id, name, access_code, is_active')
        .eq('access_code', cleanTeamCode)
        .limit(1);

      console.log('Full query response:', {
        teams,
        error,
        searchedCode: cleanTeamCode
      });

      if (error) {
        console.error('Supabase error:', error.message);
        throw error;
      }

      if (!Array.isArray(teams)) {
        console.error('Unexpected response format:', teams);
        setError('Unexpected server response');
        return;
      }

      if (teams.length === 0) {
        console.log('No team found with code:', cleanTeamCode);
        setError('Invalid team access code');
        return;
      }

      console.log('Team found:', teams[0]);
      const team = teams[0];
      
      if (!team.id) {
        console.error('Team missing ID:', team);
        setError('Invalid team data');
        return;
      }

      navigation.navigate('ParentRegistration', { 
        teamId: team.id,
        teamCode: cleanTeamCode,
        phoneNumber: phoneNumber
      });

    } catch (error) {
      console.error('Error verifying team code:', error);
      setError('Failed to verify team code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      <View style={styles.header}>
        <Icon 
          name="chevron-left" 
          size={32} 
          color="#0CC1EC"
          onPress={handleBack}
          style={styles.backButton}
        />
      </View>

      <View style={styles.iconContainer}>
        <Icon name="account-child" size={64} color="#0CC1EC" />
      </View>

      <Text variant="headlineLarge" style={styles.title}>Team Access Code</Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Please enter the team access code provided by your coach
      </Text>
      
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Icon name="key" size={24} color="#0CC1EC" style={styles.inputIcon} />
          <TextInput
            mode="outlined"
            placeholder="Access Code"
            value={teamCode}
            onChangeText={(text) => {
              setTeamCode(text);
              setError('');
            }}
            autoCapitalize="characters"
            style={[styles.input, error ? styles.inputError : null]}
            outlineStyle={styles.inputOutline}
            outlineColor={error ? '#FF0000' : '#E0E0E0'}
            activeOutlineColor="#0CC1EC"
            error={!!error}
            disabled={loading}
          />
        </View>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </View>

      <Button
        mode="contained"
        onPress={handleContinue}
        loading={loading}
        disabled={!teamCode.trim() || loading}
        style={styles.button}
        contentStyle={styles.buttonContent}
        buttonColor="#0CC1EC"
      >
        Continue
      </Button>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#000',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
    fontSize: 16,
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    height: 56,
    paddingLeft: 56, // Make room for the icon
  },
  inputOutline: {
    borderRadius: 30,
  },
  inputError: {
    marginBottom: 4,
  },
  errorText: {
    color: '#FF0000',
    marginTop: 8,
    marginLeft: 4,
  },
  button: {
    marginTop: 24,
    borderRadius: 30,
  },
  buttonContent: {
    height: 56,
  },
}); 