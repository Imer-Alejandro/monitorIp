/**
 * MonitorIP - Entry Point
 *
 * Modos de ejecución:
 *   MonitorIP.exe --install    → instala como servicio de Windows
 *   MonitorIP.exe --uninstall  → desinstala el servicio
 *   MonitorIP.exe              → corre servidor + monitor
 */

const args = process.argv.slice(2);

// ── Comandos de servicio ──────────────────────────────────────────────────────
if (args.includes('--install')) {
  const { instalarServicio } = require('./service');
  instalarServicio();
}

if (args.includes('--uninstall')) {
  const { desinstalarServicio } = require('./service');
  desinstalarServicio();
}

// ── Modo normal: servidor + monitor ───────────────────────────────────────────
const express    = require('express');
const path       = require('path');
const { exec }   = require('child_process');

const db      = require('./db');
const api     = require('./api');
const monitor = require('./monitor');

const app  = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir el dashboard desde la carpeta public empaquetada
const PUBLIC_DIR = process.pkg
  ? path.join(__dirname, 'public')          // dentro del .exe
  : path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

// API REST
app.use('/api', api);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Manejo limpio al cerrar
process.on('SIGINT',  () => { monitor.detener(); process.exit(0); });
process.on('SIGTERM', () => { monitor.detener(); process.exit(0); });
process.on('uncaughtException', (e) => {
  console.error('[ERROR]', e.message);
  // No salir — mantener el servicio vivo
});

// ── Arrancar todo DESPUÉS de que la DB esté lista ────────────────────────────
db.inicializarDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║         Monitor de IPs v1.0          ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Dashboard: http://localhost:${PORT}   ║`);
    console.log('║  Ctrl+C para detener (modo consola)  ║');
    console.log('╚══════════════════════════════════════╝');

    // Abrir navegador automáticamente (solo si no es servicio de Windows)
    if (!process.env.IS_SERVICE && process.platform === 'win32') {
      exec(`start http://localhost:${PORT}`);
    }
  });

  // Arrancar monitor de pings
  monitor.iniciar();

}).catch(e => {
  console.error('[FATAL] No se pudo inicializar la base de datos:', e.message);
  process.exit(1);
});