import { useEffect, useRef } from "react";
import { Accelerometer } from "expo-sensors";

export default function useFallDetection(onPossibleFall, enabled = true) {
  const cooldownRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let subscription = null;

    async function start() {
      if (!enabled) return;
      Accelerometer.setUpdateInterval(500);
      subscription = Accelerometer.addListener((data) => {
        if (cooldownRef.current) return;
        const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z) * 9.81;
        if (magnitude > 25) {
          cooldownRef.current = true;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            onPossibleFall();
            cooldownRef.current = false;
          }, 30000);
        }
      });
    }

    start();
    return () => {
      if (subscription) {
        subscription.remove();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, onPossibleFall]);
}
