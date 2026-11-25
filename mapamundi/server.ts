import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PuntoAcceso, PuntoAccesoInput } from './src/types.ts';
import { isValidTipoEntrada, validatePuntoInput } from './src/utils/validation.ts';

const PORT = Number(process.env.PORT) || 3000;
const TABLE_NAME = 'puntos_acceso';

const SEED_PUNTOS: readonly PuntoAccesoInput[] = [
  {
    nombre: 'Acceso Principal · Facultad de Ingeniería',
    latitud: -34.617638,
    longitud: -58.368295,
    edificio: 'Facultad de Ingeniería — UBA (Sede Paseo Colón)',
    calle_acceso: 'Av. Paseo Colón 850',
    tipo_entrada: 'con rampa',
  },
  {
    nombre: 'Entrada Lateral · Biblioteca Nacional',
    latitud: -34.584412,
    longitud: -58.398156,
    edificio: 'Biblioteca Nacional Mariano Moreno',
    calle_acceso: 'Agüero 2502',
    tipo_entrada: 'con rampa',
  },
  {
    nombre: 'Pórtico Histórico · Teatro Colón',
    latitud: -34.601078,
    longitud: -58.383078,
    edificio: 'Teatro Colón',
    calle_acceso: 'Libertad 621',
    tipo_entrada: 'con escalones',
  },
];

const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  '';

const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_STORE_PATH = path.resolve(DATA_DIR, 'puntos.json');

function ensureLocalStore(): PuntoAcceso[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    const now = new Date().toISOString();
    const initial: PuntoAcceso[] = SEED_PUNTOS.map((item, idx) => ({
      id: crypto.randomUUID(),
      ...item,
      created_at: new Date(Date.now() - (SEED_PUNTOS.length - idx) * 60_000).toISOString(),
      updated_at: now,
    }));
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PuntoAcceso[]) : [];
  } catch {
    return [];
  }
}

function saveLocalStore(items: PuntoAcceso[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(items, null, 2), 'utf8');
}

