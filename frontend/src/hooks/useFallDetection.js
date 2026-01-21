import { useEffect, useRef } from "react";

export default function useFallDetection(onPossibleFall, enabled = true) {
  const cooldownRef = useRef(false);
  const stillTimeoutRef = useRef(null);

  useEffect(() => {
    if (!enabled || !window.DeviceMotionEvent) {
      return undefined;
    }

    const handleMotion = (event) => {
      if (cooldownRef.current) {
        return;
      }
      const acc = event.accelerationIncludingGravity;
      if (!acc) {
        return;
      }
      const magnitude = Math.sqrt(
        (acc.x || 0) * (acc.x || 0) +
          (acc.y || 0) * (acc.y || 0) +
          (acc.z || 0) * (acc.z || 0)
      );
      if (magnitude > 25) {
        cooldownRef.current = true;
        if (stillTimeoutRef.current) {
          clearTimeout(stillTimeoutRef.current);
        }
        stillTimeoutRef.current = setTimeout(() => {
          onPossibleFall();
          cooldownRef.current = false;
        }, 30000);
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      if (stillTimeoutRef.current) {
        clearTimeout(stillTimeoutRef.current);
      }
    };
  }, [onPossibleFall]);
}
