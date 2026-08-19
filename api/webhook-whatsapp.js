// AGENTE DE WHATSAPP — recibe mensajes reales de WhatsApp (vía Meta Cloud API) y
// contesta solo, usando el mismo contexto de negocio que el resto de la app, hasta
// que vos toques "Tomar el control" en el panel — a partir de ahí el agente se
// queda callado en esa conversación y contestás vos desde la app.
//
// Configurar en developers.facebook.com → tu app → WhatsApp → Configuration:
// Callback URL: https://TU-DOMINIO.vercel.app/api/webhook-whatsapp
// Verify token: el mismo valor que pongas en WHATSAPP_VERIFY_TOKEN
// Suscribirse al campo "messages"
//
// Variables de entorno necesarias en Vercel:
// WHATSAPP_TOKEN (token permanente de la app de Meta)
// WHATSAPP_PHONE_NUMBER_ID (id del número, no el número en sí)
// WHATSAPP_VERIFY_TOKEN (inventado por vos, para el handshake de verificación)
// SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY (ya deberían estar cargadas)

const SUPA_URL = "https://ipvrpdsbkfpkvfkfzlnb.supabase.co";
const MARCA_POR_DEFECTO = "V+V Construcciones";

const CONTEXTO_VV = `V+V Construcciones — constructora de Zona Sur (Canning, Hudson, City Bell, La Plata, Quilmes), Buenos Aires, Argentina. Más de 12 años de trayectoria en barrios privados y naves industriales. Servicios: diseño y planos municipales, renderización 3D, dirección de obra propia, obras llave en mano. Presidente: Sebastián de la Fuente. Sitio: www.vvconstruccionesweb.com. Contacto: (54) 9-11-3442-8514 — vvconstrucciones@yahoo.com.ar.`;
const CONTEXTO_DECO = `VIP Deco & Home — marca de decoración artesanal (Buenos Aires, Argentina). Piezas de concreto y resina hechas a mano. Venta minorista y mayorista, envíos a todo el país. Contacto: (54) 11 5479-0284 — ventas@vipdeco.com.ar.`;

async function supa(path, opts) {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json", Prefer: "return=representation",
      ...(opts && opts.headers)
    }
  });
  if (!r.ok) return null;
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

async function mandarWhatsApp(telefono, texto) {
  const token = (process.env.WHATSAPP_TOKEN || "").trim();
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!token || !phoneId) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: telefono, type: "text", text: { body: texto } })
    });
    return r.ok;
  } catch (e) { return false; }
}

