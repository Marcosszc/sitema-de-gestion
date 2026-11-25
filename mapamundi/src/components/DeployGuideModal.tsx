import { useEffect, useState } from 'react';
import { Check, Copy, Database, GitBranch, Server, X } from 'lucide-react';
import type { HealthStatus } from '../types.ts';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: HealthStatus | null;
}

export function DeployGuideModal({ isOpen, onClose, health }: DeployGuideModalProps) {
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || schemaSql) {
      return;
    }
    fetch('/api/schema')
      .then((res) => res.text())
      .then((text) => setSchemaSql(text))
      .catch(() => setSchemaSql('-- Revisá el archivo supabase/schema.sql en el repositorio'));
  }, [isOpen, schemaSql]);

  if (!isOpen) {
    return null;
  }

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(schemaSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in some iframes
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deploy-guide-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="deploy-guide-title" className="text-base font-semibold text-slate-900">
            Conexión con Supabase, GitHub y Render
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5 text-sm text-slate-700">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">Estado actual del backend: </span>
            {health?.backend === 'supabase' && health.ok
              ? 'Conectado directamente a Supabase (tabla puntos_acceso).'
              : health?.supabaseConfigured
                ? `Supabase configurado con aviso: ${health.error || 'verificá que ejecutaste el SQL en Supabase.'}`
                : 'Modo local pre-cargado activo. Configurá SUPABASE_URL y SUPABASE_KEY en Render o en Secrets para persistir en tu proyecto Supabase.'}
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Database className="h-4 w-4 text-blue-700" />
                1. Crear la tabla en Supabase (SQL Editor)
              </h3>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar SQL'}
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Ejecutá <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800">supabase/schema.sql</code> en el
              SQL Editor de tu proyecto Supabase para crear la tabla <code className="rounded bg-slate-100 px-1 py-0.5">puntos_acceso</code>{' '}
              con ID único UUID, validación de coordenadas (-90..90 y -180..180) y los 3 ejemplos iniciales.
            </p>
            <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {schemaSql || 'Cargando esquema SQL...'}
            </pre>
          </section>

          <section className="space-y-1.5 border-t border-slate-200 pt-4">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <GitBranch className="h-4 w-4 text-blue-700" />
              2. Subir el código a GitHub
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Subí el repositorio a GitHub incluyendo <code className="rounded bg-slate-100 px-1 py-0.5">server.ts</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">render.yaml</code> y{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">supabase/schema.sql</code>. No subas archivos{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">.env</code> con credenciales reales.
            </p>
          </section>

          <section className="space-y-2 border-t border-slate-200 pt-4">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Server className="h-4 w-4 text-blue-700" />
              3. Desplegar el servicio web en Render
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Creá un <strong>Web Service</strong> (o Blueprint con <code className="rounded bg-slate-100 px-1 py-0.5">render.yaml</code>) conectado a tu repositorio:
            </p>
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
              <div>Build Command: npm install &amp;&amp; npm run build</div>
              <div>Start Command: npm start</div>
              <div>Variables: NODE_ENV=production · SUPABASE_URL · SUPABASE_KEY</div>
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
