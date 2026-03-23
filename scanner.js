/**
 * scanner.js
 * Escáner de red local — detecta dispositivos activos con IP, ping, hostname, MAC y fabricante.
 */

const os      = require('os');
const dns     = require('dns');
const { exec } = require('child_process');
const ping    = require('ping');

// ── Estado global del escaneo ────────────────────────────────────────────────
let scanState = {
  running:   false,
  progress:  0,      // 0-100
  total:     0,
  checked:   0,
  found:     [],
  startedAt: null,
  finishedAt: null,
  subnet:    null,
  error:     null
};

// ── OUI Database (fabricantes más comunes) ────────────────────────────────────
// Prefijo MAC (primeros 6 hex) → fabricante
const OUI_DB = {
  // Apple
  '000393':'Apple','000502':'Apple','000A27':'Apple','000A95':'Apple',
  '001124':'Apple','001451':'Apple','0016CB':'Apple','0017F2':'Apple',
  '001EC2':'Apple','002312':'Apple','002500':'Apple','0026B9':'Apple',
  '0050E4':'Apple','689C70':'Apple','6C40088':'Apple','78CA39':'Apple',
  'A45E60':'Apple','B8E856':'Apple','D0E140':'Apple','F0B479':'Apple',
  // Samsung
  '0007AB':'Samsung','000DB9':'Samsung','001247':'Samsung','0015B9':'Samsung',
  '001632':'Samsung','0017C9':'Samsung','001A8A':'Samsung','001BFC':'Samsung',
  '001D25':'Samsung','001EE2':'Samsung','002119':'Samsung','0024E9':'Samsung',
  '002566':'Samsung','0026E2':'Samsung','08D4B1':'Samsung','28987B':'Samsung',
  '2C0E3D':'Samsung','38ECE4':'Samsung','5001BB':'Samsung','8C7712':'Samsung',
  // Cisco
  '000142':'Cisco','000164':'Cisco','0001C7':'Cisco','000216':'Cisco',
  '00023A':'Cisco','000268':'Cisco','0002B9':'Cisco','0002FC':'Cisco',
  '000340':'Cisco','000374':'Cisco','0003E3':'Cisco','0003FD':'Cisco',
  '000402':'Cisco','000476':'Cisco','000480':'Cisco','0004C0':'Cisco',
  '0004DD':'Cisco','000503':'Cisco','00059A':'Cisco','0005DC':'Cisco',
  // TP-Link
  '001D0F':'TP-Link','0025B3':'TP-Link','14CC20':'TP-Link','1C61B4':'TP-Link',
  '2088B4':'TP-Link','246895':'TP-Link','50BD5F':'TP-Link','54E6FC':'TP-Link',
  '60E3270':'TP-Link','64708142':'TP-Link','6C5AB0':'TP-Link','881DFC':'TP-Link',
  'B0487A':'TP-Link','B4B024':'TP-Link','C46E1F':'TP-Link','D46E5C':'TP-Link',
  'E848B8':'TP-Link','EC172F':'TP-Link','F09FC2':'TP-Link','F4F26D':'TP-Link',
  // Mikrotik
  '000C42':'MikroTik','18FD74':'MikroTik','2CC8FB':'MikroTik','4C5E0C':'MikroTik',
  '6C3B6B':'MikroTik','8C88C5':'MikroTik','B8690E':'MikroTik','CC2DE0':'MikroTik',
  'D4CA6D':'MikroTik','E48D8C':'MikroTik',
  // D-Link
  '00179A':'D-Link','001195':'D-Link','0015E9':'D-Link','0021910':'D-Link',
  '1C7EE5':'D-Link','283B82':'D-Link','340804':'D-Link','5CD998':'D-Link',
  '6045CB':'D-Link','84C9B2':'D-Link','90948E':'D-Link','B8A386':'D-Link',
  'C8BE19':'D-Link','F07D68':'D-Link',
  // Ubiquiti
  '002722':'Ubiquiti','04182D':'Ubiquiti','0418D6':'Ubiquiti','44D9E7':'Ubiquiti',
  '687226':'Ubiquiti','788A20':'Ubiquiti','802AA8':'Ubiquiti','9C0550':'Ubiquiti',
  'B4FBE4':'Ubiquiti','DC9FDB':'Ubiquiti','E063DA':'Ubiquiti','F09FC2':'Ubiquiti',
  'FC:EC:DA':'Ubiquiti',
  // HP
  '001708':'HP','0017A4':'HP','001CC4':'HP','001E0B':'HP','001F29':'HP',
  '002564':'HP','0025B3':'HP','281878':'HP','3C4A92':'HP','9CB654':'HP',
  // Dell
  '001143':'Dell','001422':'Dell','001A4B':'Dell','001E4F':'Dell','002564':'Dell',
  '0026B9':'Dell','18A99B':'Dell','1C40AF':'Dell','5C260A':'Dell','848F69':'Dell',
  // Intel
  '001111':'Intel','00126F':'Intel','001302':'Intel','001517':'Intel',
  '001676':'Intel','0016EA':'Intel','0016EB':'Intel','001760':'Intel',
  '001761':'Intel','001762':'Intel','8086F2':'Intel',
  // Realtek
  '00E04C':'Realtek','001125':'Realtek','E09188':'Realtek',
  // VMware
  '000C29':'VMware','000569':'VMware','001C14':'VMware','005056':'VMware',
  // Raspberry Pi
  'B827EB':'Raspberry Pi','DC:A6:32':'Raspberry Pi','E4:5F:01':'Raspberry Pi',
  // Google
  '3C5AB4':'Google','54606F':'Google','6C5C14':'Google','F88FCA':'Google',
  // Amazon (Echo, Kindle, etc.)
  '0C8268':'Amazon','34D270':'Amazon','40B4CD':'Amazon','44650D':'Amazon',
  '680571':'Amazon','78E103':'Amazon','84D6D0':'Amazon','A002DC':'Amazon',
  // Huawei
  '001E10':'Huawei','002568':'Huawei','0025685':'Huawei','00259E':'Huawei',
  '001888':'Huawei','286ED4':'Huawei','3C47C9':'Huawei','48DB50':'Huawei',
  '4C1FAB':'Huawei','544A16':'Huawei','6C8D6F':'Huawei','78D752':'Huawei',
  '8C0D76':'Huawei','9C37F4':'Huawei','A09469':'Huawei','B8BC1B':'Huawei',
  'CC53B5':'Huawei','E8CD2D':'Huawei','F48E92':'Huawei',
  // Netgear
  '00095B':'NETGEAR','000FB5':'NETGEAR','001301':'NETGEAR','001443':'NETGEAR',
  '001E2A':'NETGEAR','00224B':'NETGEAR','00265A':'NETGEAR','20E52A':'NETGEAR',
  '28C68E':'NETGEAR','2C3033':'NETGEAR','30469A':'NETGEAR','40167E':'NETGEAR',
  '44940C':'NETGEAR','4F271B':'NETGEAR','6CB0CE':'NETGEAR','9C3DCF':'NETGEAR',
  'A040A0':'NETGEAR','C03F0E':'NETGEAR','E091F5':'NETGEAR',
};

