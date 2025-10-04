
import { useEffect } from "react";

export const CursorFollower = () => {
  useEffect(() => {
    // Create the ball elements
    const blur = document.createElement("div");
    blur.style.position = "fixed";
    blur.style.zIndex = "999999";
    blur.style.pointerEvents = "none";
    blur.style.width = "32px";
    blur.style.height = "32px";
    blur.style.borderRadius = "50%";
    blur.style.background = "radial-gradient(circle at 50% 50%, #8b5cf6cc 40%, #a3e63544 100%)";
    blur.style.filter = "blur(6px)";
    blur.style.transition = "opacity 0.15s, background 0.15s";
    blur.style.opacity = "1";
    blur.style.left = "0px";
    blur.style.top = "0px";
    blur.style.transform = "translate(-16px, -16px)";
    
    const dot = document.createElement("div");
    dot.style.position = "fixed";
    dot.style.zIndex = "999999";
    dot.style.pointerEvents = "none";
    dot.style.width = "8px";
    dot.style.height = "8px";
    dot.style.borderRadius = "50%";
    dot.style.background = "#8b5cf6";
    dot.style.left = "0px";
    dot.style.top = "0px";
    dot.style.opacity = "1";
    dot.style.transform = "translate(-4px, -4px)";

    document.body.appendChild(blur);
    document.body.appendChild(dot);

    // Smooth following variables
    let targetX = 0;
    let targetY = 0;
    let currentBlurX = 0;
    let currentBlurY = 0;
    let currentDotX = 0;
    let currentDotY = 0;
    let animationId: number;

    const smoothFollow = () => {
      // Smooth interpolation - blur follows slower for trailing effect
      currentBlurX += (targetX - currentBlurX) * 0.08;
      currentBlurY += (targetY - currentBlurY) * 0.08;
      
      // Dot follows faster but still smooth
      currentDotX += (targetX - currentDotX) * 0.15;
      currentDotY += (targetY - currentDotY) * 0.15;
      
      blur.style.left = `${currentBlurX}px`;
      blur.style.top = `${currentBlurY}px`;
      dot.style.left = `${currentDotX}px`;
      dot.style.top = `${currentDotY}px`;
      
      animationId = requestAnimationFrame(smoothFollow);
    };

    const move = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      blur.style.opacity = "1";
      dot.style.opacity = "1";
    };

    const hide = () => {
      blur.style.opacity = "0";
      dot.style.opacity = "0";
    };

    const show = () => {
      blur.style.opacity = "1";
      dot.style.opacity = "1";
    };

    // Start the smooth animation loop
    smoothFollow();

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseleave", hide);
    window.addEventListener("mouseenter", show);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", hide);
      window.removeEventListener("mouseenter", show);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      blur.remove();
      dot.remove();
    };
  }, []);

  return null;
};
