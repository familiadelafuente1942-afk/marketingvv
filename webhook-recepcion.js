// Recibe el evento "email.received" de Resend cuando alguien responde un mail
// (a la dirección hola@respuestas.vvconstruccionesweb.com), lo guarda en Supabase,
// marca el contacto como "respondido" en el historial, y te lo reenvía a tu Yahoo.
//
// Configurar en Resend → Webhooks → Add Webhook → evento: email.received
// URL: https://TU-DOMINIO.vercel.app/api/webhook-recepcion?secret=TU_WEBHOOK_SECRET
// Variables necesarias en Vercel: SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_SECRET, RESEND_API_KEY

const SUPA_URL = "https://ipvrpdsbkfpkvfkfzlnb.supabase.co";
const MAIL_REENVIO_DESDE = "hola@respuestas.vvconstruccionesweb.com";
const MAIL_REENVIO_HACIA = "vvconstrucciones@yahoo.com.ar";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const secretEsperado = (process.env.WEBHOOK_SECRET || "").trim();
  if (secretEsperado && req.query.secret !== secretEsperado) {
    return res.status(401).json({ error: "Secret inválido" });
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
  const resendKey = (process.env.RESEND_API_KEY || "").replace(/\s+/g, "");
  if (!serviceKey) return res.status(500).json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel" });

  try {
    const evento = req.body || {};
    if (evento.type !== "email.received") {
      return res.status(200).json({ ok: true, ignorado: true });
    }

    const datos = evento.data || {};
    const remitente = datos.from || (Array.isArray(datos.from_list) ? datos.from_list[0] : "") || "";
    const asunto = datos.subject || "(sin asunto)";
    let cuerpo = datos.text || datos.html || "";
    const receivingId = datos.email_id || datos.id || null;

    // Si el webhook solo trae metadata, intentamos pedir el contenido completo
    if (!cuerpo && receivingId && resendKey) {
      try {
        const r2 = await fetch(`https://api.resend.com/emails/receiving/${receivingId}`, {
          headers: { Authorization: `Bearer ${resendKey}` }
        });
        if (r2.ok) {
          const d2 = await r2.json();
          cuerpo = d2.text || d2.html || "";
        }
      } catch (e) { /* seguimos sin el cuerpo completo si falla */ }
    }

    // 1) Guardar la respuesta
    await fetch(`${SUPA_URL}/rest/v1/respuestas_recibidas`, {
      method: "POST",
      headers: {
        apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json", Prefer: "return=minimal"
      },
      body: JSON.stringify({ remitente, asunto, cuerpo })
    });

    // 2) Marcar el último mail enviado a ese remitente como "respondido"
    if (remitente) {
      await fetch(`${SUPA_URL}/rest/v1/emails_enviados?destinatario=eq.${encodeURIComponent(remitente)}&order=creado.desc&limit=1`, {
        method: "PATCH",
        headers: {
          apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json", Prefer: "return=minimal"
        },
        body: JSON.stringify({ estado: "respondido" })
      });
    }

    // 3) Reenviar a Yahoo para que también lo veas ahí
    let reenviadoOk = false;
    if (resendKey) {
      try {
        const r3 = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: MAIL_REENVIO_DESDE,
            to: [MAIL_REENVIO_HACIA],
            subject: `Respuesta de ${remitente}: ${asunto}`,
            html: `<p><b>Respondió:</b> ${remitente}</p><hr/>${cuerpo || "(no se pudo leer el contenido, revisalo en el panel de Resend)"}`
          })
        });
        reenviadoOk = r3.ok;
      } catch (e) { /* si falla el reenvío, igual queda guardado en la app */ }
    }

    if (reenviadoOk) {
      await fetch(`${SUPA_URL}/rest/v1/respuestas_recibidas?remitente=eq.${encodeURIComponent(remitente)}&order=creado.desc&limit=1`, {
        method: "PATCH",
        headers: {
          apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json", Prefer: "return=minimal"
        },
        body: JSON.stringify({ reenviado_ok: true })
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
