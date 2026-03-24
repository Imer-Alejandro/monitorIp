const express = require('express');
const path = require('path');
const db = require('./db');
const { reiniciar } = require('./monitor');
const { iniciarEscaneo, cancelarEscaneo, estadoEscaneo, detectarSubred } = require('./scanner');

const router = express.Router();

// ── IPs ───────────────────────────────────────────────────────────────────────
router.get('/ips', (req, res) => {
  res.json(db.listarIPs());
});

router.post('/ips', (req, res) => {
  const { ip, nombre } = req.body;
  if (!ip) return res.status(400).json({ ok: false, error: 'IP requerida.' });
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!ipRegex.test(ip.trim())) return res.status(400).json({ ok: false, error: 'Formato de IP/host inválido.' });
  res.json(db.agregarIP(ip, nombre || ''));
});

router.put('/ips/:id', (req, res) => {
  const { ip, nombre } = req.body;
  if (!ip) return res.status(400).json({ ok: false, error: 'IP requerida.' });
  res.json(db.editarIP(req.params.id, ip, nombre || ''));
});

router.delete('/ips/:id', (req, res) => {
  res.json(db.eliminarIP(req.params.id));
});

// ── Stats & logs ──────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  res.json(db.stats());
});

router.get('/logs', (req, res) => {
  res.json(db.logReciente(100));
});

router.get('/ips/:id/historial', (req, res) => {
  res.json(db.historialIP(req.params.id, 60));
});

// ── Config ────────────────────────────────────────────────────────────────────
router.get('/config', (req, res) => {
  const cfg = db.todaConfig();

  res.json({
    ...cfg,
    smtp_pass: undefined,
    smtp_pass_configurada: !!cfg.smtp_pass
  });
});

router.post('/config', (req, res) => {
  const campos = [
    'smtp_host', 'smtp_port', 'smtp_user',
    'correo_destino', 'intervalo_seg', 'minutos_alerta'
  ];

  // actualizar campos normales
  for (const c of campos) {
    if (req.body[c] !== undefined) {
      db.setConfig(c, req.body[c]);
    }
  }

  //  manejar password separado (forma correcta)
  if (
    req.body.smtp_pass !== undefined &&
    req.body.smtp_pass !== '' &&
    req.body.smtp_pass !== '••••••••'
  ) {
    db.setConfig('smtp_pass', req.body.smtp_pass);
  }

  reiniciar();
  res.json({ ok: true });
});

// ── Test correo ───────────────────────────────────────────────────────────────
router.post('/test-correo', async (req, res) => {
  const { enviarAlerta } = require('./mailer');
  const ok = await enviarAlerta('192.168.1.1', 'Prueba', 5);
  res.json({ ok, msg: ok ? 'Correo enviado correctamente.' : 'Error al enviar. Revisa la config SMTP.' });
});

// ── Escáner de red ────────────────────────────────────────────────────────────
router.post('/scan/start', async (req, res) => {
  const resultado = await iniciarEscaneo();
  res.json(resultado);
});

router.post('/scan/cancel', (req, res) => {
  res.json(cancelarEscaneo());
});

router.get('/scan/status', (req, res) => {
  res.json(estadoEscaneo());
});

router.get('/scan/network', (req, res) => {
  const subred = detectarSubred();
  res.json(subred || { error: 'No se pudo detectar la red.' });
});

module.exports = router;