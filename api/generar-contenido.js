// Genera contenido listo para publicar en redes (caption + hashtags), usando la
// misma identidad de marca que ya conoce el resto de la app. No publica nada solo
// — genera el texto para que lo copies y pegues donde quieras.
const CONTEXTO_VV = `V+V Construcciones — constructora de Zona Sur (Canning, Hudson, City Bell, La Plata, Quilmes), Buenos Aires, Argentina. Más de 12 años de trayectoria en barrios privados y naves industriales. Servicios: diseño y planos municipales, renderización 3D, dirección de obra propia, obras llave en mano. Instagram @vvconstrucciones1911.`;
const CONTEXTO_DECO = `VIP Deco & Home — marca de decoración artesanal (Buenos Aires, Argentina). Piezas de concreto y resina hechas a mano: bandejas, jarrones, esculturas, velas. Colecciones: White Style, Black Style, Brown Style, Terrazo, BYW Style. Venta minorista y mayorista, envíos a todo el país. Instagram @vipdecoandhome, TikTok @vipdecohome.`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { tema, marca, canal } = req.body || {};
  if (!tema || !tema.trim()) {
    return res.status(400).json({ error: "Falta el tema del post" });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || "").replace(/\s+/g, "");
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel." });
  }

  const marcaValida = marca === "VIP Deco & Home" ? "VIP Deco & Home" : "V+V Construcciones";
  const contexto = marcaValida === "VIP Deco & Home" ? CONTEXTO_DECO : CONTEXTO_VV;
  const canalValido = canal || "instagram";

  const prompt = `Sos el redactor de redes sociales de "${marcaValida}". Datos de la marca:\n${contexto}\n\nEscribí un post para ${canalValido} sobre este tema: "${tema}".\n\nRequisitos: español rioplatense, tono cordial y profesional (no exagerado, sin inventar datos, precios ni promesas que no te di), 2-4 oraciones cortas, con 1-3 emojis como máximo, terminando con una llamada a la acción clara (ej: escribinos, contanos tu proyecto, mirá el link en bio). Después agregá una segunda parte con 8 a 12 hashtags relevantes (mezclando genéricos del rubro y de marca), sin numerar.\n\nRespondé ÚNICAMENTE con un JSON de este formato exacto, sin texto antes ni después, sin backticks:\n{"caption":"...","hashtags":"#tag1 #tag2 #tag3"}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Error de la API de Anthropic" });

    const texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    const limpio = texto.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let resultado = { caption: "", hashtags: "" };
    try { resultado = JSON.parse(limpio); } catch (e) { resultado.caption = texto; }

    return res.status(200).json(resultado);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
