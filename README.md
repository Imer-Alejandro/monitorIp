# Monitor de IPs 🔍

Monitor de IPs con ping continuo, alertas por correo y dashboard web.
Corre como servicio de Windows en segundo plano, incluso con la ventana cerrada.

---

## Instalación rápida

### 1. Instalar dependencias

```bash
npm install
```

### 2. Probar en modo desarrollo

```bash
npm start
```
Abre http://localhost:3000 y configura el correo desde el panel.

---

## Generar el .exe

### 1. Instalar pkg globalmente (solo una vez)

```bash
npm install -g pkg
```

### 2. Compilar

```bash
npm run build
```

Genera: `dist/MonitorIP.exe`

> ⚠️ IMPORTANTE: `better-sqlite3` requiere un binding nativo.
> Si `pkg` falla con el binario nativo, usa el workaround:
>
> ```bash
> npm install -g pkg
> pkg . --targets node20-win-x64 --output dist/MonitorIP.exe --public
> ```
>
> Alternativa más simple: usar `nexe` o distribuir con Node.js incluido via `caxa`:
> ```bash
> npm install -g caxa
> caxa --input . --output dist/MonitorIP.exe -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/index.js"
> ```

---

## Instalar como servicio de Windows

Ejecuta **como Administrador**:

```cmd
MonitorIP.exe --install
```

Esto:
- Registra el servicio `MonitorIP` en Windows
- Lo configura para arrancar automáticamente con el sistema
- Lo inicia de inmediato

El dashboard queda disponible en: **http://localhost:3000**

### Desinstalar el servicio

```cmd
MonitorIP.exe --uninstall
```

---

## Uso del Dashboard

| Sección | Descripción |
|---|---|
| Dashboard | Vista general con estado de todas las IPs |
| Gestión de IPs | Agregar, editar y eliminar IPs |
| Actividad | Log de los últimos 100 pings |
| Configuración | SMTP, intervalo de ping, umbral de alerta |

---

## Configuración de correo (Gmail)

1. Activa la verificación en dos pasos en tu cuenta Google
2. Ve a: Cuenta → Seguridad → Contraseñas de aplicación
3. Genera una contraseña para "Correo / Windows"
4. En el Dashboard → Configuración ingresa:
   - **SMTP Host**: `smtp.gmail.com`
   - **Puerto**: `587`
   - **Usuario**: `tu@gmail.com`
   - **Contraseña**: la contraseña de aplicación generada
   - **Correo destino**: quien recibe las alertas

---

## Lógica de alertas

- El monitor hace ping a cada IP cada N segundos (configurable, por defecto 60s)
- Si una IP no responde, registra el timestamp de la primera caída
- Si lleva **X minutos** sin responder (por defecto 3 min), envía el correo de alerta
- **No envía más correos** hasta que la IP se recupere
- Cuando se recupera, envía un correo de recuperación
- Si eliminas la IP, el monitoreo se detiene completamente

---

## Estructura del proyecto

```
ip-monitor/
├── index.js       ← Entrada principal (servidor + monitor)
├── db.js          ← Base de datos SQLite
├── mailer.js      ← Envío de correos
├── monitor.js     ← Loop de ping
├── api.js         ← API REST Express
├── service.js     ← Lógica de servicio Windows
├── public/
│   └── index.html ← Dashboard web
└── package.json
```

La base de datos `ips.db` se crea automáticamente junto al `.exe`.

---

## Comandos útiles (gestión del servicio)

```cmd
# Ver estado del servicio
sc query MonitorIP

# Detener el servicio
sc stop MonitorIP

# Iniciar el servicio
sc start MonitorIP

# Ver logs del servicio (Event Viewer)
eventvwr
```
