import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors } from '../theme';

type IconProps = { size?: number; color?: string };

export const ChevronLeft = ({ size = 18, color = colors.text }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SearchIcon = ({ size = 18, color = colors.text }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={2} />
    <Path d="M21 21l-4.3-4.3" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const HeartIcon = ({ size = 18, color = colors.text }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 20s-7-4.35-9-8.5C1.5 8 3 5 6 5c2 0 3.5 1.2 4 2.5.5-1.3 2-2.5 4-2.5 3 0 4.5 3 3 6.5-2 4.15-9 8.5-9 8.5z"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  </Svg>
);

export const ClockIcon = ({ size = 18, color = colors.text }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
    <Path d="M12 7v5l3 3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const UserIcon = ({ size = 18, color = colors.text }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth={2} />
    <Path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const ShareIcon = ({ size = 16, color = colors.text }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3v13m0-13l-4 4m4-4l4 4M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const BoltIcon = ({ size = 16, color = colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
  </Svg>
);

export const CheckIcon = ({ size = 14, color = colors.bg }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12l5 5L20 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const LockIcon = ({ size = 12, color = colors.textFaint }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="11" width="14" height="9" rx="2" stroke={color} strokeWidth={2} />
    <Path d="M8 11V8a4 4 0 018 0v3" stroke={color} strokeWidth={2} />
  </Svg>
);

export const TipSentIcon = ({ size = 15, color = colors.purple }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 17L17 7M17 7H8M17 7v9" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
