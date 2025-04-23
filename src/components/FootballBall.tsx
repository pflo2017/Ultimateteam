import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { COLORS } from '../constants/theme';

interface FootballBallProps {
  size?: number;
}

export const FootballBall: React.FC<FootballBallProps> = ({ size = 30 }) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image 
        source={require('../../assets/Soccer_ball 1.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
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