function isValidId(id: string): boolean {
  return /^[0-9a-zA-Z_-]{6,64}$/.test(id);
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req: Request, res: Response) => {
    if (!supabase) {
      res.json({ ok: true, backend: 'local', supabaseConfigured: false });
      return;
    }
    const { error } = await supabase.from(TABLE_NAME).select('id').limit(1);
    if (error) {
      res.status(200).json({
        ok: false,
        backend: 'supabase',
        supabaseConfigured: true,
        error: error.message,
      });
      return;
    }
    res.json({ ok: true, backend: 'supabase', supabaseConfigured: true });
  });

  app.get('/api/schema', (_req: Request, res: Response) => {
    const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      res.type('text/plain').send(fs.readFileSync(schemaPath, 'utf8'));
      return;
    }
    res.status(404).send('-- schema.sql no encontrado');
  });

  app.get('/api/puntos', async (req: Request, res: Response) => {
    const tipoParam = typeof req.query.tipo_entrada === 'string' ? req.query.tipo_entrada.trim() : '';
    const qParam = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    if (tipoParam && !isValidTipoEntrada(tipoParam)) {
      res.status(400).json({ error: 'Filtro tipo_entrada inválido.' });
      return;
    }

    try {
      let items: PuntoAcceso[] = [];
      if (supabase) {
        let query = supabase
          .from(TABLE_NAME)
          .select('id, nombre, latitud, longitud, edificio, calle_acceso, tipo_entrada, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (tipoParam) {
          query = query.eq('tipo_entrada', tipoParam);
        }

        const { data, error } = await query;
        if (error) {
          res.status(502).json({ error: `Error al consultar Supabase: ${error.message}` });
          return;
        }
        items = (data ?? []) as PuntoAcceso[];
      } else {
        items = ensureLocalStore()
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (tipoParam) {
          items = items.filter((item) => item.tipo_entrada === tipoParam);
        }
      }

      if (qParam) {
        items = items.filter(
          (item) =>
            item.nombre.toLowerCase().includes(qParam) ||
            item.edificio.toLowerCase().includes(qParam) ||
            item.calle_acceso.toLowerCase().includes(qParam),
        );
      }

      res.json({ puntos: items, backend: supabase ? 'supabase' : 'local' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error interno del servidor';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/puntos', async (req: Request, res: Response) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const validation = validatePuntoInput(body);
    if (!validation.valid || !validation.normalized) {
      res.status(400).json({ error: 'Datos inválidos', details: validation.errors });
      return;
    }

    const input = validation.normalized;

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .insert([input])
          .select('id, nombre, latitud, longitud, edificio, calle_acceso, tipo_entrada, created_at, updated_at')
          .single();

        if (error) {
          res.status(502).json({ error: `No se pudo guardar en Supabase: ${error.message}` });
          return;
        }
        res.status(201).json({ punto: data });
        return;
      }

      const items = ensureLocalStore();
      const now = new Date().toISOString();
      const created: PuntoAcceso = {
        id: crypto.randomUUID(),
        ...input,
        created_at: now,
        updated_at: now,
      };
      items.unshift(created);
      saveLocalStore(items);
      res.status(201).json({ punto: created });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error interno del servidor';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/puntos/seed', async (_req: Request, res: Response) => {
    try {
      if (supabase) {
        const { data: existing, error: checkError } = await supabase
          .from(TABLE_NAME)
          .select('id')
          .limit(1);
        if (checkError) {
          res.status(502).json({ error: `Error al verificar Supabase: ${checkError.message}` });
          return;
        }
        if (existing && existing.length > 0) {
          res.status(200).json({ seeded: false, message: 'La tabla ya contiene registros.' });
          return;
        }
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .insert(SEED_PUNTOS as unknown as PuntoAccesoInput[])
          .select('id, nombre, latitud, longitud, edificio, calle_acceso, tipo_entrada, created_at, updated_at');
        if (error) {
          res.status(502).json({ error: `Error al insertar ejemplos en Supabase: ${error.message}` });
          return;
        }
        res.status(201).json({ seeded: true, puntos: data });
        return;
      }

      const items = ensureLocalStore();
      if (items.length > 0) {
        res.status(200).json({ seeded: false, message: 'Ya existen registros cargados.' });
        return;
      }
      const now = new Date().toISOString();
      const seeded: PuntoAcceso[] = SEED_PUNTOS.map((item, idx) => ({
        id: crypto.randomUUID(),
        ...item,
        created_at: new Date(Date.now() - (SEED_PUNTOS.length - idx) * 60_000).toISOString(),
        updated_at: now,
      }));
      saveLocalStore(seeded);
      res.status(201).json({ seeded: true, puntos: seeded });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error interno del servidor';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/puntos/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID de punto inválido.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const validation = validatePuntoInput(body);
    if (!validation.valid || !validation.normalized) {
      res.status(400).json({ error: 'Datos inválidos', details: validation.errors });
      return;
    }

    const input = validation.normalized;

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .update(input)
          .eq('id', id)
          .select('id, nombre, latitud, longitud, edificio, calle_acceso, tipo_entrada, created_at, updated_at')
          .maybeSingle();

        if (error) {
          res.status(502).json({ error: `No se pudo actualizar en Supabase: ${error.message}` });
          return;
        }
        if (!data) {
          res.status(404).json({ error: 'Punto de acceso no encontrado.' });
          return;
        }
        res.json({ punto: data });
        return;
      }

      const items = ensureLocalStore();
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Punto de acceso no encontrado.' });
        return;
      }
      const updated: PuntoAcceso = {
        ...items[idx],
        ...input,
        updated_at: new Date().toISOString(),
      };
      items[idx] = updated;
      saveLocalStore(items);
      res.json({ punto: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error interno del servidor';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/puntos/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID de punto inválido.' });
      return;
    }

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .delete()
          .eq('id', id)
          .select('id')
          .maybeSingle();

        if (error) {
          res.status(502).json({ error: `No se pudo eliminar en Supabase: ${error.message}` });
          return;
        }
        if (!data) {
          res.status(404).json({ error: 'Punto de acceso no encontrado.' });
          return;
        }
        res.json({ deleted: true, id });
        return;
      }

      const items = ensureLocalStore();
      const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) {
        res.status(404).json({ error: 'Punto de acceso no encontrado.' });
        return;
      }
      saveLocalStore(next);
      res.json({ deleted: true, id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error interno del servidor';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `AccesoUrbano server running on http://0.0.0.0:${PORT} (storage: ${supabase ? 'supabase' : 'local-seeded'})`,
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
