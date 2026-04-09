import { memo } from 'react';

interface AnimatedRobotEyeProps {
  /** Size of the eye overlay in pixels */
  size?: number;
  /** Position from top as percentage */
  top?: string;
  /** Position from left as percentage */
  left?: string;
  /** Whether to show white background to cover static PNG eye */
  coverBackground?: boolean;
  /** Background color for the cover circle (use 'transparent' for chat avatars) */
  coverColor?: string;
}

/**
 * Animated SVG eye overlay that sits on top of the robot logo's eye area.
 * Uses pure CSS animations for blinking and pupil movement.
 */
export const AnimatedRobotEye = memo(({ 
  size = 14, 
  top = '44%', 
  left = '50%',
  coverBackground = true,
  coverColor = 'white'
}: AnimatedRobotEyeProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="absolute pointer-events-none"
      style={{ top, left, transform: 'translate(-50%, -50%)' }}
      aria-hidden="true"
    >
      {/* Background to cover static PNG eye */}
      {coverBackground && (
        <circle cx="12" cy="12" r="11" fill={coverColor} />
      )}
      
      {/* Animated blink group */}
      <g className="robot-eye-blink" style={{ transformOrigin: '12px 12px' }}>
        {/* Iris - blue ring */}
        <circle cx="12" cy="12" r="10" fill="#335CF4" />
        <circle cx="12" cy="12" r="6" fill="white" />
        
        {/* Pupil with movement animation */}
        <g className="robot-eye-move" style={{ transformOrigin: '12px 12px' }}>
          <circle cx="12" cy="12" r="4" fill="#1a1a2e" />
          {/* Highlight */}
          <circle cx="10" cy="10" r="1.5" fill="white" opacity="0.9" />
        </g>
      </g>
    </svg>
  );
});

AnimatedRobotEye.displayName = 'AnimatedRobotEye';
