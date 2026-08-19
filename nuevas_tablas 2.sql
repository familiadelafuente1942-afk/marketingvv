-- ═══════════════════════════════════════════════════════════════
-- V+V MARKETING · Centro de Operaciones — tablas nuevas (7 áreas)
-- Correr esto en Supabase → proyecto "v+vmarketing" → SQL Editor
-- Acceso restringido a: vvconstrucciones@yahoo.com.ar
-- ═══════════════════════════════════════════════════════════════

-- DISEÑO (personalización de cada marca — logo, colores) ────
create table if not exists config_marca (
  marca text primary key,
  color_acento text,
  color_fondo text,
  logo_data_uri text,
  actualizado timestamptz default now()
);
alter table config_marca enable row level security;
drop policy if exists "config_marca_lectura_publica" on config_marca;
create policy "config_marca_lectura_publica" on config_marca
  for select to anon
  using (true);
drop policy if exists "config_marca_solo_dueno_escribe" on config_marca;
create policy "config_marca_solo_dueno_escribe" on config_marca
  for all to authenticated
  using (auth.jwt()->>'email' = 'vvconstrucciones@yahoo.com.ar')
  with check (auth.jwt()->>'email' = 'vvconstrucciones@yahoo.com.ar');

-- PROSPECCIÓN DE SOCIOS (estudios de arquitectura / constructoras) ─
create table if not exists socios_prospectados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text default 'V+V Construcciones',
  categoria text default 'estudio de arquitectura',
  zona text,
  sitio_web text,
  telefono text,
  email text,
  fuente text,
  estado text default 'nuevo',
  creado timestamptz default now()
);
alter table socios_prospectados add column if not exists marca text default 'V+V Construcciones';

-- MARKETING ────────────────────────────────────────────────────
create table if not exists campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text default 'V+V Construcciones',
  canal text default 'instagram',
  estado text default 'planificada',
  presupuesto numeric default 0,
  gasto numeric default 0,
  leads_generados integer default 0,
  fecha_inicio date,
  fecha_fin date,
  creado timestamptz default now()
);
alter table campanas add column if not exists marca text default 'V+V Construcciones';

create table if not exists contenido (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text default 'post',
  canal text default 'instagram',
  estado text default 'idea',
  fecha_publicacion date,
  creado timestamptz default now()
);

create table if not exists competencia (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  notas text,
  ultima_revision date,
  creado timestamptz default now()
);

create table if not exists grupos_barrios (
  id uuid primary key default gen_random_uuid(),
  barrio text not null,
  tipo text default 'comercial/ventas',
  contacto text,
  estado text default 'por pedir acceso',
  ultima_publicacion date,
  creado timestamptz default now()
);

-- OPERACIONES ──────────────────────────────────────────────────
create table if not exists clientes_obra (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid references prospectos(id) on delete set null,
  nombre_obra text not null,
  etapa text default 'firma',
  fecha_firma date,
  creado timestamptz default now()
);

create table if not exists tickets_operaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  prioridad text default 'media',
  estado text default 'abierto',
  creado timestamptz default now()
);

-- SOPORTE ──────────────────────────────────────────────────────
create table if not exists tickets_soporte (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  asunto text,
  descripcion text,
  prioridad text default 'media',
  estado text default 'abierto',
  creado timestamptz default now()
);

create table if not exists faq (
  id uuid primary key default gen_random_uuid(),
  pregunta text not null,
  respuesta text,
  categoria text default 'general',
  creado timestamptz default now()
);

-- FINANZAS ─────────────────────────────────────────────────────
create table if not exists finanzas_ingresos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  monto numeric not null default 0,
  obra_relacionada text,
  fecha date default current_date,
  creado timestamptz default now()
);

create table if not exists finanzas_gastos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  monto numeric not null default 0,
  categoria text default 'marketing',
  fecha date default current_date,
  creado timestamptz default now()
);