async function generarRespuestaIA(marca, historial, mensajeNuevo) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").replace(/\s+/g, "");
  if (!apiKey) return null;
  const contexto = marca === "VIP Deco & Home" ? CONTEXTO_DECO : CONTEXTO_VV;

  const systemPrompt = `Sos el agente de WhatsApp de "${marca}". Datos del negocio:\n${contexto}\n\nEstás hablando por WhatsApp con alguien que escribió por primera vez o está en medio de una conversación. Respondé en español rioplatense, tono cordial, mensajes CORTOS (2-4 líneas máximo, como se escribe por WhatsApp de verdad, nunca un párrafo largo). Nunca inventes precios, plazos ni datos que no tengas. Tu objetivo es entender qué necesita la persona y coordinar el siguiente paso (que Sebastián la llame, coordinar una visita, etc.) — no cerrar nada vos mismo.\n\nMUY IMPORTANTE: si la persona pide hablar con una persona real, se enoja, hace un reclamo, pregunta algo que no podés responder con la info que tenés, o la conversación se pone compleja/sensible, respondé de forma amable indicando que ahora te contacta el equipo, y agregá al final de tu respuesta, en una línea aparte, exactamente el texto: [DERIVAR_HUMANO] (esto no lo va a ver el cliente, es una señal interna).`;

  const mensajes = historial.map(m => ({ role: m.direccion === "entrante" ? "user" : "assistant", content: m.texto || "" }));
  mensajes.push({ role: "user", content: mensajeNuevo });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 400, system: systemPrompt, messages: mensajes.slice(-20) })
    });
    const data = await r.json();
    if (!r.ok) return null;
    let texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    const derivar = texto.includes("[DERIVAR_HUMANO]");
    texto = texto.replace("[DERIVAR_HUMANO]", "").trim();
    return { texto, derivar };
  } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  // Meta verifica el webhook una sola vez con un GET
  if (req.method === "GET") {
    const verifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === verifyToken) {
      return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.status(403).send("Verificación fallida");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const entry = (req.body.entry && req.body.entry[0]) || {};
    const cambio = (entry.changes && entry.changes[0]) || {};
    const valor = cambio.value || {};
    const mensaje = valor.messages && valor.messages[0];

    if (!mensaje) {
      // esto es un evento de "estado" (entregado/leído), no un mensaje nuevo — lo ignoramos
      return res.status(200).json({ ok: true, ignorado: true });
    }
    if (mensaje.type !== "text") {
      return res.status(200).json({ ok: true, ignorado: "tipo de mensaje no soportado todavía" });
    }

    const telefono = mensaje.from;
    const texto = mensaje.text.body;
    const nombreContacto = (valor.contacts && valor.contacts[0] && valor.contacts[0].profile && valor.contacts[0].profile.name) || "";

    // 1) Buscar o crear la conversación
    let conv = await supa(`whatsapp_conversaciones?telefono=eq.${encodeURIComponent(telefono)}&select=*&limit=1`);
    conv = conv && conv[0];
    if (!conv) {
      const nuevaConv = await supa("whatsapp_conversaciones", {
        method: "POST",
        body: JSON.stringify({ telefono, nombre: nombreContacto, marca: MARCA_POR_DEFECTO, estado: "agente" })
      });
      conv = nuevaConv && nuevaConv[0];
    } else {
      await supa(`whatsapp_conversaciones?id=eq.${conv.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ ultima_actividad: new Date().toISOString(), nombre: conv.nombre || nombreContacto })
      });
    }
    if (!conv) return res.status(500).json({ error: "No se pudo crear/leer la conversación" });

    // 2) Guardar el mensaje entrante
    await supa("whatsapp_mensajes", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ conversacion_id: conv.id, direccion: "entrante", remitente: "contacto", texto })
    });

    // 3) Enlazar (o crear) un lead en el CRM para que quede en Comercial también
    if (!conv.prospecto_id) {
      const nuevoLead = await supa("prospectos", {
        method: "POST",
        body: JSON.stringify({
          nombre_contacto: nombreContacto || telefono, telefono, marca: conv.marca,
          estado: "nuevo", origen: "whatsapp", mensaje: texto
        })
      });
      if (nuevoLead && nuevoLead[0]) {
        await supa(`whatsapp_conversaciones?id=eq.${conv.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ prospecto_id: nuevoLead[0].id })
        });
      }
    }

    // 4) Si el agente sigue a cargo de esta conversación, contestar solo
    if (conv.estado === "agente") {
      const historial = await supa(`whatsapp_mensajes?conversacion_id=eq.${conv.id}&select=*&order=creado.asc&limit=40`) || [];
      const respuesta = await generarRespuestaIA(conv.marca, historial.slice(0, -1), texto);
      if (respuesta && respuesta.texto) {
        await mandarWhatsApp(telefono, respuesta.texto);
        await supa("whatsapp_mensajes", {
          method: "POST", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ conversacion_id: conv.id, direccion: "saliente", remitente: "agente", texto: respuesta.texto })
        });
        if (respuesta.derivar) {
          await supa(`whatsapp_conversaciones?id=eq.${conv.id}`, {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ estado: "necesita_humano" })
          });
        }
      }
    }
    // si estado es "humano" o "necesita_humano", el agente no contesta —
    // el mensaje ya quedó guardado y visible en el panel para que contestes vos

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
