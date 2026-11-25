import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  Check,
  Copy,
  Download,
  ExternalLink,
  Footprints,
  Navigation,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { DeployGuideModal } from './components/DeployGuideModal.tsx';
import { OsmMap } from './components/OsmMap.tsx';
import { PuntoFormModal } from './components/PuntoFormModal.tsx';
import type { HealthStatus, PuntoAcceso, PuntoAccesoInput, TipoEntrada } from './types.ts';
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
  generateGoogleMapsCsv,
  generateGoogleMyMapsKml,
} from './utils/validation.ts';

type FilterValue = 'todos' | TipoEntrada;

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [puntos, setPuntos] = useState<PuntoAcceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const [filterTipo, setFilterTipo] = useState<FilterValue>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPunto, setEditingPunto] = useState<PuntoAcceso | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ latitud: number; longitud: number } | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deployGuideOpen, setDeployGuideOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [puntosRes, healthRes] = await Promise.all([fetch('/api/puntos'), fetch('/api/health')]);
      const puntosJson = await puntosRes.json();
      if (!puntosRes.ok) {
        throw new Error(puntosJson.error || 'No se pudieron cargar los puntos de acceso.');
      }
      const list = (puntosJson.puntos ?? []) as PuntoAcceso[];
      setPuntos(list);
      setSelectedId((prev) => {
        if (prev && list.some((p) => p.id === prev)) {
          return prev;
        }
        return list[0]?.id ?? null;
      });

      if (healthRes.ok) {
        const healthJson = (await healthRes.json()) as HealthStatus;
        setHealth(healthJson);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión con el servicio web.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const counts = useMemo(() => {
    let conRampa = 0;
    let conEscalones = 0;
    for (const p of puntos) {
      if (p.tipo_entrada === 'con rampa') {
        conRampa += 1;
      } else {
        conEscalones += 1;
      }
    }
    return {
      todos: puntos.length,
      conRampa,
      conEscalones,
    };
  }, [puntos]);

  const filteredPuntos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return puntos.filter((p) => {
      if (filterTipo !== 'todos' && p.tipo_entrada !== filterTipo) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.edificio.toLowerCase().includes(q) ||
        p.calle_acceso.toLowerCase().includes(q)
      );
    });
  }, [puntos, filterTipo, searchQuery]);

  const selectedPunto = useMemo(
    () => filteredPuntos.find((p) => p.id === selectedId) ?? puntos.find((p) => p.id === selectedId) ?? null,
    [filteredPuntos, puntos, selectedId],
  );

  const handleOpenCreate = () => {
    setEditingPunto(null);
    setPickedCoords(null);
    setPickMode(false);
    setFormOpen(true);
  };

  const handleOpenEdit = (punto: PuntoAcceso) => {
    setEditingPunto(punto);
    setPickedCoords(null);
    setPickMode(false);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingPunto(null);
    setPickedCoords(null);
    setPickMode(false);
  };

  const handleStartPickOnMap = () => {
    setFormOpen(false);
    setPickMode(true);
  };

  const handlePickCoordinates = (latitud: number, longitud: number) => {
    setPickedCoords({ latitud, longitud });
    setPickMode(false);
    setFormOpen(true);
  };

  const handleCancelPickMode = () => {
    setPickMode(false);
    setFormOpen(true);
  };

  const handleSubmitForm = async (input: PuntoAccesoInput, editingId?: string) => {
    const endpoint = editingId ? `/api/puntos/${encodeURIComponent(editingId)}` : '/api/puntos';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo guardar el punto de acceso.');
    }

    const saved = data.punto as PuntoAcceso;
    setPuntos((prev) => {
      if (editingId) {
        return prev.map((item) => (item.id === editingId ? saved : item));
      }
      return [saved, ...prev];
    });
    setSelectedId(saved.id);
    handleCloseForm();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/puntos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el punto.');
      }
      setPuntos((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (selectedId === id) {
          setSelectedId(next[0]?.id ?? null);
        }
        return next;
      });
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el punto.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSeedExamples = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/puntos/seed', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudieron cargar los ejemplos.');
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los ejemplos.');
      setLoading(false);
    }
  };

  const handleCopyGoogleMapsLink = async (punto: PuntoAcceso) => {
    const url = buildGoogleMapsSearchUrl(punto.latitud, punto.longitud);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(punto.id);
      setTimeout(() => setCopiedId((curr) => (curr === punto.id ? null : curr)), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleExportKml = () => {
    const target = filteredPuntos.length > 0 ? filteredPuntos : puntos;
    if (target.length === 0) {
      return;
    }
    const kml = generateGoogleMyMapsKml(target);
    downloadTextFile('puntos-acceso-google-maps.kml', kml, 'application/vnd.google-earth.kml+xml;charset=utf-8');
  };

  const handleExportCsv = () => {
    const target = filteredPuntos.length > 0 ? filteredPuntos : puntos;
    if (target.length === 0) {
      return;
    }
    const csv = generateGoogleMapsCsv(target);
    downloadTextFile('puntos-acceso-google-maps.csv', csv, 'text/csv;charset=utf-8');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 lg:h-screen lg:overflow-hidden">
      {/* Top Bar Contract: Brand wordmark — Nav links — 1 primary CTA */}
      <header className="flex shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-white px-5 py-3.5 lg:px-6">
        <a
          href="/"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          AccesoUrbano
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={handleExportKml}
            disabled={puntos.length === 0}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-slate-900 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar KML (Google Maps)
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={puntos.length === 0}
            className="transition-colors hover:text-slate-900 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setDeployGuideOpen(true)}
            className="transition-colors hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            Supabase y Render
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo punto
          </button>
        </div>
      </header>

      {/* Main Two-Column Workspace */}
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[440px_1fr] lg:overflow-hidden">
        {/* Left Directory & Filter Panel */}
        <aside className="flex flex-col border-b border-slate-200 bg-white lg:border-r lg:border-b-0 lg:overflow-hidden">
          <div className="space-y-3 border-b border-slate-200 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h1 className="font-display text-base font-semibold text-slate-900">
                Puntos de acceso
              </h1>
              <span className="text-xs text-slate-500 tabular-nums">
                {filteredPuntos.length} de {puntos.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, edificio o calle..."
                aria-label="Buscar puntos de acceso"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            {/* Segmented Filter Control */}
            <div
              className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
              role="group"
              aria-label="Filtrar por tipo de entrada"
            >
              <button
                type="button"
                onClick={() => setFilterTipo('todos')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                  filterTipo === 'todos'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({counts.todos})
              </button>
              <button
                type="button"
                onClick={() => setFilterTipo('con rampa')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                  filterTipo === 'con rampa'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Con rampa ({counts.conRampa})
              </button>
              <button
                type="button"
                onClick={() => setFilterTipo('con escalones')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                  filterTipo === 'con escalones'
                    ? 'bg-white text-amber-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Con escalones ({counts.conEscalones})
              </button>
            </div>
          </div>

          {/* Mobile quick actions bar */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 md:hidden">
            <button
              type="button"
              onClick={handleExportKml}
              disabled={puntos.length === 0}
              className="text-xs font-medium text-blue-700 disabled:opacity-40 whitespace-nowrap"
            >
              Exportar KML
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={puntos.length === 0}
              className="text-xs font-medium text-slate-700 disabled:opacity-40 whitespace-nowrap"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => setDeployGuideOpen(true)}
              className="text-xs font-medium text-slate-700 whitespace-nowrap"
            >
              Supabase y Render
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="m-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              <span>{error}</span>
              <button
                type="button"
                onClick={loadData}
                className="font-semibold underline hover:text-red-950 whitespace-nowrap shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* List Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {loading ? (
              <div className="space-y-4 p-4" aria-label="Cargando puntos">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="animate-pulse space-y-2 py-2">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-3.5 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-2/5 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : filteredPuntos.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-900">
                  {puntos.length === 0
                    ? 'Todavía no hay puntos de acceso cargados'
                    : 'No hay coincidencias para el filtro aplicado'}
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  {puntos.length === 0
                    ? 'Agregá un nuevo punto con coordenadas decimales o cargá los 3 ejemplos iniciales.'
                    : 'Probá limpiando el texto de búsqueda o cambiando el tipo de entrada.'}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {puntos.length === 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSeedExamples}
                        className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Cargar 3 ejemplos iniciales
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800"
                      >
                        Agregar primer punto
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterTipo('todos');
                        setSearchQuery('');
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Mostrar todos
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredPuntos.map((punto) => {
                const isSelected = punto.id === selectedId;
                const isRamp = punto.tipo_entrada === 'con rampa';
                const isConfirmingDelete = confirmDeleteId === punto.id;

                return (
                  <div
                    key={punto.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-blue-50/65' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(punto.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(punto.id);
                        }
                      }}
                      className="cursor-pointer px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm font-semibold text-slate-900 leading-snug">
                            {punto.nombre}
                          </h2>
                          <p className="mt-1 text-xs text-slate-600 truncate">
                            {punto.edificio} <span aria-hidden="true">·</span> {punto.calle_acceso}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                isRamp ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {isRamp ? (
                                <Accessibility className="h-3.5 w-3.5" />
                              ) : (
                                <Footprints className="h-3.5 w-3.5" />
                              )}
                              {isRamp ? 'Con rampa' : 'Con escalones'}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              /
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                              {punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}
                            </span>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={buildGoogleMapsSearchUrl(punto.latitud, punto.longitud)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver en Google Maps"
                            aria-label={`Ver ${punto.nombre} en Google Maps`}
                            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(punto)}
                            title="Editar punto"
                            aria-label={`Editar ${punto.nombre}`}
                            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteId(isConfirmingDelete ? null : punto.id)
                            }
                            title="Eliminar punto"
                            aria-label={`Eliminar ${punto.nombre}`}
                            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {isConfirmingDelete && (
                        <div
                          className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>¿Eliminar este punto de acceso?</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-1 font-medium text-slate-700 hover:bg-white"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === punto.id}
                              onClick={() => handleDelete(punto.id)}
                              className="rounded bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingId === punto.id ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right OpenStreetMap + Selected Location Detail Panel */}
        <section className="flex flex-col lg:overflow-hidden">
          <div className="relative flex-1 min-h-[420px]">
            <OsmMap
              puntos={filteredPuntos}
              selectedId={selectedId}
              onSelectPunto={(id) => setSelectedId(id)}
              pickMode={pickMode}
              pickedCoords={pickedCoords}
              onPickCoordinates={handlePickCoordinates}
              onCancelPickMode={handleCancelPickMode}
            />
          </div>

          {/* Selected Record Detail & Google Maps Handoff Bar */}
          {selectedPunto && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 lg:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
                      {selectedPunto.nombre}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        selectedPunto.tipo_entrada === 'con rampa'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {selectedPunto.tipo_entrada === 'con rampa' ? (
                        <Accessibility className="h-3.5 w-3.5" />
                      ) : (
                        <Footprints className="h-3.5 w-3.5" />
                      )}
                      {selectedPunto.tipo_entrada === 'con rampa' ? 'Con rampa' : 'Con escalones'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>{selectedPunto.edificio}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedPunto.calle_acceso}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-700 tabular-nums">
                      Lat {selectedPunto.latitud.toFixed(6)}, Lng {selectedPunto.longitud.toFixed(6)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={buildGoogleMapsSearchUrl(selectedPunto.latitud, selectedPunto.longitud)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver en Google Maps
                  </a>
                  <a
                    href={buildGoogleMapsDirectionsUrl(selectedPunto.latitud, selectedPunto.longitud)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Navigation className="h-3.5 w-3.5 text-slate-500" />
                    Cómo llegar
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyGoogleMapsLink(selectedPunto)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    {copiedId === selectedPunto.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Enlace copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        Copiar enlace
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedPunto)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    Editar
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <PuntoFormModal
        isOpen={formOpen}
        editingPunto={editingPunto}
        pickedCoords={pickedCoords}
        onStartPickOnMap={handleStartPickOnMap}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />

      <DeployGuideModal
        isOpen={deployGuideOpen}
        onClose={() => setDeployGuideOpen(false)}
        health={health}
      />
    </div>
  );
}
