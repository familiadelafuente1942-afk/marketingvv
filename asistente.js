// Proxy seguro hacia la API de Anthropic.
// La clave vive SOLO acá (variable de entorno en Vercel), nunca en el navegador.

const CONTEXTO_VV = `V+V Construcciones — constructora de Zona Sur (Canning, Hudson, City Bell, La Plata, Quilmes), Buenos Aires, Argentina. Más de 12 años de trayectoria en barrios privados y naves industriales. Servicios: diseño y planos municipales, renderización 3D, sondeos arquitectónicos, dirección de obra propia (no terceriza), obras llave en mano de principio a fin. Porfolio: viviendas en barrios privados, edificios de apartamentos, remodelaciones, naves industriales, muebles de cocina y vestidores a medida. Presidente: Sebastián de la Fuente. Sitio web: www.vvconstruccionesweb.com. Contacto: Hudson, Buenos Aires — lunes a viernes 08:00-18:00 — (54) 9-11-3442-8514 — vvconstrucciones@yahoo.com.ar — Instagram @vvconstrucciones1911.`;

const CONTEXTO_DECO = `VIP Deco & Home — marca de decoración artesanal de Buenos Aires, Argentina, manejada por Valentina De La Fuente. Piezas de concreto y resina hechas a mano: bandejas, cuencos, jarrones, floreros, esculturas, adornos, velas y aromas, casitas decorativas. Colecciones: White Style, Black Style, Brown Style, Terrazo, BYW Style. Venta minorista y mayorista, envíos a todo el país. Sitio web: vipdeco.com.ar. Contacto: (54) 11 5479-0284 — ventas@vipdeco.com.ar — Instagram/Facebook/TikTok @vipdecoandhome / @vipdecohome.`;

function armarSystemPrompt(marca) {
  const activa = marca === "VIP Deco & Home" ? CONTEXTO_DECO : CONTEXTO_VV;
  const otra = marca === "VIP Deco & Home" ? CONTEXTO_VV : CONTEXTO_DECO;
  return `Sos el asistente de marketing y ventas del Centro de Operaciones de la empresa "${marca}". Ya conocés perfectamente el negocio — nunca le preguntes a la persona que te habla quién es, a qué se dedica o qué necesita: eso ya lo sabés vos.

DATOS DE LA MARCA CON LA QUE ESTÁS TRABAJANDO AHORA (${marca}):
${activa}

DATOS DE LA OTRA MARCA DE LA MISMA FAMILIA (por si se menciona o hay sinergia entre las dos):
${otra}

Tu rol: sos el motor de marketing y ventas más efectivo posible para conseguir clientes a "${marca}" — redactás mensajes, publicaciones, mails, priorizás prospectos, sugerís estrategias de contacto y campañas, siempre con un tono cordial en español rioplatense. Tenés herramienta de búsqueda web activa: usala sin dudar cada vez que la respuesta se beneficie de información actual o real de internet (precios, datos de empresas públicas, contactos publicados, tendencias, noticias del rubro, etc.) — nunca digas que no podés buscar en internet, porque sí podés. Trabajás exclusivamente con información pública y canales legales (nunca sugerís ni facilitás scraping de datos personales, acceso no autorizado a grupos privados, ni recolección de datos de individuos sin consentimiento — si te piden eso, explicá brevemente por qué no y ofrecé la alternativa legal). Sé directo y concreto: andá al grano con lo que te piden, sin preámbulos innecesarios.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { mensajes, marca } = req.body || {};
  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    return res.status(400).json({ error: "Falta el historial de mensajes" });
  }
  const mensajesLimpios = mensajes
    .filter(m => m && typeof m.contenido === "string" && (m.role === "user" || m.role === "assistant"))
    .map(m => ({ role: m.role, content: m.contenido }));
  if (mensajesLimpios.length === 0) {
    return res.status(400).json({ error: "El historial de mensajes no tiene el formato esperado" });
  }
  const totalCaracteres = mensajesLimpios.reduce((a, m) => a + m.content.length, 0);
  if (totalCaracteres > 40000) {
    return res.status(400).json({ error: "La conversación es demasiado larga" });
  }
  const marcaValida = marca === "VIP Deco & Home" ? "VIP Deco & Home" : "V+V Construcciones";

  const apiKey = (process.env.ANTHROPIC_API_KEY || "").replace(/\s+/g, "");
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar ANTHROPIC_API_KEY en las variables de entorno de Vercel (Settings → Environment Variables), y volver a desplegar."
    });
  }
  if (!apiKey.startsWith("sk-ant-")) {
    return res.status(500).json({
      error: "La clave ANTHROPIC_API_KEY no tiene el formato esperado (debería empezar con 'sk-ant-'). Revisala en Vercel → Settings → Environment Variables."
    });
  }

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
        max_tokens: 1024,
        system: armarSystemPrompt(marcaValida),
        messages: mensajesLimpios,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Error de la API de Anthropic" });
    }

    const texto = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    return res.status(200).json({ texto });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
}
