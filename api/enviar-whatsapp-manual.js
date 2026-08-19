// Manda un mensaje de WhatsApp escrito por vos desde la app, y marca la
// conversación como "humano" (el agente deja de contestar ahí hasta que
// la devuelvas). Se llama desde el panel de WhatsApp del Centro de Operaciones.

const SUPA_URL = "https://ipvrpdsbkfpkvfkfzlnb.supabase.co";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { conversacion_id, telefono, texto } = req.body || {};
  if (!conversacion_id || !telefono || !texto || !texto.trim()) {
    return res.status(400).json({ error: "Falta conversacion_id, teléfono o texto" });
  }

  const token = (process.env.WHATSAPP_TOKEN || "").trim();
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
  if (!token || !phoneId) return res.status(500).json({ error: "Falta configurar WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en Vercel" });
  if (!serviceKey) return res.status(500).json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel" });

  try {
    const rEnvio = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: telefono, type: "text", text: { body: texto } })
    });
    if (!rEnvio.ok) {
      const err = await rEnvio.json().catch(() => ({}));
      return res.status(rEnvio.status).json({ error: err?.error?.message || "Error al mandar el mensaje por WhatsApp" });
    }

    await fetch(`${SUPA_URL}/rest/v1/whatsapp_mensajes`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ conversacion_id, direccion: "saliente", remitente: "humano", texto })
    });

    await fetch(`${SUPA_URL}/rest/v1/whatsapp_conversaciones?id=eq.${conversacion_id}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ estado: "humano", ultima_actividad: new Date().toISOString() })
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
