const nodemailer = require('nodemailer');
const db = require('./db');

function crearTransporte() {
  const cfg = db.todaConfig();
  if (!cfg.smtp_user || !cfg.smtp_pass) return null;
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: parseInt(cfg.smtp_port),
    secure: cfg.smtp_port === '465',
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    tls: { rejectUnauthorized: false }
  });
}

async function enviarAlerta(ip, nombre, minutosCaida) {
  const t = crearTransporte();
  if (!t) { console.warn('[MAIL] SMTP no configurado.'); return false; }
  const cfg = db.todaConfig();
  const display = nombre ? `${nombre} (${ip})` : ip;
  const html = `
<div style="font-family:monospace;background:#111;color:#eee;padding:28px;border-radius:10px;max-width:500px">
  <div style="font-size:24px;color:#ff4757;font-weight:bold;margin-bottom:18px">🔴 IP SIN RESPUESTA</div>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;padding:6px 0;width:160px">Dispositivo</td><td style="color:#fff">${display}</td></tr>
    <tr><td style="color:#888;padding:6px 0">Sin respuesta desde</td><td style="color:#ff4757">${minutosCaida} minuto(s)</td></tr>
    <tr><td style="color:#888;padding:6px 0">Hora de alerta</td><td style="color:#fff">${new Date().toLocaleString('es-DO')}</td></tr>
  </table> 
  <div style="margin-top:20px;padding:12px;background:#1a1a1a;border-left:3px solid #ff4757;border-radius:4px;font-size:12px;color:#aaa">
    El monitor continúa activo. No se enviarán más alertas por esta IP hasta que se recupere.
  </div>
</div>`;
  try {
    await t.sendMail({
      from: `"Monitor IP" <${cfg.smtp_user}>`,
      to: cfg.correo_destino,
      subject: `🔴 ALERTA: ${display} sin respuesta`,
      html
    });
    console.log(`[MAIL] Alerta enviada → ${ip}`);
    return true;
  } catch (e) {
    console.error(`[MAIL] Error: ${e.message}`);
    return false;
  }
}

async function enviarRecuperacion(ip, nombre) {
  const t = crearTransporte();
  if (!t) return false;
  const cfg = db.todaConfig();
  const display = nombre ? `${nombre} (${ip})` : ip;
  const html = `
<div style="font-family:monospace;background:#111;color:#eee;padding:28px;border-radius:10px;max-width:500px">
  <div style="font-size:24px;color:#2ed573;font-weight:bold;margin-bottom:18px">🟢 IP RECUPERADA</div>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="color:#888;padding:6px 0;width:160px">Dispositivo</td><td style="color:#fff">${display}</td></tr>
    <tr><td style="color:#888;padding:6px 0">Hora de recuperación</td><td style="color:#fff">${new Date().toLocaleString('es-DO')}</td></tr>
  </table>
</div>`;
  try {
    await t.sendMail({
      from: `"Monitor IP" <${cfg.smtp_user}>`,
      to: cfg.correo_destino,
      subject: `🟢 RECUPERADO: ${display} volvió a responder`,
      html
    });
    return true;
  } catch (e) {
    console.error(`[MAIL] Error recuperación: ${e.message}`);
    return false;
  }
}

module.exports = { enviarAlerta, enviarRecuperacion };
