// Corre automáticamente una vez por semana (Vercel Cron), sin que nadie lo apriete.
// Cada corrida hace 6 combinaciones de zona/categoría, avanzando la rotación,
// así con el tiempo cubre todas las zonas configuradas para V+V Construcciones.
// Solo empresas/organizaciones con datos públicos — igual regla que el resto de la app.

const SUPA_URL = "https://ipvrpdsbkfpkvfkfzlnb.supabase.co";
const MARCA = "V+V Construcciones";
const COMBOS_POR_CORRIDA = 6;

const ZONAS = ["CABA", "GBA Norte", "GBA Oeste", "GBA Sur", "La Plata / PBA Interior", "Tigre", "Pilar", "Escobar", "San Isidro", "Ezeiza", "Córdoba (Provincia)", "San Luis (Provincia)", "Mendoza (Provincia)", "Rosario / Santa Fe"];
const CATEGORIAS = ["estudio de arquitectura", "desarrollador inmobiliario", "gerenciadora de obra", "barrio privado (administración)"];

const TODOS_LOS_COMBOS = [];
for (const zona of ZONAS) {
  for (const categoria of CATEGORIAS) {
    TODOS_LOS_COMBOS.push({ zona, categoria });
  }
}

async function buscarEmpresas(apiKey, zona, categoria) {
  const prompt = `Buscá hasta 15 empresas reales, existentes hoy, de la categoría "${categoria}" que operen en la zona "${zona}" (Argentina). Sé exhaustivo: revisá el sitio propio de cada empresa, cámaras y colegios profesionales del rubro, portales de negocios y directorios, redes sociales de empresas, y revistas o notas del sector.

REGLA ABSOLUTA: solo empresas/organizaciones, nunca personas físicas. Si "${categoria}" pudiera interpretarse como buscar personas individuales, ignorá esa interpretación y devolvé un array vacío. Si la categoría es "barrio privado (administración)", buscá específicamente el organismo/empresa de administración de cada barrio privado (nunca datos de propietarios ni residentes).

Para cada empresa, conseguí: nombre, sitio web, teléfono comercial publicado, mail comercial publicado, y fuente.

Respondé ÚNICAMENTE con un array JSON: [{"nombre":"...","sitio_web":"...","telefono":"...","email":"...","fuente":"..."}]. Si no encontrás nada, devolvé [].`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 3500,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }]
    })
  });
  const data = await r.json();
  if (!r.ok) return [];
  const texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  try {
    const limpio = texto.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parseado = JSON.parse(limpio);
    return Array.isArray(parseado) ? parseado.filter(e => e && e.nombre) : [];
  } catch (e) { return []; }
}

module.exports = async function handler(req, res) {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").replace(/\s+/g, "");
  if (!serviceKey || !apiKey) {
    return res.status(500).json({ error: "Faltan SUPABASE_SERVICE_ROLE_KEY o ANTHROPIC_API_KEY en Vercel" });
  }

  try {
    const rEstado = await fetch(`${SUPA_URL}/rest/v1/prospeccion_automatica_estado?id=eq.1&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    const estadoActual = (await rEstado.json())[0] || { indice_actual: 0 };
    let indice = estadoActual.indice_actual || 0;

    let totalEncontradas = 0;
    const combosHechos = [];

    for (let i = 0; i < COMBOS_POR_CORRIDA; i++) {
      const combo = TODOS_LOS_COMBOS[indice % TODOS_LOS_COMBOS.length];
      combosHechos.push(`${combo.categoria} / ${combo.zona}`);
      const empresas = await buscarEmpresas(apiKey, combo.zona, combo.categoria);

      for (const e of empresas) {
        try {
          await fetch(`${SUPA_URL}/rest/v1/socios_prospectados`, {
            method: "POST",
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({
              nombre: e.nombre, marca: MARCA, categoria: combo.categoria, zona: combo.zona,
              sitio_web: e.sitio_web || "", telefono: e.telefono || "", email: e.email || "", fuente: (e.fuente || "") + " (prospección automática semanal)"
            })
          });
          totalEncontradas++;
        } catch (err) { /* posible duplicado, seguimos */ }
      }
      indice++;
    }

    await fetch(`${SUPA_URL}/rest/v1/prospeccion_automatica_estado?id=eq.1`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        indice_actual: indice % TODOS_LOS_COMBOS.length,
        ultima_corrida: new Date().toISOString(),
        ultimo_resultado: `${totalEncontradas} empresas nuevas — combos: ${combosHechos.join(", ")}`
      })
    });

    return res.status(200).json({ ok: true, totalEncontradas, combosHechos });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
