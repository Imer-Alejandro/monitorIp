const fs   = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = process.pkg
  ? path.join(path.dirname(process.execPath), 'ips.db')  // dentro del .exe
  : path.join(__dirname, 'ips.db');  
let db;

async function inicializarDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS ips (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ip          TEXT    NOT NULL UNIQUE,
      nombre      TEXT    DEFAULT '',
      alerta_enviada INTEGER DEFAULT 0,
      caido_desde TEXT    DEFAULT NULL,
      ultimo_check TEXT   DEFAULT NULL,
      ultimo_tiempo REAL  DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS ping_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_id     INTEGER NOT NULL,
      estado    TEXT    NOT NULL,
      tiempo_ms REAL,
      fecha     TEXT    DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

  const DEFAULTS = {
    smtp_host: 'smtp.gmail.com', smtp_port: '587',
    smtp_user: '', smtp_pass: '', correo_destino: '',
    intervalo_seg: '60', minutos_alerta: '3'
  };
  for (const [k, v] of Object.entries(DEFAULTS)) {
    db.run(`INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)`, [k, v]);
  }

  guardar();
  // Guardar a disco cada 30 segundos
  setInterval(guardar, 30000);
}

function guardar() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Helper: ejecutar query que devuelve filas
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Helper: ejecutar query sin retorno
function run(sql, params = []) {
  db.run(sql, params);
  guardar();
}

// Helper: devolver una sola fila
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

// ── IPs ───────────────────────────────────────────────────────────────────────
function listarIPs() {
  return all(`SELECT * FROM ips ORDER BY id ASC`);
}

function agregarIP(ip, nombre = '') {
  try {
    run(`INSERT INTO ips (ip, nombre) VALUES (?, ?)`, [ip.trim(), nombre.trim()]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'La IP ya existe.' };
  }
}

function editarIP(id, ip, nombre) {
  try {
    run(`UPDATE ips SET ip = ?, nombre = ? WHERE id = ?`, [ip.trim(), nombre.trim(), id]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function eliminarIP(id) {
  run(`DELETE FROM ping_log WHERE ip_id = ?`, [id]);
  run(`DELETE FROM ips WHERE id = ?`, [id]);
  return { ok: true };
}

// ── Estado ────────────────────────────────────────────────────────────────────
function marcarCaida(id) {
  const row = get(`SELECT caido_desde FROM ips WHERE id = ?`, [id]);
  if (!row || !row.caido_desde) {
    run(`UPDATE ips SET caido_desde = datetime('now','localtime'), ultimo_check = datetime('now','localtime') WHERE id = ?`, [id]);
  } else {
    run(`UPDATE ips SET ultimo_check = datetime('now','localtime') WHERE id = ?`, [id]);
  }
}

function marcarAlertaEnviada(id) {
  run(`UPDATE ips SET alerta_enviada = 1 WHERE id = ?`, [id]);
}

function marcarRecuperada(id, tiempo_ms) {
  run(`UPDATE ips SET alerta_enviada = 0, caido_desde = NULL,
    ultimo_check = datetime('now','localtime'), ultimo_tiempo = ? WHERE id = ?`,
    [tiempo_ms, id]);
}

function segundosCaida(id) {
  const row = get(`SELECT caido_desde FROM ips WHERE id = ?`, [id]);
  if (!row || !row.caido_desde) return 0;
  return (Date.now() - new Date(row.caido_desde).getTime()) / 1000;
}

// ── Log ───────────────────────────────────────────────────────────────────────
function registrarPing(ip_id, estado, tiempo_ms) {
  run(`INSERT INTO ping_log (ip_id, estado, tiempo_ms) VALUES (?, ?, ?)`, [ip_id, estado, tiempo_ms]);
  run(`DELETE FROM ping_log WHERE ip_id = ? AND id NOT IN (
    SELECT id FROM ping_log WHERE ip_id = ? ORDER BY id DESC LIMIT 500
  )`, [ip_id, ip_id]);
}

function historialIP(ip_id, limite = 60) {
  return all(`SELECT estado, tiempo_ms, fecha FROM ping_log
    WHERE ip_id = ? ORDER BY id DESC LIMIT ?`, [ip_id, limite]);
}

function logReciente(limite = 80) {
  return all(`SELECT p.estado, p.tiempo_ms, p.fecha, i.ip, i.nombre
    FROM ping_log p JOIN ips i ON p.ip_id = i.id
    ORDER BY p.id DESC LIMIT ?`, [limite]);
}

// ── Config ────────────────────────────────────────────────────────────────────
function getConfig(clave) {
  const r = get(`SELECT valor FROM config WHERE clave = ?`, [clave]);
  return r ? r.valor : null;
}

function setConfig(clave, valor) {
  run(`INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)`, [clave, valor]);
}

function todaConfig() {
  return Object.fromEntries(all(`SELECT clave, valor FROM config`).map(r => [r.clave, r.valor]));
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function stats() {
  const total   = get(`SELECT COUNT(*) c FROM ips`).c;
  const online  = get(`SELECT COUNT(*) c FROM ips WHERE caido_desde IS NULL`).c;
  const offline = total - online;
  const pingsHoy = get(`SELECT COUNT(*) c FROM ping_log WHERE fecha >= date('now','localtime')`).c;
  return { total, online, offline, pingsHoy };
}

module.exports = {
  inicializarDB,
  listarIPs, agregarIP, editarIP, eliminarIP,
  marcarCaida, marcarAlertaEnviada, marcarRecuperada, segundosCaida,
  registrarPing, historialIP, logReciente,
  getConfig, setConfig, todaConfig, stats
};