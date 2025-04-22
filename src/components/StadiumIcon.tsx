import React from 'react';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface StadiumIconProps {
  width?: number;
  height?: number;
}

export const StadiumIcon: React.FC<StadiumIconProps> = ({ width = 400, height = 300 }) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 300">
      {/* Stadium base */}
      <Path
        d="M50 150 L175 100 L225 100 L350 150 L350 250 L50 250 Z"
        fill={COLORS.primary}
        stroke="#000000"
        strokeWidth="2"
      />
      
      {/* Field */}
      <Rect
        x="75"
        y="125"
        width="250"
        height="100"
        fill="#FFFFFF"
        stroke={COLORS.primary}
        strokeWidth="2"
      />
      <Rect
        x="85"
        y="135"
        width="230"
        height="80"
        fill={COLORS.primary}
        stroke="#FFFFFF"
        strokeWidth="2"
      />
      
      {/* Center circle */}
      <Circle
        cx="200"
        cy="175"
        r="20"
        stroke="#FFFFFF"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Center line */}
      <Line
        x1="200"
        y1="135"
        x2="200"
        y2="215"
        stroke="#FFFFFF"
        strokeWidth="2"
      />
      
      {/* Goal areas */}
      <Rect
        x="95"
        y="155"
        width="30"
        height="40"
        stroke="#FFFFFF"
        strokeWidth="2"
        fill="none"
      />
      <Rect
        x="275"
        y="155"
        width="30"
        height="40"
        stroke="#FFFFFF"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Stadium details */}
      <Path
        d="M50 150 L50 100 L175 50 L225 50 L350 100 L350 150"
        stroke="#000000"
        strokeWidth="2"
        fill="#E0E0E0"
      />
    </Svg>
  );
}; 