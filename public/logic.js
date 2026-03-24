// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch('/api' + path, opts);
  return r.json();
}
const GET    = p    => api('GET',    p);
const POST   = (p,b) => api('POST',   p, b);
const PUT    = (p,b) => api('PUT',    p, b);
const DELETE = p    => api('DELETE', p);

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Navegación ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('visible'));
    item.classList.add('active');
    const page = item.dataset.page;
    document.getElementById('page-' + page).classList.add('visible');
    if (page === 'logs')   cargarLogs();
    if (page === 'config') cargarConfig();
    if (page === 'ips')    renderIPsPage();
  });
});

// ── Datos ─────────────────────────────────────────────────────────────────────
let ipsData = [];

async function cargarTodo() {
  try {
    const [ips, stats] = await Promise.all([GET('/ips'), GET('/stats')]);
    ipsData = ips;
    actualizarStats(stats);
    renderDashboard(ips);
    renderIPsPage();
    document.getElementById('last-update').textContent =
      'Actualizado: ' + new Date().toLocaleTimeString('es-DO');
  } catch(e) {
    toast('Error de conexión con el servidor', 'err');
  }
}

function actualizarStats(s) {
  document.getElementById('st-online').textContent  = s.online;
  document.getElementById('st-offline').textContent = s.offline;
  document.getElementById('st-total').textContent   = s.total;
  document.getElementById('st-pings').textContent   = s.pingsHoy;
  document.getElementById('sb-online').textContent  = s.online;
  document.getElementById('sb-offline').textContent = s.offline;
  document.getElementById('sb-total').textContent   = s.total;
}

