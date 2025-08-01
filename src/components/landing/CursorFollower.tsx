
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
    blur.style.background = "radial-gradient(circle at 50% 50%, #8b5cf6cc 40%, #a3e63544 100%)"; // adjust for your colors
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
    dot.style.background = "#8b5cf6"; // your main color
    dot.style.left = "0px";
    dot.style.top = "0px";
    dot.style.opacity = "1";
    dot.style.transform = "translate(-4px, -4px)";

    document.body.appendChild(blur);
    document.body.appendChild(dot);

    const move = (e: MouseEvent) => {
      blur.style.left = `${e.clientX}px`;
      blur.style.top = `${e.clientY}px`;
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
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

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseleave", hide);
    window.addEventListener("mouseenter", show);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseleave", hide);
      window.removeEventListener("mouseenter", show);
      blur.remove();
      dot.remove();
    };
  }, []);

  // Nothing rendered by React, all managed via DOM for speed
  return null;
};
