// Recibe eventos de Resend (enviado, entregado, abierto, click, rebotado) y
// actualiza el registro correspondiente en Supabase. Usa la clave de servicio
// porque este endpoint lo llama Resend directamente, sin que la persona esté logueada.
//
// Configurar en Resend → Webhooks → URL: https://TU-DOMINIO.vercel.app/api/webhook-resend?secret=TU_WEBHOOK_SECRET
// Variables de entorno necesarias en Vercel: SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_SECRET

const SUPA_URL = "https://ipvrpdsbkfpkvfkfzlnb.supabase.co";

const MAPA_EVENTO_ESTADO = {
  "email.sent": "enviado",
  "email.delivered": "entregado",
  "email.opened": "abierto",
  "email.clicked": "click",
  "email.bounced": "rebotado",
  "email.complained": "rebotado"
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const secretEsperado = (process.env.WEBHOOK_SECRET || "").trim();
  if (secretEsperado && req.query.secret !== secretEsperado) {
    return res.status(401).json({ error: "Secret inválido" });
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
  if (!serviceKey) {
    return res.status(500).json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel" });
  }

  try {
    const evento = req.body || {};
    const tipo = evento.type;
    const resendId = evento.data && evento.data.email_id;
    const nuevoEstado = MAPA_EVENTO_ESTADO[tipo];
    if (!resendId || !nuevoEstado) {
      return res.status(200).json({ ok: true, ignorado: true });
    }

    const patch = { estado: nuevoEstado };
    if (tipo === "email.opened") patch.fecha_apertura = new Date().toISOString();
    if (tipo === "email.clicked") patch.fecha_click = new Date().toISOString();

    // No pisar un estado "mejor" con uno anterior (ej: no bajar de "click" a "entregado").
    // Los rebotes/quejas son siempre críticos y se aplican igual, pasen lo que pasen antes.
    const orden = ["enviado", "entregado", "abierto", "click"];
    if (orden.includes(nuevoEstado)) {
      try {
        const rActual = await fetch(`${SUPA_URL}/rest/v1/emails_enviados?resend_id=eq.${encodeURIComponent(resendId)}&select=estado&limit=1`, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
        });
        const filas = rActual.ok ? await rActual.json() : [];
        const estadoActual = filas[0] && filas[0].estado;
        const posActual = orden.indexOf(estadoActual);
        const posNueva = orden.indexOf(nuevoEstado);
        if (posActual > -1 && posNueva > -1 && posActual > posNueva) {
          // ya estaba en un estado más avanzado — no lo pisamos, pero seguimos
          // guardando la fecha (apertura/click) si vino con este evento
          delete patch.estado;
        }
      } catch (e) { /* si falla la consulta, aplicamos el patch igual, mejor que perder el dato */ }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(200).json({ ok: true, sinCambios: true });
    }

    const r = await fetch(`${SUPA_URL}/rest/v1/emails_enviados?resend_id=eq.${encodeURIComponent(resendId)}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(patch)
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: `Supabase: ${txt.slice(0, 200)}` });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
