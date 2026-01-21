import { useEffect, useRef } from "react";

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * r * Math.asin(Math.sqrt(h));
}

export default function useGeofence(zone, onExit) {
  const watchRef = useRef(null);

  useEffect(() => {
    if (!zone || !navigator.geolocation) {
      return undefined;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const center = { lat: zone.latitude, lng: zone.longitude };
        const dist = distanceMeters(current, center);
        if (dist > zone.radius_meters) {
          onExit();
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => {
      if (watchRef.current) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [zone, onExit]);
}
