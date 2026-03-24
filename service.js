/**
 * service.js (versión limpia)
 * Ya NO instala el servicio (eso lo hace Inno Setup).
 * Solo permite desinstalar manualmente si es necesario.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVICE_NAME = 'MonitorIP';
const EXE_DIR = path.dirname(process.execPath);
const NSSM_PATH = path.join(EXE_DIR, 'nssm.exe');

// ── Helpers ───────────────────────────────────────────────────────────────────
function esAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Desinstalar servicio (manual) ─────────────────────────────────────────────
function desinstalarServicio() {
  if (!esAdmin()) {
    console.error('❌ Ejecuta como Administrador para desinstalar el servicio.');
    process.exit(1);
  }

  if (!fs.existsSync(NSSM_PATH)) {
    console.error('❌ No se encontró nssm.exe.');
    process.exit(1);
  }

  console.log(`🗑️ Eliminando servicio "${SERVICE_NAME}"...`);

  try {
    execSync(`"${NSSM_PATH}" stop ${SERVICE_NAME}`, { stdio: 'ignore' });
  } catch (_) {}

  try {
    execSync(`"${NSSM_PATH}" remove ${SERVICE_NAME} confirm`, { stdio: 'ignore' });
    console.log('✅ Servicio eliminado correctamente.');
  } catch (e) {
    console.error('❌ Error eliminando servicio:', e.message);
  }

  process.exit(0);
}

module.exports = { desinstalarServicio };