// Busca empresas reales (estudios de arquitectura / constructoras) por zona y categoría,
// usando SOLO información pública que esas empresas publican (sitio propio, cámaras del
// rubro, portales, revistas). Nunca busca datos de personas.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { zona, categoria } = req.body || {};
  if (!zona || !categoria) {
    return res.status(400).json({ error: "Falta zona o categoría" });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || "").replace(/\s+/g, "");
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar ANTHROPIC_API_KEY en las variables de entorno de Vercel."
    });
  }
  if (!apiKey.startsWith("sk-ant-")) {
    return res.status(500).json({
      error: "La clave ANTHROPIC_API_KEY no tiene el formato esperado (debería empezar con 'sk-ant-'). Revisala en Vercel → Settings → Environment Variables."
    });
  }

  const prompt = `Buscá hasta 15 empresas reales, existentes hoy, de la categoría "${categoria}" que operen en la zona "${zona}" (Argentina). Sé exhaustivo: revisá el sitio propio de cada empresa, cámaras y colegios profesionales del rubro, portales de negocios y directorios, redes sociales de empresas, y revistas o notas del sector. Cuantas más fuentes distintas revises, mejor.

REGLA ABSOLUTA: solo empresas/organizaciones, nunca personas físicas. Si "${categoria}" pudiera interpretarse como buscar personas individuales en vez de empresas, ignorá esa interpretación y devolvé un array vacío.

Para cada empresa, conseguí: nombre de la empresa, sitio web (si tiene), teléfono de contacto comercial publicado, mail de contacto comercial publicado (si lo hay), y de qué fuente lo sacaste (sitio propio / cámara del rubro / colegio profesional / portal / revista / red social de la empresa).

Respondé ÚNICAMENTE con un array JSON, sin texto antes ni después, sin backticks de markdown, con este formato exacto:
[{"nombre":"...","sitio_web":"...","telefono":"...","email":"...","fuente":"..."}]

Si no encontrás algún dato para una empresa, dejá ese campo como cadena vacía "". Si no encontrás ninguna empresa real, respondé con un array vacío [].`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 3500,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Error de la API de Anthropic" });
    }

    const texto = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim();

    let empresas = [];
    try {
      const limpio = texto.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      empresas = JSON.parse(limpio);
      if (!Array.isArray(empresas)) empresas = [];
    } catch (e) {
      empresas = [];
    }

    return res.status(200).json({ empresas });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};

