import { useEffect, useState } from 'react';
import { Accessibility, Footprints, MapPin, X } from 'lucide-react';
import type { PuntoAcceso, PuntoAccesoInput, TipoEntrada } from '../types.ts';
import { validatePuntoInput } from '../utils/validation.ts';

interface PuntoFormModalProps {
  isOpen: boolean;
  editingPunto: PuntoAcceso | null;
  pickedCoords: { latitud: number; longitud: number } | null;
  onStartPickOnMap: () => void;
  onClose: () => void;
  onSubmit: (input: PuntoAccesoInput, editingId?: string) => Promise<void>;
}

export function PuntoFormModal({
  isOpen,
  editingPunto,
  pickedCoords,
  onStartPickOnMap,
  onClose,
  onSubmit,
}: PuntoFormModalProps) {
  const [nombre, setNombre] = useState('');
  const [edificio, setEdificio] = useState('');
  const [calleAcceso, setCalleAcceso] = useState('');
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntrada>('con rampa');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (editingPunto) {
      setNombre(editingPunto.nombre);
      setEdificio(editingPunto.edificio);
      setCalleAcceso(editingPunto.calle_acceso);
      setTipoEntrada(editingPunto.tipo_entrada);
      setLatitud(String(editingPunto.latitud));
      setLongitud(String(editingPunto.longitud));
    } else {
      setNombre('');
      setEdificio('');
      setCalleAcceso('');
      setTipoEntrada('con rampa');
      setLatitud('');
      setLongitud('');
    }
    setErrors({});
  }, [isOpen, editingPunto]);

  useEffect(() => {
    if (pickedCoords) {
      setLatitud(String(pickedCoords.latitud));
      setLongitud(String(pickedCoords.longitud));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.latitud;
        delete next.longitud;
        return next;
      });
    }
  }, [pickedCoords]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validatePuntoInput({
      nombre,
      edificio,
      calle_acceso: calleAcceso,
      tipo_entrada: tipoEntrada,
      latitud,
      longitud,
    });

    if (!result.valid || !result.normalized) {
      setErrors(result.errors as Record<string, string>);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      await onSubmit(result.normalized, editingPunto?.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar el punto.';
      setErrors({ general: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="punto-form-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="punto-form-title" className="text-base font-semibold text-slate-900">
            {editingPunto ? 'Editar punto de acceso' : 'Nuevo punto de acceso'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5" noValidate>
          {errors.general && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
              {errors.general}
            </div>
          )}

          <div>
            <label htmlFor="punto-nombre" className="block text-xs font-medium text-slate-700 mb-1.5">
              Nombre del punto
            </label>
            <input
              id="punto-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Acceso Principal · Pabellón Central"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
            {errors.nombre && <p className="mt-1 text-xs text-red-600">{errors.nombre}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="punto-edificio" className="block text-xs font-medium text-slate-700 mb-1.5">
                Edificio
              </label>
              <input
                id="punto-edificio"
                type="text"
                value={edificio}
                onChange={(e) => setEdificio(e.target.value)}
                placeholder="Ej. Biblioteca Nacional"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              />
              {errors.edificio && <p className="mt-1 text-xs text-red-600">{errors.edificio}</p>}
            </div>

            <div>
              <label htmlFor="punto-calle" className="block text-xs font-medium text-slate-700 mb-1.5">
                Calle de acceso
              </label>
              <input
                id="punto-calle"
                type="text"
                value={calleAcceso}
                onChange={(e) => setCalleAcceso(e.target.value)}
                placeholder="Ej. Agüero 2502"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              />
              {errors.calle_acceso && <p className="mt-1 text-xs text-red-600">{errors.calle_acceso}</p>}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">Tipo de entrada</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTipoEntrada('con rampa')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  tipoEntrada === 'con rampa'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Accessibility className="h-4 w-4" />
                Con rampa
              </button>
              <button
                type="button"
                onClick={() => setTipoEntrada('con escalones')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  tipoEntrada === 'con escalones'
                    ? 'border-amber-600 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Footprints className="h-4 w-4" />
                Con escalones
              </button>
            </div>
            {errors.tipo_entrada && <p className="mt-1 text-xs text-red-600">{errors.tipo_entrada}</p>}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-medium text-slate-700">
                Coordenadas (grados decimales)
              </span>
              <button
                type="button"
                onClick={onStartPickOnMap}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 whitespace-nowrap shrink-0"
              >
                <MapPin className="h-3.5 w-3.5" />
                Elegir en el mapa
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="punto-latitud" className="block text-xs text-slate-600 mb-1">
                  Latitud (-90 a 90)
                </label>
                <input
                  id="punto-latitud"
                  type="text"
                  inputMode="decimal"
                  value={latitud}
                  onChange={(e) => setLatitud(e.target.value)}
                  placeholder="-34.601078"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
                {errors.latitud && <p className="mt-1 text-xs text-red-600">{errors.latitud}</p>}
              </div>

              <div>
                <label htmlFor="punto-longitud" className="block text-xs text-slate-600 mb-1">
                  Longitud (-180 a 180)
                </label>
                <input
                  id="punto-longitud"
                  type="text"
                  inputMode="decimal"
                  value={longitud}
                  onChange={(e) => setLongitud(e.target.value)}
                  placeholder="-58.383078"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
                {errors.longitud && <p className="mt-1 text-xs text-red-600">{errors.longitud}</p>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Guardando...' : editingPunto ? 'Guardar cambios' : 'Guardar punto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
