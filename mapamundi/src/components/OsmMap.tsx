import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LocateFixed, X } from 'lucide-react';
import type { PuntoAcceso } from '../types.ts';

interface OsmMapProps {
  puntos: PuntoAcceso[];
  selectedId: string | null;
  onSelectPunto: (id: string) => void;
  pickMode: boolean;
  pickedCoords: { latitud: number; longitud: number } | null;
  onPickCoordinates: (latitud: number, longitud: number) => void;
  onCancelPickMode: () => void;
}

const DEFAULT_CENTER: [number, number] = [-34.601078, -58.383078];
const DEFAULT_ZOOM = 13;

function createMarkerIcon(tipo: PuntoAcceso['tipo_entrada'], isSelected: boolean): L.DivIcon {
  const isRamp = tipo === 'con rampa';
  const fill = isRamp ? '#059669' : '#D97706';
  const ringColor = isSelected ? '#1D4ED8' : '#FFFFFF';
  const size = isSelected ? 40 : 32;
  const ringWidth = isSelected ? 3.5 : 2.5;

  const glyphSvg = isRamp
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18"/><path d="M4 15l15-7"/><path d="M19 8v7"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h5v-4h5v-4h6"/></svg>`;

  const html = `
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      background:${fill};
      border:${ringWidth}px solid ${ringColor};
      box-shadow:${isSelected ? '0 0 0 4px rgba(37,99,235,0.28), 0 8px 18px rgba(15,23,42,0.28)' : '0 4px 10px rgba(15,23,42,0.22)'};
      display:flex;
      align-items:center;
      justify-content:center;
      transition:transform 160ms ease;
    ">
      ${glyphSvg}
    </div>
  `;

  return L.divIcon({
    className: 'custom-osm-marker',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

function createDraftIcon(): L.DivIcon {
  const html = `
    <div style="
      width:34px;
      height:34px;
      border-radius:9999px;
      background:#1D4ED8;
      border:3px solid #FFFFFF;
      box-shadow:0 0 0 5px rgba(29,78,216,0.28), 0 6px 14px rgba(15,23,42,0.25);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="width:8px;height:8px;border-radius:9999px;background:#FFFFFF;"></div>
    </div>
  `;
  return L.divIcon({
    className: 'custom-osm-marker',
    html,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function buildPopupElement(punto: PuntoAcceso): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'min-w-[210px] max-w-[260px]';

  const typeLabel = document.createElement('div');
  typeLabel.className =
    punto.tipo_entrada === 'con rampa'
      ? 'text-[11px] font-semibold text-emerald-700 mb-0.5'
      : 'text-[11px] font-semibold text-amber-700 mb-0.5';
  typeLabel.textContent = punto.tipo_entrada === 'con rampa' ? 'Entrada con rampa' : 'Entrada con escalones';

  const title = document.createElement('div');
  title.className = 'text-sm font-semibold text-slate-900 leading-snug';
  title.textContent = punto.nombre;

  const building = document.createElement('div');
  building.className = 'text-xs text-slate-600 mt-1';
  building.textContent = `${punto.edificio} · ${punto.calle_acceso}`;

  const coords = document.createElement('div');
  coords.className = 'text-[11px] font-mono text-slate-500 mt-1.5 tabular-nums';
  coords.textContent = `${punto.latitud.toFixed(6)}, ${punto.longitud.toFixed(6)}`;

  wrapper.appendChild(typeLabel);
  wrapper.appendChild(title);
  wrapper.appendChild(building);
  wrapper.appendChild(coords);
  return wrapper;
}

export function OsmMap({
  puntos,
  selectedId,
  onSelectPunto,
  pickMode,
  pickedCoords,
  onPickCoordinates,
  onCancelPickMode,
}: OsmMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const draftMarkerRef = useRef<L.Marker | null>(null);
  const pickModeRef = useRef(pickMode);
  const onPickRef = useRef(onPickCoordinates);
  const onSelectRef = useRef(onSelectPunto);
  const hasFittedInitialRef = useRef(false);

  pickModeRef.current = pickMode;
  onPickRef.current = onPickCoordinates;
  onSelectRef.current = onSelectPunto;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pickModeRef.current) {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        onPickRef.current(lat, lng);
      }
    });

    mapRef.current = map;
    markersLayerRef.current = layerGroup;

    const containerEl = containerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(containerEl);

    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      markerMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) {
      return;
    }

    layerGroup.clearLayers();
    markerMapRef.current.clear();

    const validPuntos = puntos.filter(
      (p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud),
    );

    validPuntos.forEach((punto) => {
      const isSelected = punto.id === selectedId;
      const marker = L.marker([punto.latitud, punto.longitud], {
        icon: createMarkerIcon(punto.tipo_entrada, isSelected),
        zIndexOffset: isSelected ? 500 : 0,
      });

      marker.bindPopup(buildPopupElement(punto), { closeButton: true });
      marker.on('click', () => {
        if (!pickModeRef.current) {
          onSelectRef.current(punto.id);
        }
      });

      marker.addTo(layerGroup);
      markerMapRef.current.set(punto.id, marker);
    });

    if (!hasFittedInitialRef.current && validPuntos.length > 0 && !selectedId) {
      hasFittedInitialRef.current = true;
      map.invalidateSize({ animate: false });
      const size = map.getSize();
      if (size.x > 0 && size.y > 0) {
        const bounds = L.latLngBounds(validPuntos.map((p) => [p.latitud, p.longitud]));
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15, animate: false });
      }
    }
  }, [puntos, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || pickMode) {
      return;
    }
    const target = puntos.find((p) => p.id === selectedId);
    const marker = markerMapRef.current.get(selectedId);
    if (!target || !marker || !Number.isFinite(target.latitud) || !Number.isFinite(target.longitud)) {
      return;
    }

    map.invalidateSize({ animate: false });
    const size = map.getSize();
    const currentZoom = Number.isFinite(map.getZoom()) ? map.getZoom() : DEFAULT_ZOOM;
    const targetZoom = Math.max(currentZoom, 15);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || size.x <= 0 || size.y <= 0) {
      map.setView([target.latitud, target.longitud], targetZoom, { animate: false });
    } else {
      map.flyTo([target.latitud, target.longitud], targetZoom, {
        duration: 0.45,
      });
    }
    marker.openPopup();
  }, [selectedId, puntos, pickMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const el = map.getContainer();
    el.style.cursor = pickMode ? 'crosshair' : '';

    if (draftMarkerRef.current) {
      draftMarkerRef.current.remove();
      draftMarkerRef.current = null;
    }

    if (
      pickMode &&
      pickedCoords &&
      Number.isFinite(pickedCoords.latitud) &&
      Number.isFinite(pickedCoords.longitud)
    ) {
      draftMarkerRef.current = L.marker([pickedCoords.latitud, pickedCoords.longitud], {
        icon: createDraftIcon(),
        zIndexOffset: 900,
      }).addTo(map);
    }
  }, [pickMode, pickedCoords]);

  const handleFitAll = () => {
    const map = mapRef.current;
    const validPuntos = puntos.filter(
      (p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud),
    );
    if (!map || validPuntos.length === 0) {
      return;
    }
    map.invalidateSize({ animate: false });
    if (validPuntos.length === 1) {
      map.setView([validPuntos[0].latitud, validPuntos[0].longitud], 15);
      return;
    }
    const bounds = L.latLngBounds(validPuntos.map((p) => [p.latitud, p.longitud]));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
  };

  return (
    <div className="relative h-full w-full min-h-[420px] bg-slate-200">
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Mapa interactivo de OpenStreetMap"
      />

      {/* Top-right map action control */}
      <div className="pointer-events-none absolute top-3 right-3 z-[400] flex items-center gap-2">
        {puntos.length > 0 && !pickMode && (
          <button
            type="button"
            onClick={handleFitAll}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 whitespace-nowrap shrink-0"
          >
            <LocateFixed className="h-3.5 w-3.5 text-slate-500" />
            Ver todos ({puntos.length})
          </button>
        )}
      </div>

      {/* Coordinate pick banner */}
      {pickMode && (
        <div className="absolute top-3 left-1/2 z-[400] -translate-x-1/2 flex items-center gap-3 rounded-lg border border-blue-200 bg-white/95 px-4 py-2 text-xs text-slate-800 shadow-md backdrop-blur-sm">
          <span className="font-medium">
            Hacé clic en el mapa OpenStreetMap para capturar latitud y longitud en grados decimales
          </span>
          <button
            type="button"
            onClick={onCancelPickMode}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            Volver al formulario
          </button>
        </div>
      )}

      {/* Map legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-xs text-slate-700 shadow-sm backdrop-blur-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
          Con rampa
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-600" aria-hidden="true" />
          Con escalones
        </span>
      </div>
    </div>
  );
}
