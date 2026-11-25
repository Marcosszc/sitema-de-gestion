export type TipoEntrada = 'con rampa' | 'con escalones';

export interface PuntoAcceso {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  edificio: string;
  calle_acceso: string;
  tipo_entrada: TipoEntrada;
  created_at: string;
  updated_at?: string;
}

export interface PuntoAccesoInput {
  nombre: string;
  latitud: number;
  longitud: number;
  edificio: string;
  calle_acceso: string;
  tipo_entrada: TipoEntrada;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof PuntoAccesoInput | 'general', string>>;
  normalized?: PuntoAccesoInput;
}

export interface HealthStatus {
  ok: boolean;
  backend: 'supabase' | 'local';
  supabaseConfigured: boolean;
  error?: string;
}
