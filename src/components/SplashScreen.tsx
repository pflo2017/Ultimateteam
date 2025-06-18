import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, Animated, Image } from 'react-native';
import { COLORS } from '../constants/theme';
import { FootballBall } from './FootballBall';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onAnimationFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start the fade and scale animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // Start the rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Set a timer for the minimum display time
    const timer = setTimeout(() => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onAnimationFinish?.();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, rotateAnim, onAnimationFinish]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <Image 
          source={require('../../assets/Soccer_ball 1.png')} 
          style={{ width: width * 0.4, height: height * 0.2 }}
          resizeMode="contain"
        />
        <Text style={styles.title}>Ultimate Team</Text>
        <Text style={styles.subtitle}>Welcome to the future of team management</Text>
        <Animated.View 
          style={[
            styles.ballContainer,
            {
              transform: [{ rotate: spin }]
            }
          ]}
        >
          <FootballBall size={40} />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primary,
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '500',
    marginBottom: 20,
  },
  ballContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 