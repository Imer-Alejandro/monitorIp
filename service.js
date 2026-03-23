/**
 * service.js
 * Auto-descarga NSSM y registra MonitorIP como servicio de Windows.
 *
 * Uso:
 *   MonitorIP.exe --install    → descarga NSSM, instala el servicio y lo inicia
 *   MonitorIP.exe --uninstall  → detiene y elimina el servicio
 *   MonitorIP.exe              → corre normalmente (ya como servicio)
 */

const { execSync }  = require('child_process');
const path          = require('path');
const fs            = require('fs');
const https         = require('https');

const SERVICE_NAME  = 'MonitorIP';
const EXE_PATH      = process.execPath;
const EXE_DIR       = path.dirname(EXE_PATH);
const NSSM_PATH     = path.join(EXE_DIR, 'nssm.exe');
const NSSM_URL      = 'https://nssm.cc/release/nssm-2.24.zip';
const NSSM_ZIP      = path.join(EXE_DIR, 'nssm.zip');

// ── Helpers ───────────────────────────────────────────────────────────────────
function esAdmin() {
  try { execSync('net session', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function descargar(url, destino) {
  return new Promise((resolve, reject) => {
    console.log(`Descargando NSSM...`);
    const file = fs.createWriteStream(destino);
    const request = (u) => {
      https.get(u, res => {
        // Seguir redirecciones
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    request(url);
  });
}

function extraerNSSM() {
  // Usar PowerShell para descomprimir — disponible en Windows 8+
  console.log(`📦 Extrayendo NSSM...`);
  const tmp = path.join(EXE_DIR, 'nssm_tmp');
  execSync(`powershell -Command "Expand-Archive -Force '${NSSM_ZIP}' '${tmp}'"`, { stdio: 'ignore' });
  // Buscar nssm.exe dentro del zip (está en nssm-2.24/win64/nssm.exe)
  const candidatos = [
    path.join(tmp, 'nssm-2.24', 'win64', 'nssm.exe'),
    path.join(tmp, 'nssm-2.24', 'win32', 'nssm.exe'),
  ];
  for (const c of candidatos) {
    if (fs.existsSync(c)) {
      fs.copyFileSync(c, NSSM_PATH);
      break;
    }
  }
  // Limpiar
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(NSSM_ZIP, { force: true });
  if (!fs.existsSync(NSSM_PATH)) throw new Error('No se pudo extraer nssm.exe');
  console.log(`✅ NSSM listo.`);
}

// ── Instalar ──────────────────────────────────────────────────────────────────
async function instalarServicio() {
  if (!esAdmin()) {
    console.error('❌ Ejecuta como Administrador para instalar el servicio.');
    console.error('   Click derecho en MonitorIP.exe → "Ejecutar como administrador"');
    process.exit(1);
  }

  // 1. Obtener NSSM si no existe
  if (!fs.existsSync(NSSM_PATH)) {
    try {
      await descargar(NSSM_URL, NSSM_ZIP);
      extraerNSSM();
    } catch (e) {
      console.error('❌ No se pudo descargar NSSM:', e.message);
      console.error('   Verifica tu conexión a internet e intenta de nuevo.');
      process.exit(1);
    }
  } else {
    console.log(`✅ NSSM ya existe, usando el existente.`);
  }

  // 2. Eliminar servicio anterior si existe
  try {
    execSync(`"${NSSM_PATH}" stop ${SERVICE_NAME}`,   { stdio: 'ignore' });
    execSync(`"${NSSM_PATH}" remove ${SERVICE_NAME} confirm`, { stdio: 'ignore' });
  } catch (_) {}

  // 3. Instalar con NSSM
  console.log(`🔧 Registrando servicio "${SERVICE_NAME}"...`);
  try {
    execSync(`"${NSSM_PATH}" install ${SERVICE_NAME} "${EXE_PATH}"`);
    execSync(`"${NSSM_PATH}" set ${SERVICE_NAME} DisplayName "Monitor de IPs"`);
    execSync(`"${NSSM_PATH}" set ${SERVICE_NAME} Description "Monitorea IPs con ping y envía alertas por correo."`);
    execSync(`"${NSSM_PATH}" set ${SERVICE_NAME} Start SERVICE_AUTO_START`);
    // Directorio de trabajo = carpeta del .exe (para que ips.db se cree ahí)
    execSync(`"${NSSM_PATH}" set ${SERVICE_NAME} AppDirectory "${EXE_DIR}"`);
    // Reiniciar automáticamente si el proceso muere
    execSync(`"${NSSM_PATH}" set ${SERVICE_NAME} AppRestartDelay 5000`);

    execSync(`"${NSSM_PATH}" start ${SERVICE_NAME}`);

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   ✅ Servicio instalado correctamente    ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Dashboard: http://localhost:3000        ║');
    console.log('║  Arranca automáticamente con Windows     ║');
    console.log('║                                          ║');
    console.log('║  Para desinstalar:                       ║');
    console.log('║  MonitorIP.exe --uninstall               ║');
    console.log('╚══════════════════════════════════════════╝');
  } catch (e) {
    console.error('❌ Error registrando el servicio:', e.message);
    process.exit(1);
  }

  process.exit(0);
}

// ── Desinstalar ───────────────────────────────────────────────────────────────
function desinstalarServicio() {
  if (!esAdmin()) {
    console.error('❌ Ejecuta como Administrador para desinstalar el servicio.');
    process.exit(1);
  }

  if (!fs.existsSync(NSSM_PATH)) {
    console.error('❌ No se encontró nssm.exe. El servicio puede no estar instalado.');
    process.exit(1);
  }

  console.log(`🗑️  Desinstalando servicio "${SERVICE_NAME}"...`);
  try {
    execSync(`"${NSSM_PATH}" stop ${SERVICE_NAME}`,          { stdio: 'ignore' });
    execSync(`"${NSSM_PATH}" remove ${SERVICE_NAME} confirm`);
    console.log(`✅ Servicio "${SERVICE_NAME}" eliminado correctamente.`);
  } catch (e) {
    console.error('❌ Error desinstalando:', e.message);
  }
  process.exit(0);
}

module.exports = { instalarServicio, desinstalarServicio };