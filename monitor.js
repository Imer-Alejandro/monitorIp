const ping = require('ping');
const db = require('./db');
const { enviarAlerta, enviarRecuperacion } = require('./mailer');

let intervalHandle = null;

async function hacerPing(ip) {
  return new Promise(resolve => {
    ping.promise.probe(ip, { timeout: 5 }).then(res => {
      resolve({ alive: res.alive, ms: res.time === 'unknown' ? null : parseFloat(res.time) });
    }).catch(() => resolve({ alive: false, ms: null }));
  });
}

async function ciclo() {
  const ips = db.listarIPs();
  const minutosAlerta = parseFloat(db.getConfig('minutos_alerta') || '3');

  for (const row of ips) {
    try {
      const r = await hacerPing(row.ip);
      const ts = new Date().toLocaleTimeString('es-DO');

      if (r.alive) {
        // Si estaba caída y se recuperó
        if (row.caido_desde) {
          console.log(`[${ts}] 🟢 ${row.ip} recuperada (${r.ms}ms)`);
          if (row.alerta_enviada) {
            enviarRecuperacion(row.ip, row.nombre).catch(() => {});
          }
        } else {
          console.log(`[${ts}] ✅ ${row.ip} OK (${r.ms}ms)`);
        }
        db.marcarRecuperada(row.id, r.ms);
        db.registrarPing(row.id, 'up', r.ms);

      } else {
        // Marcar caída (guarda timestamp si es el primer fallo)
        db.marcarCaida(row.id);
        db.registrarPing(row.id, 'down', null);

        // Calcular cuántos segundos lleva caída
        const segs = db.segundosCaida(row.id);
        const mins = Math.floor(segs / 60);
        console.log(`[${ts}] ❌ ${row.ip} sin respuesta (${mins}m ${Math.floor(segs % 60)}s)`);

        // Enviar alerta si supera el umbral Y no se envió aún
        if (segs >= minutosAlerta * 60 && !row.alerta_enviada) {
          console.log(`[${ts}] 📧 Enviando alerta para ${row.ip}...`);
          const ok = await enviarAlerta(row.ip, row.nombre, Math.floor(segs / 60));
          if (ok) db.marcarAlertaEnviada(row.id);
        }
      }
    } catch (e) {
      console.error(`[MONITOR] Error procesando ${row.ip}: ${e.message}`);
    }
  }
}

function iniciar() {
  if (intervalHandle) return;
  const segs = parseInt(db.getConfig('intervalo_seg') || '60');
  console.log(`[MONITOR] Iniciando. Intervalo: ${segs}s | Umbral alerta: ${db.getConfig('minutos_alerta')}min`);
  ciclo(); // primer ciclo inmediato
  intervalHandle = setInterval(ciclo, segs * 1000);
}

function detener() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[MONITOR] Detenido.');
  }
}

function reiniciar() {
  detener();
  iniciar();
}

module.exports = { iniciar, detener, reiniciar };
