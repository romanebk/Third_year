// Auto-détection de la localisation météo au premier chargement d'un compte neuf.
// Best-effort : géolocalisation du navigateur -> POST /api/settings/locate (le
// backend résout la ville via Nominatim et met à jour weatherCity + les instances
// météo par défaut). En cas de refus, d'erreur ou d'absence d'API géolocation, on
// laisse la valeur par défaut (Paris) — jamais une erreur bloquante.
export function autoDetectWeatherLocation(onSuccess: () => void): void {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetch("/api/settings/locate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude }),
      })
        .then((response) => {
          if (response.ok) onSuccess();
        })
        .catch(() => {
          // géoloc réussie mais serveur indisponible : on garde la valeur par défaut
        });
    },
    () => {
      // refus ou erreur de géolocalisation : Paris par défaut, pas de blocage
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
  );
}
