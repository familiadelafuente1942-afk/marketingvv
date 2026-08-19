// AGENTE DIARIO — corre solo todos los días (Vercel Cron), sin que nadie lo apriete.
// Revisa los leads de las dos marcas, detecta lo urgente (nuevos sin contactar hace
// más de 24hs, próximas acciones vencidas, prioridad alta sin movimiento), redacta
// un mensaje sugerido para cada uno con IA, y te manda un resumen por mail con todo
// listo para actuar. No manda nada a los leads directamente — solo te avisa a vos.

const SUPA_URL = "https://ipvrpdsbkfpkvfkfzlnb.supabase.co";
const REMITENTE = "ventas@vvconstruccionesweb.com";
const MAIL_DESTINO = "vvconstrucciones@yahoo.com.ar";
const MAX_LEADS_CON_MENSAJE = 8; // no generar de más para no tardar/gastar de más

async function redactarSugerencias(apiKey, leads) {
  if (leads.length === 0) return {};
  const resumenLeads = leads.map((l, i) =>
    `${i + 1}) id:${l.id} | ${l.marca} | ${l.nombre_contacto || l.empresa || "sin nombre"} | tipo: ${l.tipo_proyecto || "-"} | zona: ${l.zona || "-"} | estado: ${l.estado} | días sin contacto: ${l._diasSinContacto}${l.mensaje ? ` | dijo: "${l.mensaje.slice(0, 140)}"` : ""}`
  ).join("\n");

  const prompt = `Sos el asistente de ventas de V+V Construcciones y VIP Deco & Home. Te paso una lista de leads que necesitan atención hoy:\n\n${resumenLeads}\n\nPara cada uno, escribí un mensaje corto (2-3 oraciones, español rioplatense, tono cordial y profesional, sin inventar datos que no tengas) que la persona dueña del negocio pueda copiar y mandar tal cual por WhatsApp o mail para retomar el contacto.\n\nRespondé ÚNICAMENTE con un JSON: {"idDelLead": "mensaje sugerido", ...} usando el id numérico de cada lead como clave (el número de la lista, no el uuid). Sin texto antes ni después, sin backticks.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 1500, messages: [{ role: "user", content: prompt }] })
    });
    const data = await r.json();
    if (!r.ok) return {};
    const texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    const limpio = texto.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const porIndice = JSON.parse(limpio);
    // Convertimos claves 1,2,3... de vuelta a los ids reales de cada lead
    const porId = {};
    leads.forEach((l, i) => { if (porIndice[String(i + 1)]) porId[l.id] = porIndice[String(i + 1)]; });
    return porId;
  } catch (e) { return {}; }
}

function armarHTML(marca, urgentes, mensajes) {
  const color = marca === "VIP Deco & Home" ? "#A9673C" : "#B0894F";
  if (urgentes.length === 0) return "";
  const filas = urgentes.map(l => `
    <div style="border:1px solid #E6E9EE;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
      <div style="font-weight:bold;color:#101C2C;font-size:14px;">${l.nombre_contacto || l.empresa || "(sin nombre)"} <span style="color:${color};font-size:11px;font-weight:normal;">· ${l.motivo}</span></div>
      <div style="font-size:12px;color:#5B6B85;margin:4px 0 8px;">${l.tipo_proyecto || ""} ${l.zona ? "· " + l.zona : ""} ${l.telefono ? "· " + l.telefono : ""} ${l.email ? "· " + l.email : ""}</div>
      ${mensajes[l.id] ? `<div style="background:#F5F6F8;border-radius:6px;padding:10px 12px;font-size:12.5px;color:#2B2925;font-style:italic;">"${mensajes[l.id]}"</div>` : ""}
    </div>`).join("");
  return `<h3 style="color:#101C2C;font-size:15px;margin:22px 0 10px;">${marca} — ${urgentes.length} lead${urgentes.length === 1 ? "" : "s"} para atender hoy</h3>${filas}`;
}

module.exports = async function handler(req, res) {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").replace(/\s+/g, "");
  const resendKey = (process.env.RESEND_API_KEY || "").replace(/\s+/g, "");
  if (!serviceKey) return res.status(500).json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel" });

  try {
    const rLeads = await fetch(`${SUPA_URL}/rest/v1/prospectos?select=*&estado=not.in.(ganado,perdido)&order=creado.desc&limit=500`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    const leads = rLeads.ok ? await rLeads.json() : [];

    const ahora = Date.now();
    const hoyISO = new Date().toISOString().slice(0, 10);
    const urgentesPorMarca = { "V+V Construcciones": [], "VIP Deco & Home": [] };

    for (const l of leads) {
      const diasSinContacto = l.creado ? Math.floor((ahora - new Date(l.creado).getTime()) / 86400000) : 0;
      let motivo = null;
      if (l.estado === "nuevo" && diasSinContacto >= 1) motivo = `sin contactar hace ${diasSinContacto} día${diasSinContacto === 1 ? "" : "s"}`;
      else if (l.fecha_proxima_accion && l.fecha_proxima_accion <= hoyISO) motivo = "próxima acción vencida o para hoy";
      else if (l.prioridad === "alta" && diasSinContacto >= 2) motivo = "prioridad alta sin movimiento";
      if (motivo) {
        const marca = l.marca || "V+V Construcciones";
        if (urgentesPorMarca[marca]) urgentesPorMarca[marca].push({ ...l, _diasSinContacto: diasSinContacto, motivo });
      }
    }

    const todosUrgentes = [...urgentesPorMarca["V+V Construcciones"], ...urgentesPorMarca["VIP Deco & Home"]];
    let mensajes = {};
    if (apiKey && todosUrgentes.length > 0) {
      mensajes = await redactarSugerencias(apiKey, todosUrgentes.slice(0, MAX_LEADS_CON_MENSAJE));
    }

    const totalUrgentes = todosUrgentes.length;
    let cuerpoHTML = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:#101C2C;color:#fff;padding:20px 24px;border-radius:6px 6px 0 0;">
        <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#B0894F;font-weight:bold;">Agente diario</div>
        <div style="font-size:19px;font-weight:bold;margin-top:4px;">${totalUrgentes > 0 ? `${totalUrgentes} lead${totalUrgentes === 1 ? "" : "s"} necesitan tu atención hoy` : "Todo al día — nada urgente hoy"}</div>
      </div>
      <div style="border:1px solid #E6E9EE;border-top:none;padding:20px 24px;border-radius:0 0 6px 6px;">`;
    cuerpoHTML += armarHTML("V+V Construcciones", urgentesPorMarca["V+V Construcciones"], mensajes);
    cuerpoHTML += armarHTML("VIP Deco & Home", urgentesPorMarca["VIP Deco & Home"], mensajes);
    if (totalUrgentes === 0) cuerpoHTML += `<div style="color:#5B6B85;font-size:13px;">No hay leads nuevos sin contactar, próximas acciones vencidas, ni prioridades altas sin movimiento. Buen trabajo.</div>`;
    cuerpoHTML += `</div></div>`;

    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: REMITENTE, to: [MAIL_DESTINO],
            subject: totalUrgentes > 0 ? `📋 ${totalUrgentes} lead${totalUrgentes === 1 ? "" : "s"} para hoy` : "📋 Todo al día — sin pendientes urgentes",
            html: cuerpoHTML
          })
        });
      } catch (e) { /* si falla el mail, igual guardamos el resumen abajo */ }
    }

    const resumenTexto = totalUrgentes > 0
      ? `${totalUrgentes} lead(s) urgentes — ${urgentesPorMarca["V+V Construcciones"].length} de V+V, ${urgentesPorMarca["VIP Deco & Home"].length} de VIP Deco`
      : "Sin pendientes urgentes";

    await fetch(`${SUPA_URL}/rest/v1/agente_digest_diario?id=eq.1`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ fecha: new Date().toISOString(), resumen: resumenTexto, urgentes: totalUrgentes })
    });

    return res.status(200).json({ ok: true, totalUrgentes, resumenTexto });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error inesperado" });
  }
};
