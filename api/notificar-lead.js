// Se dispara automáticamente cada vez que alguien completa el formulario de contacto
// (V+V o VIP Deco). Manda 1) aviso interno al equipo, 2) confirmación automática al
// interesado. Si RESEND_API_KEY no está configurada todavía, no rompe nada — el lead
// ya quedó guardado en Supabase de todos modos, solo no se manda el mail.

const REMITENTE = "ventas@vvconstruccionesweb.com";
const MAIL_EQUIPO = "vvconstrucciones@yahoo.com.ar";

function plantillaEquipo(lead) {
  const esVip = lead.marca === "VIP Deco & Home";
  const color = esVip ? "#A9673C" : "#B0894F";
  const fondo = esVip ? "#1A1714" : "#101C2C";
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
    <div style="background:${fondo};color:#fff;padding:18px 24px;border-radius:6px 6px 0 0;">
      <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${color};font-weight:bold;">Nueva consulta — ${lead.marca || ""}</div>
      <div style="font-size:20px;font-weight:bold;margin-top:4px;">${lead.nombre_contacto || "(sin nombre)"}</div>
    </div>
    <div style="border:1px solid #E6E9EE;border-top:none;padding:20px 24px;border-radius:0 0 6px 6px;">
      <table style="width:100%;font-size:13px;color:#2B2925;border-collapse:collapse;">
        <tr><td style="padding:5px 0;color:#8B95A5;">Mail</td><td style="padding:5px 0;">${lead.email || "—"}</td></tr>
        <tr><td style="padding:5px 0;color:#8B95A5;">Teléfono</td><td style="padding:5px 0;">${lead.telefono || "—"}</td></tr>
        <tr><td style="padding:5px 0;color:#8B95A5;">Tipo de consulta</td><td style="padding:5px 0;">${lead.tipo_proyecto || "—"}</td></tr>
        <tr><td style="padding:5px 0;color:#8B95A5;">Zona</td><td style="padding:5px 0;">${lead.zona || "—"}</td></tr>
        <tr><td style="padding:5px 0;color:#8B95A5;">Origen</td><td style="padding:5px 0;">${lead.origen || "—"} ${lead.utm_source ? `(${lead.utm_source}/${lead.utm_medium || ""})` : ""}</td></tr>
      </table>
      ${lead.mensaje ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #E6E9EE;font-size:13px;color:#2B2925;white-space:pre-wrap;">${lead.mensaje}</div>` : ""}
    </div>
  </div>`;
}

function plantillaInteresado(lead) {
  const esVip = lead.marca === "VIP Deco & Home";
  const color = esVip ? "#A9673C" : "#B0894F";
  const fondo = esVip ? "#1A1714" : "#101C2C";
  const nombreMarca = esVip ? "VIP Deco & Home" : "V+V Construcciones";
  const firma = esVip
    ? "(54) 11 5479-0284 · ventas@vipdeco.com.ar"
    : "(54) 9-11-3442-8514 · vvconstrucciones@yahoo.com.ar";
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
    <div style="background:${fondo};color:#fff;padding:22px 24px;border-radius:6px 6px 0 0;font-size:15px;font-weight:bold;">${nombreMarca}</div>
    <div style="border:1px solid #E6E9EE;border-top:none;padding:24px;border-radius:0 0 6px 6px;font-size:14px;color:#2B2925;line-height:1.6;">
      <p>Hola ${lead.nombre_contacto || ""},</p>
      <p>Recibimos tu consulta y en breve nos vamos a poner en contacto con vos.</p>
      <p style="color:#5B6B85;font-size:12.5px;margin-top:20px;">${firma}</p>
    </div>
  </div>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const resendKey = (process.env.RESEND_API_KEY || "").replace(/\s+/g, "");
  if (!resendKey) {
    // No rompemos el flujo del formulario — el lead ya quedó guardado en Supabase.
    return res.status(200).json({ ok: true, notificado: false, motivo: "RESEND_API_KEY no configurada todavía" });
  }

  const lead = req.body || {};
  const resultados = { equipo: false, interesado: false };

  try {
    const r1 = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMITENTE,
        to: [MAIL_EQUIPO],
        subject: `Nueva consulta (${lead.marca || "sin marca"}) — ${lead.nombre_contacto || "sin nombre"}`,
        html: plantillaEquipo(lead)
      })
    });
    resultados.equipo = r1.ok;
  } catch (e) { /* seguimos, el lead ya está guardado */ }

  if (lead.email) {
    try {
      const r2 = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: REMITENTE,
          to: [lead.email],
          subject: lead.marca === "VIP Deco & Home" ? "Recibimos tu consulta — VIP Deco & Home" : "Recibimos tu consulta — V+V Construcciones",
          html: plantillaInteresado(lead)
        })
      });
      resultados.interesado = r2.ok;
    } catch (e) { /* seguimos */ }
  }

  return res.status(200).json({ ok: true, ...resultados });
};