-- PRODUCTO (mejoras a esta misma herramienta) ─────────────────
create table if not exists producto_pedidos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text default 'pedido',
  descripcion text,
  prioridad text default 'media',
  estado text default 'pendiente',
  creado timestamptz default now()
);

-- SEGURIDAD ────────────────────────────────────────────────────
create table if not exists seguridad_incidentes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  severidad text default 'baja',
  estado text default 'abierto',
  creado timestamptz default now()
);

create table if not exists seguridad_respaldos (
  id uuid primary key default gen_random_uuid(),
  fecha date default current_date,
  tipo text default 'manual',
  estado text default 'ok',
  notas text,
  creado timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════
-- Sumar la columna "marca" a todas las tablas que la necesitan
-- (acá abajo porque recién ahora todas las tablas ya existen)
-- ═══════════════════════════════════════════════════════════════
alter table grupos_barrios add column if not exists marca text default 'V+V Construcciones';
alter table contenido add column if not exists marca text default 'V+V Construcciones';
alter table competencia add column if not exists marca text default 'V+V Construcciones';
alter table finanzas_ingresos add column if not exists marca text default 'V+V Construcciones';
alter table finanzas_gastos add column if not exists marca text default 'V+V Construcciones';
alter table prospectos add column if not exists marca text default 'V+V Construcciones';

-- HISTORIAL DEL CHAT DEL ASISTENTE (persiste entre sesiones) ──
create table if not exists chat_mensajes (
  id uuid primary key default gen_random_uuid(),
  marca text default 'V+V Construcciones',
  role text not null,
  contenido text not null,
  creado timestamptz default now()
);

-- MAILS ENVIADOS (con seguimiento de apertura/click) ──────────
create table if not exists emails_enviados (
  id uuid primary key default gen_random_uuid(),
  marca text default 'V+V Construcciones',
  destinatario text not null,
  destinatario_nombre text,
  asunto text,
  cuerpo text,
  resend_id text,
  estado text default 'enviado',
  fecha_envio timestamptz default now(),
  fecha_apertura timestamptz,
  fecha_click timestamptz,
  creado timestamptz default now()
);

-- LANDING PÚBLICA: permitir que cualquiera (sin login) cree un
-- prospecto desde el formulario de contacto — pero NUNCA leer,
-- editar ni borrar. Eso sigue reservado solo a vvconstrucciones@yahoo.com.ar
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "publico_inserta_prospecto" on prospectos;
create policy "publico_inserta_prospecto" on prospectos
  for insert to anon
  with check (true);

-- ═══════════════════════════════════════════════════════════════
-- RESPUESTAS RECIBIDAS (detectadas automáticamente) ────────────
create table if not exists respuestas_recibidas (
  id uuid primary key default gen_random_uuid(),
  marca text default 'V+V Construcciones',
  remitente text,
  asunto text,
  cuerpo text,
  reenviado_ok boolean default false,
  creado timestamptz default now()
);

-- PROSPECCIÓN AUTOMÁTICA SEMANAL (estado de la rotación) ───────
create table if not exists prospeccion_automatica_estado (
  id int primary key default 1,
  indice_actual int default 0,
  ultima_corrida timestamptz,
  ultimo_resultado text
);
insert into prospeccion_automatica_estado (id, indice_actual) values (1, 0) on conflict (id) do nothing;

-- RLS: solo vvconstrucciones@yahoo.com.ar puede leer/escribir
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  t text;
  tablas text[] := array[
    'campanas','contenido','competencia','grupos_barrios','clientes_obra','socios_prospectados','chat_mensajes','emails_enviados','respuestas_recibidas','prospeccion_automatica_estado',
    'tickets_operaciones','tickets_soporte','faq',
    'finanzas_ingresos','finanzas_gastos','producto_pedidos',
    'seguridad_incidentes','seguridad_respaldos'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (auth.jwt()->>''email'' = ''vvconstrucciones@yahoo.com.ar'') with check (auth.jwt()->>''email'' = ''vvconstrucciones@yahoo.com.ar'')',
      t || '_solo_dueno', t
    );
  end loop;
end $$;
