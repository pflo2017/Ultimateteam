import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

interface LoadingSpinnerProps {
  size?: number;
  style?: ViewStyle;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 100, style }) => {
  return (
    <View style={[styles.container, style]}>
      <LottieView
        source={require('../assets/animations/splash.json')}
        autoPlay
        loop
        style={{ width: size, height: size }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 