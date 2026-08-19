// Busca el mail de contacto PUBLICADO en el sitio web de una empresa (nunca datos de personas).
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nombre, sitio_web } = req.body || {};
  if (!nombre || !sitio_web) {
    return res.status(400).json({ error: "Falta nombre o sitio_web" });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || "").replace(/\s+/g, "");
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel." });
  }
  if (!apiKey.startsWith("sk-ant-")) {
    return res.status(500).json({ error: "La clave ANTHROPIC_API_KEY no tiene el formato esperado." });
  }

  const prompt = `Entrá al sitio web "${sitio_web}" de la empresa "${nombre}" (revisá también su página de "Contacto" si la tiene) y buscá el mail de contacto comercial que hayan publicado ahí (o en sus redes sociales oficiales). Nunca busques datos de personas individuales, solo el mail comercial/institucional publicado por la empresa.

Respondé ÚNICAMENTE con un JSON de este formato exacto, sin texto antes ni después, sin backticks:
{"email":"..."}

Si no encontrás ningún mail publicado, respondé: {"email":""}`;

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
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Error de la API de Anthropic" });
    }

    const texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    const limpio = texto.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let email = "";
    try {
      const parseado = JSON.parse(limpio);
      email = parseado.email || "";
    } catch (e) { /* si no parsea, dejamos vacío */ }

    return res.status(200).json({ email });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