function buscarFabricante(mac) {
  if (!mac || mac === '—') return '—';
  // Normalizar: quitar separadores y poner en mayúsculas
  const clean = mac.replace(/[:\-\.]/g, '').toUpperCase();
  const prefix6 = clean.substring(0, 6);
  if (OUI_DB[prefix6]) return OUI_DB[prefix6];
  // Intentar con formato alternativo (algunos tienen separador)
  const prefixFmt = mac.substring(0, 8).toUpperCase();
  for (const [k, v] of Object.entries(OUI_DB)) {
    if (k.replace(/[:\-]/g, '').toUpperCase() === prefix6) return v;
  }
  return 'Desconocido';
}

// ── Auto-detectar red local ───────────────────────────────────────────────────
function detectarSubred() {
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // Construir base de subred /24
        const parts = addr.address.split('.');
        return {
          base:    `${parts[0]}.${parts[1]}.${parts[2]}`,
          myIP:    addr.address,
          netmask: addr.netmask,
          iface:   name
        };
      }
    }
  }
  return null;
}

// ── Resolver hostname ─────────────────────────────────────────────────────────
function resolverHostname(ip) {
  return new Promise(resolve => {
    dns.reverse(ip, (err, hostnames) => {
      if (err || !hostnames || !hostnames.length) resolve('—');
      else resolve(hostnames[0]);
    });
  });
}

