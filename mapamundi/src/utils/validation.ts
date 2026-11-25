import type { PuntoAcceso, PuntoAccesoInput, TipoEntrada, ValidationResult } from '../types.ts';

export const TIPOS_ENTRADA: readonly TipoEntrada[] = ['con rampa', 'con escalones'];

export function isValidTipoEntrada(value: unknown): value is TipoEntrada {
  return value === 'con rampa' || value === 'con escalones';
}

export function validateDecimalLatitude(value: unknown): { ok: boolean; num?: number; error?: string } {
  if (value === '' || value === null || value === undefined) {
    return { ok: false, error: 'La latitud es obligatoria en grados decimales.' };
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(num)) {
    return { ok: false, error: 'La latitud debe ser un número decimal válido.' };
  }
  if (num < -90 || num > 90) {
    return { ok: false, error: 'La latitud debe estar entre -90 y 90 grados decimales.' };
  }
  return { ok: true, num: Number(num.toFixed(6)) };
}

export function validateDecimalLongitude(value: unknown): { ok: boolean; num?: number; error?: string } {
  if (value === '' || value === null || value === undefined) {
    return { ok: false, error: 'La longitud es obligatoria en grados decimales.' };
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(num)) {
    return { ok: false, error: 'La longitud debe ser un número decimal válido.' };
  }
  if (num < -180 || num > 180) {
    return { ok: false, error: 'La longitud debe estar entre -180 y 180 grados decimales.' };
  }
  return { ok: true, num: Number(num.toFixed(6)) };
}

export function validatePuntoInput(raw: Record<string, unknown>): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  const nombre = typeof raw.nombre === 'string' ? raw.nombre.trim() : '';
  const edificio = typeof raw.edificio === 'string' ? raw.edificio.trim() : '';
  const calle_acceso = typeof raw.calle_acceso === 'string' ? raw.calle_acceso.trim() : '';
  const tipo_entrada = raw.tipo_entrada;

  if (!nombre) {
    errors.nombre = 'Ingresá el nombre del punto de acceso.';
  } else if (nombre.length > 140) {
    errors.nombre = 'El nombre no puede superar los 140 caracteres.';
  }

  if (!edificio) {
    errors.edificio = 'Ingresá el nombre del edificio.';
  } else if (edificio.length > 140) {
    errors.edificio = 'El edificio no puede superar los 140 caracteres.';
  }

  if (!calle_acceso) {
    errors.calle_acceso = 'Ingresá la calle de acceso.';
  } else if (calle_acceso.length > 160) {
    errors.calle_acceso = 'La calle de acceso no puede superar los 160 caracteres.';
  }

  if (!isValidTipoEntrada(tipo_entrada)) {
    errors.tipo_entrada = 'Seleccioná "con rampa" o "con escalones".';
  }

  const latCheck = validateDecimalLatitude(raw.latitud);
  if (!latCheck.ok) {
    errors.latitud = latCheck.error;
  }

  const lngCheck = validateDecimalLongitude(raw.longitud);
  if (!lngCheck.ok) {
    errors.longitud = lngCheck.error;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    normalized: {
      nombre,
      edificio,
      calle_acceso,
      tipo_entrada: tipo_entrada as TipoEntrada,
      latitud: latCheck.num!,
      longitud: lngCheck.num!,
    },
  };
}

export function buildGoogleMapsSearchUrl(latitud: number, longitud: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitud},${longitud}`)}`;
}

export function buildGoogleMapsDirectionsUrl(latitud: number, longitud: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitud},${longitud}`)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateGoogleMyMapsKml(puntos: PuntoAcceso[]): string {
  const placemarks = puntos
    .map((p) => {
      const desc = `Edificio: ${p.edificio}\nCalle de acceso: ${p.calle_acceso}\nTipo de entrada: ${p.tipo_entrada}\nCoordenadas: ${p.latitud}, ${p.longitud}`;
      return `    <Placemark>
      <name>${escapeXml(p.nombre)}</name>
      <description>${escapeXml(desc)}</description>
      <ExtendedData>
        <Data name="edificio"><value>${escapeXml(p.edificio)}</value></Data>
        <Data name="calle_acceso"><value>${escapeXml(p.calle_acceso)}</value></Data>
        <Data name="tipo_entrada"><value>${escapeXml(p.tipo_entrada)}</value></Data>
      </ExtendedData>
      <Point>
        <coordinates>${p.longitud},${p.latitud},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Puntos de Acceso Urbano</name>
    <description>Ubicaciones exportadas desde AccesoUrbano para importar en Google My Maps</description>
${placemarks}
  </Document>
</kml>`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateGoogleMapsCsv(puntos: PuntoAcceso[]): string {
  const headers = [
    'ID',
    'Nombre del punto',
    'Edificio',
    'Calle de acceso',
    'Tipo de entrada',
    'Latitud',
    'Longitud',
    'Enlace Google Maps',
  ];
  const rows = puntos.map((p) =>
    [
      p.id,
      p.nombre,
      p.edificio,
      p.calle_acceso,
      p.tipo_entrada,
      p.latitud,
      p.longitud,
      buildGoogleMapsSearchUrl(p.latitud, p.longitud),
    ]
      .map(escapeCsvCell)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\r\n');
}
