import { memo } from 'react';

/**
 * Monochrome animated eye overlay for the black/white chat robot avatar.
 * Uses the same CSS keyframes (robot-eye-blink, robot-eye-move) but with
 * a dark/white color scheme to match the chat robot style.
 */
export const AnimatedChatEye = memo(({ size = 12 }: { size?: number }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="absolute pointer-events-none"
      style={{ top: '33%', left: '50%', transform: 'translate(-50%, -50%)' }}
      aria-hidden="true"
    >
      {/* White background to cover static PNG eye */}
      <circle cx="12" cy="12" r="11" fill="white" />
      
      {/* Animated blink group */}
      <g className="robot-eye-blink" style={{ transformOrigin: '12px 12px' }}>
        {/* Outer eye ring - dark to match chat robot */}
        <circle cx="12" cy="12" r="10" fill="#1a1a2e" />
        <circle cx="12" cy="12" r="6.5" fill="white" />
        
        {/* Pupil with movement */}
        <g className="robot-eye-move" style={{ transformOrigin: '12px 12px' }}>
          <circle cx="12" cy="12" r="4" fill="#1a1a2e" />
          {/* Highlight */}
          <circle cx="10" cy="10" r="1.5" fill="white" opacity="0.8" />
        </g>
      </g>
    </svg>
  );
});

AnimatedChatEye.displayName = 'AnimatedChatEye';
