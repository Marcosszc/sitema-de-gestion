# AccesoUrbano — Servicio Web de Puntos de Acceso (Supabase + Render + GitHub + OpenStreetMap)

Aplicación web full-stack para gestionar puntos de acceso urbanos en **Supabase**, visualizarlos en **OpenStreetMap (Leaflet)** con validación estricta en grados decimales, filtrar por tipo de entrada (`con rampa` / `con escalones`) y abrir o exportar ubicaciones hacia **Google Maps**.

## Estructura del proyecto

- `server.ts`: Servidor Express con API REST (`/api/puntos`, `/api/health`) conectado a Supabase y servicio estático de la SPA en producción.
- `supabase/schema.sql`: Script SQL para crear la tabla `puntos_acceso` con ID UUID único, restricciones de coordenadas (`latitud` `-90..90`, `longitud` `-180..180`) y 3 ejemplos iniciales.
- `render.yaml`: Configuración lista para desplegar el servicio web en Render desde GitHub.
- `src/`: Frontend en React + TypeScript + Tailwind CSS + Leaflet (OpenStreetMap).

## Pasos para conectar GitHub, Supabase y Render

### 1. Base de datos en Supabase
1. Creá un proyecto nuevo en [Supabase](https://supabase.com).
2. Abrí **SQL Editor -> New query**, pegá el contenido de `supabase/schema.sql` y ejecutalo.
3. En **Project Settings -> API**, copiá:
   - `Project URL` (`SUPABASE_URL`)
   - `service_role` secret key o `anon` public key (`SUPABASE_KEY`)

### 2. Repositorio en GitHub
1. Subí este proyecto a un repositorio en GitHub (`git init`, `git add .`, `git commit -m "Initial commit"`, `git push`).
2. Nunca subas archivos `.env` con claves reales (solo `.env.example`).

### 3. Despliegue en Render
1. En [Render](https://render.com), seleccioná **New -> Blueprint** (o **New -> Web Service**) y conectá tu repositorio de GitHub.
2. Si usás Blueprint, Render detectará `render.yaml` automáticamente. Si lo configurás manual:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Agregá las variables de entorno en Render (**Environment**):
   - `NODE_ENV` = `production`
   - `SUPABASE_URL` = tu URL de Supabase
   - `SUPABASE_KEY` = tu clave de Supabase
4. Desplegá y verificá `/api/health`.