// ── Dashboard table ───────────────────────────────────────────────────────────
async function renderDashboard(ips) {
  const tbody = document.getElementById('dashboard-table');
  if (!ips.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-icon">◎</div><div class="empty-text">No hay IPs registradas</div><div class="empty-sub">Agrega una IP para comenzar a monitorear</div></div></td></tr>`;
    return;
  }

  // Cargar historial de todas en paralelo
  const histories = await Promise.all(ips.map(ip => GET(`/ips/${ip.id}/historial`).catch(() => [])));

  tbody.innerHTML = ips.map((ip, i) => {
    const hist = histories[i] || [];
    const online = !ip.caido_desde;
    const pill = online
      ? `<span class="pill pill-online"><span class="pill-dot"></span>Online</span>`
      : `<span class="pill pill-offline"><span class="pill-dot"></span>Offline</span>`;

    const ms = ip.ultimo_tiempo;
    let msHtml = `<span class="ms-value">—</span>`;
    if (ms !== null && ms !== undefined && online) {
      const cls = ms < 50 ? 'ms-good' : ms < 200 ? '' : 'ms-slow';
      msHtml = `<span class="ms-value ${cls}">${Math.round(ms)} ms</span>`;
    }

    const tiempo = ip.ultimo_check
      ? `<span class="time-value">${formatTime(ip.ultimo_check)}</span>`
      : `<span class="time-value">—</span>`;

    // Spark bars
    const reversed = [...hist].reverse();
    const sparks = reversed.map(h => {
      const color = h.estado === 'up' ? 'var(--green)' : 'var(--red)';
      const h_px = h.estado === 'up' ? (h.tiempo_ms ? Math.min(24, Math.max(6, Math.round(h.tiempo_ms / 5))) : 16) : 24;
      return `<div class="spark-bar" style="height:${h_px}px;background:${color};opacity:${h.estado==='up'?'0.7':'0.9'}"></div>`;
    }).join('');

    return `<tr>
      <td>
        <a href="http://${ip.ip}" target="_blank" rel="noopener" class="ip-link" title="Abrir http://${ip.ip}">
          ${ip.ip} <span class="ip-link-arrow">↗</span>
        </a>
        ${ip.nombre ? `<div class="ip-name">${ip.nombre}</div>` : ''}
      </td>
      <td>${pill}</td>
      <td>${msHtml}</td>
      <td>${tiempo}</td>
      <td>
        <div class="spark" style="cursor:pointer" onclick="abrirHist(${ip.id},'${ip.ip}',${i})">${sparks || '<span style="color:var(--text3);font-size:11px">sin datos</span>'}</div>
      </td>
      <td style="text-align:right">
        <button class="btn btn-ghost btn-sm" onclick="editarIP(${ip.id})">✎</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarIP(${ip.id},'${ip.ip}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

// ── IPs page ──────────────────────────────────────────────────────────────────
function renderIPsPage() {
  const tbody = document.getElementById('ips-table');
  if (!ipsData.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-icon">◉</div><div class="empty-text">Sin IPs registradas</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = ipsData.map(ip => {
    const online = !ip.caido_desde;
    const pill = online
      ? `<span class="pill pill-online"><span class="pill-dot"></span>Online</span>`
      : `<span class="pill pill-offline"><span class="pill-dot"></span>Offline</span>`;
    const caida = !online && ip.caido_desde
      ? `<span class="time-value" style="color:var(--red)">${formatTime(ip.caido_desde)}</span>`
      : `<span style="color:var(--text3)">—</span>`;
    return `<tr>
      <td>
        <a href="http://${ip.ip}" target="_blank" rel="noopener" class="ip-link" title="Abrir http://${ip.ip}">
          ${ip.ip} <span class="ip-link-arrow">↗</span>
        </a>
      </td>
      <td class="ip-name">${ip.nombre || '—'}</td>
      <td>${pill}</td>
      <td>${caida}</td>
      <td style="text-align:right">
        <button class="btn btn-ghost btn-sm" onclick="editarIP(${ip.id})">✎ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarIP(${ip.id},'${ip.ip}')">✕ Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Modal IP ──────────────────────────────────────────────────────────────────
function abrirModal(id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-id').value = id || '';
  document.getElementById('modal-ip').value = '';
  document.getElementById('modal-nombre').value = '';
  document.getElementById('modal-title').textContent = id ? 'Editar IP' : 'Agregar IP';
  if (id) {
    const ip = ipsData.find(i => i.id === id);
    if (ip) {
      document.getElementById('modal-ip').value = ip.ip;
      document.getElementById('modal-nombre').value = ip.nombre || '';
    }
  }
  setTimeout(() => document.getElementById('modal-ip').focus(), 50);
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

async function guardarIP() {
  const id    = document.getElementById('modal-id').value;
  const ip    = document.getElementById('modal-ip').value.trim();
  const nombre = document.getElementById('modal-nombre').value.trim();
  if (!ip) { toast('Escribe una IP o host', 'err'); return; }

  let res;
  if (id) res = await PUT(`/ips/${id}`, { ip, nombre });
  else     res = await POST('/ips', { ip, nombre });

  if (res.ok) {
    toast(id ? 'IP actualizada' : 'IP agregada correctamente');
    cerrarModal();
    cargarTodo();
  } else {
    toast(res.error || 'Error guardando', 'err');
  }
}

function editarIP(id) {
  abrirModal(id);
}

async function eliminarIP(id, ip) {
  if (!confirm(`¿Eliminar ${ip} del monitoreo?`)) return;
  const res = await DELETE(`/ips/${id}`);
  if (res.ok) { toast('IP eliminada'); cargarTodo(); }
  else toast('Error eliminando', 'err');
}

// ── Historial modal ───────────────────────────────────────────────────────────
let histData = [];

async function abrirHist(id, ip, idx) {
  document.getElementById('hist-overlay').classList.remove('hidden');
  document.getElementById('hist-title').textContent = `Historial — ${ip}`;
  const hist = await GET(`/ips/${id}/historial`);
  histData = hist;
  const grid = document.getElementById('hist-grid');
  const reversed = [...hist].reverse();
  grid.innerHTML = reversed.map(h =>
    `<div class="hist-cell ${h.estado === 'up' ? 'hist-up' : 'hist-down'}" title="${h.fecha} — ${h.estado === 'up' ? h.tiempo_ms + 'ms' : 'sin respuesta'}"></div>`
  ).join('') + Array(60 - reversed.length).fill(`<div class="hist-cell hist-none"></div>`).join('');
  const ups = hist.filter(h => h.estado === 'up').length;
  const pct = hist.length ? Math.round((ups / hist.length) * 100) : 0;
  document.getElementById('hist-info').innerHTML =
    `<span>Uptime: <strong style="color:var(--green)">${pct}%</strong></span>
     <span>${hist.length} registros</span>
     <span>Último: ${hist.length ? formatTime(hist[0].fecha) : '—'}</span>`;
}

function cerrarHist() {
  document.getElementById('hist-overlay').classList.add('hidden');
}

// ── Logs ──────────────────────────────────────────────────────────────────────
async function cargarLogs() {
  const logs = await GET('/logs');
  const el = document.getElementById('log-list');
  if (!logs.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">◎</div><div class="empty-text">Sin actividad registrada</div></div>`;
    return;
  }
  el.innerHTML = logs.map(l => {
    const dot = l.estado === 'up' ? '●' : '●';
    const cls = l.estado === 'up' ? 'dot-green' : 'dot-red';
    const ms = l.estado === 'up' && l.tiempo_ms ? `${Math.round(l.tiempo_ms)}ms` : '—';
    const name = l.nombre ? `<span style="color:var(--text2)">${l.nombre}</span> ` : '';
    return `<div class="log-item">
      <span class="${cls}" style="font-size:10px">${dot}</span>
      <span class="log-ip">${name}${l.ip}</span>
      <span class="log-ms">${ms}</span>
      <span class="log-time">${formatTime(l.fecha)}</span>
    </div>`;
  }).join('');
}

// ── Config ────────────────────────────────────────────────────────────────────
async function cargarConfig() {
  const cfg = await GET('/config');
  document.getElementById('cfg-smtp-host').value = cfg.smtp_host || '';
  document.getElementById('cfg-smtp-port').value = cfg.smtp_port || '587';
  document.getElementById('cfg-smtp-user').value = cfg.smtp_user || '';
  document.getElementById('cfg-smtp-pass').value = cfg.smtp_pass === '••••••••' ? '' : '';
  document.getElementById('cfg-destino').value   = cfg.correo_destino || '';
  setSelect('cfg-intervalo', cfg.intervalo_seg || '60');
  setSelect('cfg-minutos',   cfg.minutos_alerta || '3');
}

function setSelect(id, val) {
  const el = document.getElementById(id);
  for (const opt of el.options) if (opt.value === val) { opt.selected = true; break; }
}

async function guardarConfig() {
  const body = {
    smtp_host:      document.getElementById('cfg-smtp-host').value,
    smtp_port:      document.getElementById('cfg-smtp-port').value,
    smtp_user:      document.getElementById('cfg-smtp-user').value,
    smtp_pass:      document.getElementById('cfg-smtp-pass').value,
    correo_destino: document.getElementById('cfg-destino').value,
    intervalo_seg:  document.getElementById('cfg-intervalo').value,
    minutos_alerta: document.getElementById('cfg-minutos').value,
  };
  const res = await POST('/config', body);
  if (res.ok) toast('Configuración guardada. Monitor reiniciado.');
  else toast('Error guardando config', 'err');
}

async function testCorreo() {
  toast('Enviando correo de prueba...', 'info');
  const res = await POST('/test-correo', {});
  toast(res.msg, res.ok ? 'ok' : 'err');
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff/60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString('es-DO');
}

// ── Teclas de modal ───────────────────────────────────────────────────────────
document.getElementById('modal-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') guardarIP(); });
document.getElementById('modal-ip').addEventListener('keydown', e => { if (e.key === 'Enter') guardarIP(); });
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) cerrarModal(); });
document.getElementById('hist-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) cerrarHist(); });

// ── Plantilla Excel ───────────────────────────────────────────────────────────
function descargarPlantilla() {
  // Hoja principal con ejemplo
  const datos = [
    { 'IP': '192.168.1.1',   'Nombre': 'Router principal' },
    { 'IP': '192.168.1.10',  'Nombre': 'Servidor NAS' },
    { 'IP': '192.168.1.25',  'Nombre': 'PC Recepción' },
    { 'IP': '192.168.1.50',  'Nombre': 'Impresora HP' },
    { 'IP': 'servidor.local','Nombre': 'Servidor web interno' },
  ];
  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [{ wch: 22 }, { wch: 30 }];

  // Estilo cabecera verde
  ['A1','B1'].forEach(addr => {
    if (ws[addr]) ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '006644' } },
      alignment: { horizontal: 'center' }
    };
  });

  // Hoja de instrucciones
  const instrucciones = [
    { 'Campo':  'IP',     'Tipo': 'Requerido', 'Descripción': 'Dirección IPv4 (ej: 192.168.1.1) o hostname (ej: servidor.local)' },
    { 'Campo':  'Nombre', 'Tipo': 'Opcional',  'Descripción': 'Etiqueta descriptiva del dispositivo. Si se omite queda vacío.' },
    { 'Campo':  '',       'Tipo': '',           'Descripción': '' },
    { 'Campo':  'NOTAS',  'Tipo': '',           'Descripción': 'Las columnas adicionales (MAC, Fabricante, Ping, etc.) se ignoran.' },
    { 'Campo':  '',       'Tipo': '',           'Descripción': 'Las filas con IP duplicada o formato inválido se omiten.' },
    { 'Campo':  '',       'Tipo': '',           'Descripción': 'Puedes usar este mismo archivo exportado del escáner para reimportar.' },
  ];
  const wsI = XLSX.utils.json_to_sheet(instrucciones);
  wsI['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws,  'IPs a Importar');
  XLSX.utils.book_append_sheet(wb, wsI, 'Instrucciones');
  XLSX.writeFile(wb, 'plantilla_monitor_ips.xlsx');
  toast('Plantilla descargada', 'ok');
}

