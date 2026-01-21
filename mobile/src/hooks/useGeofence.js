import { useEffect, useRef } from "react";
import * as Location from "expo-location";

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const r = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * r * Math.asin(Math.sqrt(h));
}

export default function useGeofence(zone, onExit, enabled = true) {
  const subscriptionRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function startWatch() {
      if (!enabled || !zone) return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 15000,
          distanceInterval: 10
        },
        (pos) => {
          if (!active) return;
          const current = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          const dist = distanceMeters(current, zone);
          if (dist > zone.radius_meters) {
            onExit();
          }
        }
      );
    }
    startWatch();
    return () => {
      active = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, [enabled, onExit, zone]);
}
