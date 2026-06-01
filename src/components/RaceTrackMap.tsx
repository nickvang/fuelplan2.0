import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Race } from '@/contexts/RaceContext';

// ── GPX parser ──────────────────────────────────────────────────────────────
type LatLng = [number, number];

function parseGpx(xml: string): { tracks: LatLng[][]; waypoints: LatLng[] } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const tracks: LatLng[][] = [];
  doc.querySelectorAll('trkseg').forEach((seg) => {
    const pts: LatLng[] = [];
    seg.querySelectorAll('trkpt').forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') ?? '');
      const lon = parseFloat(pt.getAttribute('lon') ?? '');
      if (isFinite(lat) && isFinite(lon)) pts.push([lat, lon]);
    });
    if (pts.length) tracks.push(pts);
  });
  const waypoints: LatLng[] = [];
  doc.querySelectorAll('wpt').forEach((wpt) => {
    const lat = parseFloat(wpt.getAttribute('lat') ?? '');
    const lon = parseFloat(wpt.getAttribute('lon') ?? '');
    if (isFinite(lat) && isFinite(lon)) waypoints.push([lat, lon]);
  });
  return { tracks, waypoints };
}

// ── Marker icon (avoids Leaflet's Webpack/Vite icon-path bug) ────────────────
function makePin(color: string) {
  return L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
      <circle cx="10" cy="10" r="7" fill="${color}" stroke="white" stroke-width="2.5"/>
    </svg>`,
  });
}
const startPin = makePin('#16a34a');  // green
const wayptPin = makePin('#2563eb');  // blue

// ── Auto-fit bounds helper ───────────────────────────────────────────────────
function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
    }
  }, [map, points]);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
interface RaceTrackMapProps {
  race: Race;
}

type Status = 'loading' | 'track' | 'waypoint' | 'error';

export function RaceTrackMap({ race }: RaceTrackMapProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [trackPoints, setTrackPoints] = useState<LatLng[]>([]);
  const [waypointPins, setWaypointPins] = useState<LatLng[]>([]);
  const fallback: LatLng = [race.lat, race.lng];

  useEffect(() => {
    if (!race.gpx_path) {
      setStatus('waypoint');
      setWaypointPins([fallback]);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    fetch(race.gpx_path)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      })
      .then((xml) => {
        if (cancelled) return;
        const { tracks, waypoints } = parseGpx(xml);
        if (tracks.length && tracks[0].length > 1) {
          const allPts = tracks.flat();
          setTrackPoints(allPts);
          setStatus('track');
        } else {
          const pins = waypoints.length ? waypoints : [fallback];
          setWaypointPins(pins);
          setStatus('waypoint');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWaypointPins([fallback]);
          setStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [race.id, race.gpx_path]);

  const displayPoints = status === 'track' ? trackPoints : waypointPins.length ? waypointPins : [fallback];
  const centerPt = displayPoints[0] ?? fallback;

  return (
    <div className="relative rounded-lg overflow-hidden border border-border/40" style={{ height: 220 }}>
      <MapContainer
        center={centerPt}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds points={displayPoints} />

        {status === 'track' && (
          <>
            <Polyline
              positions={trackPoints}
              pathOptions={{ color: '#f97316', weight: 3, opacity: 0.85 }}
            />
            <Marker position={trackPoints[0]} icon={startPin}>
              <Popup>Start — {race.name}</Popup>
            </Marker>
            <Marker position={trackPoints[trackPoints.length - 1]} icon={makePin('#dc2626')}>
              <Popup>Finish — {race.name}</Popup>
            </Marker>
          </>
        )}

        {status !== 'track' && waypointPins.map((pt, i) => (
          <Marker key={i} position={pt} icon={wayptPin}>
            <Popup>{race.name}</Popup>
          </Marker>
        ))}

        {status !== 'track' && !waypointPins.length && (
          <Marker position={fallback} icon={wayptPin}>
            <Popup>{race.name}</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Status badge */}
      <div className="absolute bottom-2 left-2 z-[1000] pointer-events-none">
        {status === 'loading' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white">Loading…</span>
        )}
        {status === 'error' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white">Course GPX pending</span>
        )}
        {status === 'waypoint' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-white">Course GPX pending</span>
        )}
        {status === 'track' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-white">
            {(trackPoints.length).toLocaleString()} track points
          </span>
        )}
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 right-2 z-[1000] pointer-events-none">
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/80 text-gray-600">© OpenStreetMap</span>
      </div>
    </div>
  );
}
