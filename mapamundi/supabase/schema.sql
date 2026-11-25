-- ============================================================================
-- Esquema de base de datos en Supabase para AccesoUrbano
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.puntos_acceso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) > 0),
  latitud double precision not null check (latitud >= -90 and latitud <= 90),
  longitud double precision not null check (longitud >= -180 and longitud <= 180),
  edificio text not null check (char_length(trim(edificio)) > 0),
  calle_acceso text not null check (char_length(trim(calle_acceso)) > 0),
  tipo_entrada text not null check (tipo_entrada in ('con rampa', 'con escalones')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_puntos_acceso_tipo_entrada
  on public.puntos_acceso (tipo_entrada);

create or replace function public.set_puntos_acceso_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_puntos_acceso_updated_at on public.puntos_acceso;
create trigger trg_puntos_acceso_updated_at
  before update on public.puntos_acceso
  for each row
  execute function public.set_puntos_acceso_updated_at();

-- Habilitar Row Level Security (el servidor Express usa SUPABASE_KEY desde el backend)
alter table public.puntos_acceso enable row level security;

drop policy if exists "Permitir lectura publica de puntos" on public.puntos_acceso;
create policy "Permitir lectura publica de puntos"
  on public.puntos_acceso
  for select
  using (true);

drop policy if exists "Permitir escritura desde servicio web" on public.puntos_acceso;
create policy "Permitir escritura desde servicio web"
  on public.puntos_acceso
  for all
  using (true)
  with check (true);

-- Tres ejemplos iniciales en ubicaciones distintas (solo se insertan si la tabla esta vacia)
insert into public.puntos_acceso (nombre, latitud, longitud, edificio, calle_acceso, tipo_entrada)
select * from (
  values
    (
      'Acceso Principal · Facultad de Ingeniería',
      -34.617638::double precision,
      -58.368295::double precision,
      'Facultad de Ingeniería — UBA (Sede Paseo Colón)',
      'Av. Paseo Colón 850',
      'con rampa'
    ),
    (
      'Entrada Lateral · Biblioteca Nacional',
      -34.584412::double precision,
      -58.398156::double precision,
      'Biblioteca Nacional Mariano Moreno',
      'Agüero 2502',
      'con rampa'
    ),
    (
      'Pórtico Histórico · Teatro Colón',
      -34.601078::double precision,
      -58.383078::double precision,
      'Teatro Colón',
      'Libertad 621',
      'con escalones'
    )
) as seed(nombre, latitud, longitud, edificio, calle_acceso, tipo_entrada)
where not exists (select 1 from public.puntos_acceso);
