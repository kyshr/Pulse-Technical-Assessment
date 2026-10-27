"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
  linkedPeerId,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
  // Peer we are requesting, being requested by, or talking to.
  linkedPeerId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  // The idle globe drifts until the user grabs it or we fly to them.
  const spinRef = useRef(true);
  const framedRef = useRef<string | null>(null);

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        center: [100, 15],
        zoom: 1.6,
        attributionControl: true,
      });
      map.on("style.load", () => {
        map.setFog({
          color: "rgb(14, 22, 40)",
          "high-color": "rgb(36, 92, 120)",
          "horizon-blend": 0.06,
          "space-color": "rgb(3, 5, 10)",
          "star-intensity": 0.5,
        });
      });

      const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const spin = () => {
        if (!spinRef.current || reduceMotion) return;
        const c = map.getCenter();
        map.easeTo({ center: [c.lng - 6, c.lat], duration: 1000, easing: (t) => t });
      };
      map.on("moveend", spin);
      const stopSpin = () => (spinRef.current = false);
      map.on("mousedown", stopSpin);
      map.on("touchstart", stopSpin);
      map.on("wheel", stopSpin);

      map.on("load", () => {
        if (cancelled) return;
        setReady(true);
        spin();
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Show / move the user's own "you are here" pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.innerHTML = `<span class="pulse-me-label">You</span>`;
        meMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
        spinRef.current = false;
        // Zoom 3 keeps neighbouring countries in view. Mapbox skips the
        // animation for prefers-reduced-motion users.
        map.flyTo({ center: [me.lng, me.lat], zoom: 3, duration: 4000 });
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.innerHTML = `<span class="pulse-core"></span>`;
          el.style.setProperty("--d", `${(Math.random() * 2.4).toFixed(2)}s`);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          // Mapbox overwrites these with role="img" / "Map marker".
          el.setAttribute("role", "button");
          markers.set(peer.id, marker);
        }
        const el = marker.getElement();
        const active = peer.id === linkedPeerId;
        el.toggleAttribute("data-active", active);
        el.toggleAttribute("data-busy", peer.busy && !active);
        el.setAttribute(
          "aria-label",
          peer.busy ? "Stranger, already in a chat" : "Connect with a stranger",
        );
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready, linkedPeerId]);

  // Glowing line between you and the peer you're linked with.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const peer = peers.find((p) => p.id === linkedPeerId);
    const data = {
      type: "FeatureCollection" as const,
      features:
        me && peer
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "LineString" as const,
                  coordinates: [
                    [me.lng, me.lat],
                    [peer.lng, peer.lat],
                  ],
                },
              },
            ]
          : [],
    };
    // Frame both ends once per link, leaving room for the chat panel/sheet.
    // shortcut: a link across the antimeridian frames the long way round
    // (zooms out too far), fine until users span the Pacific date line.
    if (me && peer && framedRef.current !== peer.id) {
      framedRef.current = peer.id;
      const desktop = window.innerWidth >= 768;
      map.fitBounds(
        [
          [Math.min(me.lng, peer.lng), Math.min(me.lat, peer.lat)],
          [Math.max(me.lng, peer.lng), Math.max(me.lat, peer.lat)],
        ],
        {
          padding: desktop
            ? { top: 120, bottom: 120, left: 120, right: 520 }
            : { top: 120, bottom: window.innerHeight * 0.6, left: 60, right: 60 },
          maxZoom: 7,
          duration: 2000,
        },
      );
    }
    if (!peer) framedRef.current = null;

    const source = map.getSource("link") as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource("link", { type: "geojson", data });
    map.addLayer({
      id: "link-glow",
      type: "line",
      source: "link",
      layout: { "line-cap": "round" },
      paint: { "line-color": "#34d399", "line-width": 10, "line-blur": 8, "line-opacity": 0.6 },
    });
    map.addLayer({
      id: "link-core",
      type: "line",
      source: "link",
      layout: { "line-cap": "round" },
      paint: { "line-color": "#d1fae5", "line-width": 2, "line-dasharray": [2, 1.5] },
    });
  }, [me, peers, linkedPeerId, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-[#03050a]" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md rounded-lg bg-zinc-800 p-4 text-sm text-zinc-200">
            Set{" "}
            <code className="text-emerald-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the map.
          </p>
        </div>
      )}

      {/* Online count — only once we're on the map ourselves. */}
      {me && (
        <div className="glass absolute top-4 left-4 flex items-center gap-2 rounded-full px-3.5 py-2 text-sm text-zinc-200">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153)]" />
          <span>
            <span className="font-semibold tabular-nums text-white">{peers.length}</span>{" "}
            online
          </span>
        </div>
      )}
    </div>
  );
}