// ── Importar Excel ────────────────────────────────────────────────────────────
let importFilas = []; // filas parseadas y validadas

function abrirImport() {
  importFilas = [];
  document.getElementById('import-preview').style.display    = 'none';
  document.getElementById('btn-confirmar-import').style.display = 'none';
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-overlay').classList.remove('hidden');
}

function cerrarImport() {
  document.getElementById('import-overlay').classList.add('hidden');
  importFilas = [];
}

async function leerArchivoImport(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls'].includes(ext)) { toast('Solo se aceptan archivos .xlsx o .xls', 'err'); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, { type: 'array' });

      // Leer primera hoja
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) { toast('El archivo está vacío o no tiene datos', 'err'); return; }

      // Obtener IPs ya monitoreadas para detectar duplicados
      const monitoreadas = await GET('/ips');
      const ipsExistentes = new Set((monitoreadas || []).map(i => i.ip.trim().toLowerCase()));

      // Validar filas — buscar columna IP con nombres alternativos
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      importFilas = rows.map((row, idx) => {
        // Buscar columna IP con variantes de nombre
        const ipVal = (
          row['IP'] || row['ip'] || row['Ip'] ||
          row['IP / Host'] || row['IP/Host'] || ''
        ).toString().trim();

        const nombre = (
          row['Nombre'] || row['nombre'] || row['Name'] || row['name'] || ''
        ).toString().trim();

        let estado, mensaje;
        if (!ipVal) {
          estado = 'err'; mensaje = 'Sin IP';
        } else if (!ipRegex.test(ipVal)) {
          estado = 'err'; mensaje = 'Formato inválido';
        } else if (ipsExistentes.has(ipVal.toLowerCase())) {
          estado = 'dup'; mensaje = 'Ya monitoreada';
        } else {
          estado = 'ok'; mensaje = 'Lista para agregar';
        }
        return { num: idx + 1, ip: ipVal, nombre, estado, mensaje };
      });

      renderizarPreviewImport();
    } catch (err) {
      toast('Error leyendo el archivo: ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderizarPreviewImport() {
  const ok  = importFilas.filter(r => r.estado === 'ok').length;
  const dup = importFilas.filter(r => r.estado === 'dup').length;
  const err = importFilas.filter(r => r.estado === 'err').length;

  document.getElementById('imp-total').textContent = importFilas.length;
  document.getElementById('imp-ok').textContent    = ok;
  document.getElementById('imp-dup').textContent   = dup;
  document.getElementById('imp-err').textContent   = err;

  document.getElementById('import-preview-title').textContent =
    `Vista previa — ${importFilas.length} fila${importFilas.length !== 1 ? 's' : ''} detectada${importFilas.length !== 1 ? 's' : ''}`;

  document.getElementById('import-table-body').innerHTML = importFilas.map(r => {
    const rowCls = `row-${r.estado}`;
    const badgeCls = `row-status-${r.estado}`;
    const badgeIcon = r.estado === 'ok' ? '✓' : r.estado === 'dup' ? '⚠' : '✕';
    const ipDisplay = r.ip
      ? `<span class="import-ip-val">${r.ip}</span>`
      : `<span style="color:var(--text3); font-family:var(--mono)">—</span>`;
    return `<tr class="${rowCls}">
      <td style="color:var(--text3); font-family:var(--mono); font-size:11px;">${r.num}</td>
      <td>${ipDisplay}</td>
      <td style="font-size:12px; color:var(--text2);">${r.nombre || '—'}</td>
      <td><span class="import-row-status ${badgeCls}">${badgeIcon} ${r.mensaje}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('import-preview').style.display = 'block';
  document.getElementById('btn-confirmar-import').style.display = ok > 0 ? 'inline-flex' : 'none';
  if (ok > 0) {
    document.getElementById('btn-confirmar-import').textContent = `↑ Agregar ${ok} IP${ok !== 1 ? 's' : ''} al monitoreo`;
  }
}

async function confirmarImport() {
  const validas = importFilas.filter(r => r.estado === 'ok');
  if (!validas.length) return;

  const btn = document.getElementById('btn-confirmar-import');
  btn.disabled = true;
  btn.textContent = 'Agregando...';

  let agregadas = 0, errores = 0;
  for (const fila of validas) {
    const res = await POST('/ips', { ip: fila.ip, nombre: fila.nombre });
    if (res.ok) agregadas++;
    else errores++;
  }

  cerrarImport();
  cargarTodo();

  if (agregadas > 0) toast(`${agregadas} IP${agregadas !== 1 ? 's' : ''} agregada${agregadas !== 1 ? 's' : ''} al monitoreo`, 'ok');
  if (errores   > 0) toast(`${errores} IP${errores !== 1 ? 's' : ''} no se pudo agregar`, 'err');
}

// Drag & drop en la zona de importación
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('import-drop-zone');
  if (!zone) return;
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) leerArchivoImport(file);
  });
  document.getElementById('import-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) cerrarImport();
  });
});

// ── Exportar Excel ────────────────────────────────────────────────────────────
async function exportarExcel() {
  const estado = await GET('/scan/status');
  const devices = (estado && estado.found) ? estado.found : [];
  if (!devices.length) { toast('No hay datos para exportar', 'err'); return; }

  const fechaScan = estado.finishedAt
    ? new Date(estado.finishedAt).toLocaleString('es-DO')
    : new Date().toLocaleString('es-DO');

  // Construir filas
  const filas = devices.map(d => ({
    'IP':              d.ip,
    'Hostname':        d.hostname !== '—' ? d.hostname : '',
    'MAC Address':     d.mac !== '—' ? d.mac : '',
    'Fabricante':      d.fabricante !== '—' && d.fabricante !== 'Desconocido' ? d.fabricante : '',
    'Ping (ms)':       d.ms != null ? Math.round(d.ms) : '',
    'URL':             `http://${d.ip}`,
    'Este equipo':     d.esPropio ? 'Sí' : 'No',
    'En monitoreo':    scanAddedIPs.has(d.ip) ? 'Sí' : 'No',
    'Fecha escaneo':   fechaScan,
  }));

  const ws = XLSX.utils.json_to_sheet(filas);

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 16 },  // IP
    { wch: 28 },  // Hostname
    { wch: 20 },  // MAC
    { wch: 18 },  // Fabricante
    { wch: 10 },  // Ping
    { wch: 22 },  // URL
    { wch: 12 },  // Este equipo
    { wch: 14 },  // En monitoreo
    { wch: 22 },  // Fecha
  ];

  // Estilo de cabecera (fila 1) — color verde oscuro
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = {
      font:    { bold: true, color: { rgb: 'FFFFFF' } },
      fill:    { fgColor: { rgb: '006644' } },
      alignment: { horizontal: 'center' }
    };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Escaneo de Red');

  // Hoja 2: resumen
  const resumen = [
    { 'Campo': 'Red escaneada',        'Valor': estado.subnet || '—' },
    { 'Campo': 'Total dispositivos',   'Valor': devices.length },
    { 'Campo': 'Con hostname',         'Valor': devices.filter(d => d.hostname !== '—').length },
    { 'Campo': 'Con MAC identificada', 'Valor': devices.filter(d => d.mac !== '—').length },
    { 'Campo': 'Agregados al monitoreo','Valor': scanAddedIPs.size },
    { 'Campo': 'Fecha del escaneo',    'Valor': fechaScan },
  ];
  const wsRes = XLSX.utils.json_to_sheet(resumen);
  wsRes['!cols'] = [{ wch: 26 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

  // Nombre de archivo con fecha
  const ahora = new Date();
  const stamp = `${ahora.getFullYear()}${String(ahora.getMonth()+1).padStart(2,'0')}${String(ahora.getDate()).padStart(2,'0')}_${String(ahora.getHours()).padStart(2,'0')}${String(ahora.getMinutes()).padStart(2,'0')}`;
  XLSX.writeFile(wb, `escaneo_red_${stamp}.xlsx`);
  toast(`Excel exportado — ${devices.length} dispositivos`, 'ok');
}

// ── Escáner de red ────────────────────────────────────────────────────────────
let scanInterval   = null;
let scanStartTime  = null;
let scanAddedIPs   = new Set(); // IPs ya agregadas al monitoreo en esta sesión
let scanResultsMap = {};        // ip → device data

async function iniciarEscaneo() {
  const res = await POST('/scan/start', {});
  if (!res.ok) { toast(res.error || 'No se pudo iniciar el escaneo', 'err'); return; }

  scanStartTime = Date.now();
  scanResultsMap = {};

  // Mostrar barra y ocultar estados previos
  document.getElementById('scan-progress-wrap').style.display = 'block';
  document.getElementById('scan-idle').style.display    = 'none';
  document.getElementById('scan-results').style.display = 'none';
  document.getElementById('btn-start-scan').style.display  = 'none';
  document.getElementById('btn-cancel-scan').style.display = 'inline-flex';
  document.getElementById('btn-start-scan').classList.add('btn-scanning');

  toast('Escaneando red local...', 'info');

  // Polling de estado
  scanInterval = setInterval(actualizarEscaneo, 1200);
  actualizarEscaneo();
}

async function actualizarEscaneo() {
  const estado = await GET('/scan/status');
  if (!estado) return;

  // Progreso
  const pct = estado.progress || 0;
  document.getElementById('scan-bar-fill').style.width    = pct + '%';
  document.getElementById('scan-progress-pct').textContent = pct + '%';
  document.getElementById('scan-checked').textContent    = estado.checked || 0;
  document.getElementById('scan-total').textContent      = estado.total   || 254;
  document.getElementById('scan-found-count').textContent = (estado.found || []).length;

  const elapsed = scanStartTime ? Math.round((Date.now() - scanStartTime) / 1000) : 0;
  document.getElementById('scan-elapsed').textContent = elapsed + 's';

  if (estado.subnet) {
    document.getElementById('scan-progress-label').textContent = `Escaneando ${estado.subnet}`;
  }

  // Renderizar resultados en tiempo real conforme llegan
  if (estado.found && estado.found.length > 0) {
    document.getElementById('scan-results').style.display = 'block';
    renderizarResultados(estado.found);
  }

  // Escaneo finalizado
  if (!estado.running && estado.finishedAt) {
    clearInterval(scanInterval);
    scanInterval = null;

    document.getElementById('scan-progress-wrap').style.display = 'none';
    document.getElementById('btn-start-scan').style.display  = 'inline-flex';
    document.getElementById('btn-cancel-scan').style.display = 'none';
    document.getElementById('btn-start-scan').classList.remove('btn-scanning');

    const n = (estado.found || []).length;
    document.getElementById('scan-results-title').textContent = `${n} dispositivo${n !== 1 ? 's' : ''} encontrado${n !== 1 ? 's' : ''}`;
    actualizarSummary(estado.found || []);

    if (n === 0) {
      document.getElementById('scan-idle').style.display  = 'block';
      document.getElementById('scan-results').style.display = 'none';
      document.getElementById('btn-export-excel').style.display = 'none';
      toast('No se encontraron dispositivos activos.', 'err');
    } else {
      document.getElementById('btn-export-excel').style.display = 'inline-flex';
      toast(`Escaneo completado — ${n} dispositivos encontrados`, 'ok');
    }
  }
}

function renderizarResultados(devices) {
  const tbody = document.getElementById('scan-table-body');
  tbody.innerHTML = devices.map(d => {
    const estaAgregada = scanAddedIPs.has(d.ip);
    const msClass = !d.ms ? '' : d.ms < 20 ? 'scan-ms-good' : d.ms < 100 ? 'scan-ms-ok' : 'scan-ms-slow';
    const msText  = d.ms != null ? `${Math.round(d.ms)} ms` : '—';
    const macText = d.mac && d.mac !== '—' ? d.mac : '<span style="color:var(--text3)">—</span>';
    const fabText = d.fabricante && d.fabricante !== '—' && d.fabricante !== 'Desconocido'
      ? `<span style="color:var(--text)">${d.fabricante}</span>`
      : `<span style="color:var(--text3)">${d.fabricante || '—'}</span>`;
    const hostnameText = d.hostname && d.hostname !== '—'
      ? `<span class="scan-hostname">${d.hostname}</span>`
      : `<span style="color:var(--text3); font-size:11px; font-family:var(--mono)">—</span>`;

    const ipLinkClass = d.esPropio ? 'scan-ip-link scan-ip-own' : 'scan-ip-link';
    const ownBadge    = d.esPropio ? `<span class="scan-ip-badge">ESTE EQUIPO</span>` : '';

    const btnLabel = estaAgregada ? '✓ Agregada' : '＋ Monitorear';
    const btnCls   = estaAgregada ? 'btn-add-monitor added' : 'btn-add-monitor';
    const btnDis   = estaAgregada ? 'disabled' : '';

    return `<tr>
      <td>
        <a href="http://${d.ip}" target="_blank" rel="noopener" class="${ipLinkClass}" title="Abrir http://${d.ip}">
          ${d.ip} <span style="font-size:10px;opacity:0.5">↗</span>
        </a>
        ${ownBadge}
      </td>
      <td>${hostnameText}</td>
      <td><span class="scan-mac">${macText}</span></td>
      <td>${fabText}</td>
      <td><span class="scan-ms ${msClass}">${msText}</span></td>
      <td>
        <button class="${btnCls}" onclick="agregarDesdeScanner('${d.ip}', '${(d.hostname !== '—' ? d.hostname : '')}', '${d.fabricante || ''}')" ${btnDis}>
          ${btnLabel}
        </button>
      </td>
    </tr>`;
  }).join('');
}

function actualizarSummary(devices) {
  const withHostname = devices.filter(d => d.hostname && d.hostname !== '—').length;
  const withMac      = devices.filter(d => d.mac && d.mac !== '—').length;
  document.getElementById('sum-total').textContent    = devices.length;
  document.getElementById('sum-hostname').textContent = withHostname;
  document.getElementById('sum-mac').textContent      = withMac;
  document.getElementById('sum-added').textContent    = scanAddedIPs.size;
  document.getElementById('scan-summary-bar').style.display = 'flex';
}

async function agregarDesdeScanner(ip, hostname, fabricante) {
  // Sugerir nombre basado en hostname o fabricante
  const nombreSugerido = hostname && hostname !== '—'
    ? hostname.split('.')[0]
    : fabricante && fabricante !== 'Desconocido' && fabricante !== '—'
    ? fabricante
    : '';

  const res = await POST('/ips', { ip, nombre: nombreSugerido });
  if (res.ok) {
    scanAddedIPs.add(ip);
    document.getElementById('sum-added').textContent = scanAddedIPs.size;
    toast(`${ip} agregada al monitoreo`);
    // Re-renderizar para marcar el botón
    const estado = await GET('/scan/status');
    if (estado && estado.found) renderizarResultados(estado.found);
  } else {
    toast(res.error || 'Error agregando IP', 'err');
  }
}

async function cancelarEscaneo() {
  await POST('/scan/cancel', {});
  clearInterval(scanInterval);
  scanInterval = null;
  document.getElementById('scan-progress-wrap').style.display = 'none';
  document.getElementById('btn-start-scan').style.display  = 'inline-flex';
  document.getElementById('btn-cancel-scan').style.display = 'none';
  document.getElementById('btn-start-scan').classList.remove('btn-scanning');
  toast('Escaneo cancelado', 'info');
}

// Detectar subred al cargar
async function inicializarScanner() {
  const red = await GET('/scan/network');
  if (red && red.base) {
    document.getElementById('scan-subnet-label').textContent = `Red detectada: ${red.base}.0/24 · Interfaz: ${red.iface}`;
  } else {
    document.getElementById('scan-subnet-label').textContent = 'No se pudo detectar la red local';
  }
  // Si hay un escaneo corriendo (ej. recarga de página), reconectar
  const estado = await GET('/scan/status');
  if (estado && estado.running) {
    scanStartTime = new Date(estado.startedAt).getTime();
    document.getElementById('scan-progress-wrap').style.display = 'block';
    document.getElementById('scan-idle').style.display    = 'none';
    document.getElementById('btn-start-scan').style.display  = 'none';
    document.getElementById('btn-cancel-scan').style.display = 'inline-flex';
    scanInterval = setInterval(actualizarEscaneo, 1200);
  } else if (estado && estado.found && estado.found.length > 0) {
    // Mostrar resultados del último escaneo
    document.getElementById('scan-idle').style.display   = 'none';
    document.getElementById('scan-results').style.display = 'block';
    document.getElementById('btn-export-excel').style.display = 'inline-flex';
    const n = estado.found.length;
    document.getElementById('scan-results-title').textContent = `${n} dispositivo${n !== 1 ? 's' : ''} encontrado${n !== 1 ? 's' : ''} (último escaneo)`;
    renderizarResultados(estado.found);
    actualizarSummary(estado.found);
  }
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────
cargarTodo();
setInterval(cargarTodo, 15000); // refrescar cada 15s
inicializarScanner();