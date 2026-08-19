// Manda mails a través de Resend (resend.com).
// Necesita la variable de entorno RESEND_API_KEY en Vercel.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { remitente, responderA, destinatarios, asunto, cuerpoHtml, adjunto } = req.body || {};
  if (!remitente || !Array.isArray(destinatarios) || destinatarios.length === 0 || !asunto || !cuerpoHtml) {
    return res.status(400).json({ error: "Faltan datos: remitente, destinatarios, asunto o cuerpo" });
  }
  if (destinatarios.length > 100) {
    return res.status(400).json({ error: "Máximo 100 destinatarios por envío" });
  }

  const apiKey = (process.env.RESEND_API_KEY || "").replace(/\s+/g, "");
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar RESEND_API_KEY en las variables de entorno de Vercel, y volver a desplegar."
    });
  }

  try {
    let resultados;

    if (adjunto && adjunto.contenidoBase64) {
      // Resend NO soporta adjuntos en el envío por lote — mandamos uno por uno.
      resultados = [];
      for (const d of destinatarios) {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: remitente,
              to: [d.email],
              subject: asunto,
              html: cuerpoHtml,
              ...(responderA ? { reply_to: responderA } : {}),
              attachments: [{ filename: adjunto.nombre || "adjunto.pdf", content: adjunto.contenidoBase64 }]
            })
          });
          const data = await r.json();
          resultados.push({ email: d.email, nombre: d.nombre || "", resend_id: r.ok ? data.id : null });
        } catch (e) {
          resultados.push({ email: d.email, nombre: d.nombre || "", resend_id: null });
        }
      }
    } else {
      const lote = destinatarios.map(d => ({
        from: remitente, to: [d.email], subject: asunto, html: cuerpoHtml,
        ...(responderA ? { reply_to: responderA } : {})
      }));
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(lote)
      });
      const data = await r.json();
      if (!r.ok) {
        return res.status(r.status).json({ error: data?.message || "Error de la API de Resend" });
      }
      resultados = destinatarios.map((d, i) => ({
        email: d.email, nombre: d.nombre || "",
        resend_id: (data.data && data.data[i] && data.data[i].id) || null
      }));
    }

    return res.status(200).json({ resultados });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