// ── Leer tabla ARP ────────────────────────────────────────────────────────────
function leerTablaARP() {
  return new Promise(resolve => {
    exec('arp -a', (err, stdout) => {
      if (err) return resolve({});
      const tabla = {};
      const lines = stdout.split('\n');
      for (const line of lines) {
        // Formato Windows: "  192.168.1.1          aa-bb-cc-dd-ee-ff     dinamico"
        // Formato Linux:   "? (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on eth0"
        const winMatch = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})/);
        if (winMatch) {
          const mac = winMatch[2].replace(/-/g, ':').toUpperCase();
          tabla[winMatch[1]] = mac;
        }
      }
      resolve(tabla);
    });
  });
}

// ── Ping a una IP ─────────────────────────────────────────────────────────────
async function probarIP(ip) {
  try {
    const res = await ping.promise.probe(ip, { timeout: 2, min_reply: 1 });
    return {
      alive: res.alive,
      ms: res.alive && res.time !== 'unknown' ? parseFloat(res.time) : null
    };
  } catch {
    return { alive: false, ms: null };
  }
}

// ── Escaneo principal ─────────────────────────────────────────────────────────
async function iniciarEscaneo() {
  if (scanState.running) return { ok: false, error: 'Ya hay un escaneo en curso.' };

  const subred = detectarSubred();
  if (!subred) return { ok: false, error: 'No se pudo detectar la red local.' };

  // Reset estado
  scanState = {
    running: true,
    progress: 0,
    total: 254,
    checked: 0,
    found: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    subnet: subred.base + '.0/24',
    error: null
  };

  // Ejecutar en background
  _ejecutarEscaneo(subred).catch(e => {
    scanState.running = false;
    scanState.error = e.message;
  });

  return { ok: true, subnet: subred.base + '.0/24' };
}

async function _ejecutarEscaneo(subred) {
  const BATCH = 20; // IPs en paralelo por lote
  const ips = [];
  for (let i = 1; i <= 254; i++) ips.push(`${subred.base}.${i}`);

  // Leer ARP antes de empezar (para MACs de IPs ya conocidas)
  const arpTable = await leerTablaARP();

  for (let i = 0; i < ips.length; i += BATCH) {
    if (!scanState.running) break; // cancelado

    const lote = ips.slice(i, i + BATCH);
    const resultados = await Promise.all(lote.map(async (ip) => {
      const r = await probarIP(ip);
      scanState.checked++;
      scanState.progress = Math.round((scanState.checked / scanState.total) * 100);

      if (!r.alive) return null;

      // Solo para IPs activas: resolver hostname y MAC
      const [hostname, mac] = await Promise.all([
        resolverHostname(ip),
        Promise.resolve(arpTable[ip] || null)
      ]);

      // Si no estaba en ARP, ejecutar ping para forzar entrada ARP y re-leer
      let macFinal = mac;
      if (!macFinal) {
        // Esperar un momento para que el SO actualice ARP tras el ping
        await new Promise(r => setTimeout(r, 300));
        const arpNueva = await leerTablaARP();
        macFinal = arpNueva[ip] || '—';
        // Actualizar tabla en memoria
        Object.assign(arpTable, arpNueva);
      }

      const fabricante = buscarFabricante(macFinal);

      return {
        ip,
        ms:          r.ms,
        hostname,
        mac:         macFinal,
        fabricante,
        esPropio:    ip === subred.myIP,
        encontradoEn: new Date().toISOString()
      };
    }));

    // Agregar a found solo los activos
    for (const d of resultados) {
      if (d) scanState.found.push(d);
    }
  }

  // Leer ARP final para completar MACs faltantes
  const arpFinal = await leerTablaARP();
  for (const device of scanState.found) {
    if (device.mac === '—' && arpFinal[device.ip]) {
      device.mac = arpFinal[device.ip];
      device.fabricante = buscarFabricante(device.mac);
    }
  }

  // Ordenar por IP
  scanState.found.sort((a, b) => {
    const partsA = a.ip.split('.').map(Number);
    const partsB = b.ip.split('.').map(Number);
    return partsA[3] - partsB[3];
  });

  scanState.running    = false;
  scanState.progress   = 100;
  scanState.finishedAt = new Date().toISOString();
  console.log(`[SCANNER] Escaneo completado. ${scanState.found.length} dispositivos encontrados.`);
}

function cancelarEscaneo() {
  if (scanState.running) {
    scanState.running    = false;
    scanState.finishedAt = new Date().toISOString();
    return { ok: true };
  }
  return { ok: false, error: 'No hay escaneo en curso.' };
}

function estadoEscaneo() {
  return { ...scanState };
}

module.exports = { iniciarEscaneo, cancelarEscaneo, estadoEscaneo, detectarSubred };