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
alter table socios_prospectados add column if not exists instagram text;
alter table socios_prospectados add column if not exists facebook text;
alter table socios_prospectados add column if not exists tiktok text;
alter table socios_prospectados add column if not exists x text;

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

-- ETAPA 2 — Sistema de leads completo (campos que faltaban) ────
alter table prospectos add column if not exists utm_source text;
alter table prospectos add column if not exists utm_medium text;
alter table prospectos add column if not exists utm_campaign text;
alter table prospectos add column if not exists pagina_origen text;
alter table prospectos add column if not exists prioridad text default 'media';
alter table prospectos add column if not exists proxima_accion text;
alter table prospectos add column if not exists fecha_proxima_accion date;
alter table prospectos add column if not exists observaciones text;
alter table prospectos add column if not exists consentimiento boolean default false;
alter table prospectos add column if not exists responsable text;
alter table prospectos add column if not exists mensaje text;
alter table prospectos add column if not exists campana text;
alter table prospectos add column if not exists updated_at timestamptz default now();

-- Historial de cambios de cada lead (auditoría) ─────────────────
create table if not exists prospectos_historial (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid references prospectos(id) on delete cascade,
  usuario text,
  campo text,
  valor_anterior text,
  valor_nuevo text,
  creado timestamptz default now()
);

alter table faq add column if not exists marca text default 'V+V Construcciones';
drop policy if exists "faq_lectura_publica" on faq;
create policy "faq_lectura_publica" on faq
  for select to anon
  using (true);

alter table contenido add column if not exists caption text;
alter table contenido add column if not exists hashtags text;
alter table contenido add column if not exists red_social text default 'instagram';

-- AGENTE DE WHATSAPP — conversaciones autónomas hasta que tomes el control ─
create table if not exists whatsapp_conversaciones (
  id uuid primary key default gen_random_uuid(),
  telefono text not null unique,
  nombre text,
  marca text default 'V+V Construcciones',
  estado text default 'agente' check (estado in ('agente','humano','necesita_humano','cerrado')),
  prospecto_id uuid references prospectos(id) on delete set null,
  ultima_actividad timestamptz default now(),
  creado timestamptz default now()
);

create table if not exists whatsapp_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid references whatsapp_conversaciones(id) on delete cascade,
  direccion text not null check (direccion in ('entrante','saliente')),
  remitente text default 'contacto' check (remitente in ('contacto','agente','humano')),
  texto text,
  creado timestamptz default now()
);

-- AGENTE DIARIO — resumen de la última corrida ────────────────
create table if not exists agente_digest_diario (
  id int primary key default 1,
  fecha timestamptz,
  resumen text,
  urgentes int default 0
);
insert into agente_digest_diario (id) values (1) on conflict (id) do nothing;

-- Etapa "motor de marketing" — difusión WhatsApp a la base ya cargada ─
create table if not exists whatsapp_enviados (
  id uuid primary key default gen_random_uuid(),
  marca text default 'V+V Construcciones',
  destinatario_nombre text,
  destinatario_telefono text not null,
  mensaje text,
  creado timestamptz default now()
);

-- ETAPA 3 — Roles de usuario ─────────────────────────────────
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  nombre text,
  rol text default 'solo lectura' check (rol in ('administrador','comercial','marketing','solo lectura')),
  activo boolean default true,
  creado timestamptz default now()
);
insert into usuarios (email, nombre, rol) values ('vvconstrucciones@yahoo.com.ar', 'Sebastián', 'administrador')
  on conflict (email) do update set rol = 'administrador';
alter table usuarios enable row level security;
drop policy if exists "usuarios_solo_dueno" on usuarios;
create policy "usuarios_solo_dueno" on usuarios for all
  using (auth.jwt()->>'email' = 'vvconstrucciones@yahoo.com.ar')
  with check (auth.jwt()->>'email' = 'vvconstrucciones@yahoo.com.ar');
drop policy if exists "usuarios_lee_propio" on usuarios;
create policy "usuarios_lee_propio" on usuarios for select
  using (auth.jwt()->>'email' = email);

-- Preguntas frecuentes precargadas (respuestas en blanco — completar en el panel) ─
create unique index if not exists faq_pregunta_marca_idx on faq(pregunta, marca);
insert into faq (pregunta, respuesta, categoria, marca) values
  ('¿En qué zonas trabajan?', '', 'general', 'V+V Construcciones'),
  ('¿Realizan obras llave en mano?', '', 'proceso', 'V+V Construcciones'),
  ('¿Cómo se calcula el presupuesto?', '', 'precios', 'V+V Construcciones'),
  ('¿Qué incluye el seguimiento?', '', 'proceso', 'V+V Construcciones'),
  ('¿Trabajan en barrios privados?', '', 'general', 'V+V Construcciones'),
  ('¿Realizan proyectos industriales?', '', 'general', 'V+V Construcciones'),
  ('¿Cómo se gestionan los adicionales?', '', 'proceso', 'V+V Construcciones'),
  ('¿Qué garantía tiene la obra?', '', 'garantías', 'V+V Construcciones'),
  ('¿Cuánto puede tardar una construcción?', '', 'proceso', 'V+V Construcciones'),
  ('¿Hacen envíos?', '', 'general', 'VIP Deco & Home'),
  ('¿Los productos son artesanales?', '', 'general', 'VIP Deco & Home'),
  ('¿Realizan productos personalizados?', '', 'general', 'VIP Deco & Home'),
  ('¿Hay venta mayorista?', '', 'precios', 'VIP Deco & Home'),
  ('¿Cuáles son los tiempos de producción?', '', 'proceso', 'VIP Deco & Home'),
  ('¿Cómo se cuidan las piezas?', '', 'general', 'VIP Deco & Home'),
  ('¿Los precios incluyen IVA?', '', 'precios', 'VIP Deco & Home')
on conflict (pregunta, marca) do nothing;

-- LANDING PÚBLICA: permitir que cualquiera (sin login) cree un
-- prospecto desde el formulario de contacto — pero NUNCA leer,
-- editar ni borrar. Eso sigue reservado solo a vvconstrucciones@yahoo.com.ar
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "publico_inserta_prospecto" on prospectos;
create policy "publico_inserta_prospecto" on prospectos
  for insert to anon
  with check (
    marca in ('V+V Construcciones', 'VIP Deco & Home')
    and (estado is null or estado = 'nuevo')
    and coalesce(nombre_contacto, '') <> ''
    and (coalesce(email, '') <> '' or coalesce(telefono, '') <> '')
  );

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
    'campanas','contenido','competencia','grupos_barrios','clientes_obra','socios_prospectados','chat_mensajes','emails_enviados','respuestas_recibidas','prospeccion_automatica_estado','prospectos_historial','whatsapp_enviados','agente_digest_diario','whatsapp_conversaciones','whatsapp_mensajes',
    'tickets_operaciones','tickets_soporte','faq',
    'finanzas_ingresos','finanzas_gastos','producto_pedidos',
    'seguridad_incidentes','seguridad_respaldos'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_solo_dueno', t);
    execute format(
      'create policy %I on %I for all using (auth.jwt()->>''email'' = ''vvconstrucciones@yahoo.com.ar'') with check (auth.jwt()->>''email'' = ''vvconstrucciones@yahoo.com.ar'')',
      t || '_solo_dueno', t
    );
  end loop;
end $$;
