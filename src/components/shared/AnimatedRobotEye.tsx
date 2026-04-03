import { memo } from 'react';

interface AnimatedRobotEyeProps {
  /** Size of the eye overlay in pixels */
  size?: number;
  /** Position from top as percentage */
  top?: string;
  /** Position from left as percentage */
  left?: string;
}

/**
 * Animated SVG eye overlay that sits on top of the robot logo's eye area.
 * Uses pure CSS animations for blinking and pupil movement.
 */
export const AnimatedRobotEye = memo(({ 
  size = 14, 
  top = '42%', 
  left = '50%' 
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
      {/* Outer eye shape */}
      <ellipse cx="12" cy="12" rx="11" ry="9" fill="transparent" />
      
      {/* Animated blink group */}
      <g className="robot-eye-blink" style={{ transformOrigin: '12px 12px' }}>
        {/* Pupil with movement animation */}
        <g className="robot-eye-move" style={{ transformOrigin: '12px 12px' }}>
          <circle cx="12" cy="12" r="4.5" fill="currentColor" className="text-[#335CF4] dark:text-[#5B7FFF]" />
          {/* Highlight */}
          <circle cx="10.5" cy="10.5" r="1.5" fill="white" opacity="0.8" />
        </g>
      </g>
    </svg>
  );
});

AnimatedRobotEye.displayName = 'AnimatedRobotEye';
