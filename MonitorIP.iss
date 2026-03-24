; ══════════════════════════════════════════════════════════════════════════════
; MonitorIP — Script de instalación (Inno Setup 6)
; Genera: InstalarMonitorIP.exe
; ══════════════════════════════════════════════════════════════════════════════

#define AppName      "Monitor de IPs"
#define AppVersion   "1.0.0"
#define AppPublisher "MonitorIP"
#define AppExeName   "MonitorIP.exe"
#define ServiceName  "MonitorIP"
#define AppURL       "http://localhost:3000"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
DefaultDirName={autopf}\MonitorIP
DefaultGroupName={#AppName}
OutputDir=dist
OutputBaseFilename=InstalarMonitorIP
SetupIconFile=public\assets\logo.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
MinVersion=10.0
; Mostrar acuerdo
; LicenseFile=LICENSE.txt

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon";    Description: "Crear icono en el &Escritorio";      GroupDescription: "Iconos adicionales:"; Flags: checkedonce
Name: "startmenuicon";  Description: "Crear icono en el menú &Inicio";     GroupDescription: "Iconos adicionales:"; Flags: checkedonce
Name: "openbrowser";    Description: "Abrir el dashboard al finalizar";     GroupDescription: "Al terminar:";        Flags: checkedonce

[Files]
; Ejecutable principal (generado por pkg)
Source: "dist\MonitorIP.exe";     DestDir: "{app}";           Flags: ignoreversion

; NSSM — gestor de servicios de Windows
Source: "nssm.exe";               DestDir: "{app}";           Flags: ignoreversion

; Carpeta public completa (dashboard web)
Source: "public\*";               DestDir: "{app}\public";    Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Acceso directo en escritorio → abre el dashboard en el navegador
Name: "{autodesktop}\{#AppName}"; Filename: "{sys}\cmd.exe"; \
  Parameters: "/c start http://localhost:3000"; \
  IconFilename: "{app}\public\assets\logo.ico"; \
  Tasks: desktopicon; \
  Comment: "Abrir dashboard del Monitor de IPs"

; Acceso directo en menú inicio → igual
Name: "{group}\{#AppName}";       Filename: "{sys}\cmd.exe"; \
  Parameters: "/c start http://localhost:3000"; \
  IconFilename: "{app}\public\assets\logo.ico"; \
  Tasks: startmenuicon; \
  Comment: "Abrir dashboard del Monitor de IPs"

; Desinstalar desde menú inicio
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"

[Run]
; ── 1. Detener y eliminar servicio anterior (si existe de una instalación previa) ──
Filename: "{app}\nssm.exe"; Parameters: "stop {#ServiceName}";           \
  Flags: runhidden waituntilterminated; StatusMsg: "Deteniendo servicio anterior...";

Filename: "{app}\nssm.exe"; Parameters: "remove {#ServiceName} confirm"; \
  Flags: runhidden waituntilterminated; StatusMsg: "Eliminando servicio anterior...";

; ── 2. Instalar el servicio con NSSM ──────────────────────────────────────────
Filename: "{app}\nssm.exe"; \
  Parameters: "install {#ServiceName} ""{app}\{#AppExeName}"""; \
  Flags: runhidden waituntilterminated; StatusMsg: "Registrando servicio de Windows...";

; ── 3. Configurar propiedades del servicio ────────────────────────────────────
; Nombre visible en servicios de Windows
Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} DisplayName ""Monitor de IPs"""; \
  Flags: runhidden waituntilterminated;

; Descripción
Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} Description ""Monitorea dispositivos de red con ping y envía alertas por correo."""; \
  Flags: runhidden waituntilterminated;

; Directorio de trabajo (donde se guarda ips.db)
Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} AppDirectory ""{app}"""; \
  Flags: runhidden waituntilterminated;

; Arranque automático con Windows
Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} Start SERVICE_AUTO_START"; \
  Flags: runhidden waituntilterminated;

; Marcar como servicio (no abrir navegador automáticamente)
Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} AppEnvironmentExtra IS_SERVICE=1"; \
  Flags: runhidden waituntilterminated;

; Reiniciar automáticamente si el proceso muere (esperar 5 segundos)
Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} AppRestartDelay 5000"; \
  Flags: runhidden waituntilterminated;

; Redirigir stdout/stderr a log (opcional pero útil para diagnóstico)
Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} AppStdout ""{app}\monitor.log"""; \
  Flags: runhidden waituntilterminated;

Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} AppStderr ""{app}\monitor-error.log"""; \
  Flags: runhidden waituntilterminated;

; Rotar log cuando supere 10 MB
Filename: "{app}\nssm.exe"; \
  Parameters: "set {#ServiceName} AppStdoutCreationDisposition 4"; \
  Flags: runhidden waituntilterminated;

; ── 4. Iniciar el servicio ────────────────────────────────────────────────────
Filename: "{app}\nssm.exe"; \
  Parameters: "start {#ServiceName}"; \
  Flags: runhidden waituntilterminated; StatusMsg: "Iniciando servicio de monitoreo...";

; ── 5. Abrir dashboard en el navegador (tarea opcional) ───────────────────────
Filename: "{sys}\cmd.exe"; \
  Parameters: "/c timeout /t 3 /nobreak >nul && start http://localhost:3000"; \
  Flags: runhidden nowait; \
  Tasks: openbrowser; \
  StatusMsg: "Abriendo dashboard...";

[UninstallRun]
; Detener y eliminar el servicio al desinstalar
Filename: "{app}\nssm.exe"; Parameters: "stop {#ServiceName}";           Flags: runhidden waituntilterminated
Filename: "{app}\nssm.exe"; Parameters: "remove {#ServiceName} confirm"; Flags: runhidden waituntilterminated

[UninstallDelete]
; Eliminar archivos generados en runtime (no incluidos en la instalación)
Type: files;     Name: "{app}\ips.db"
Type: files;     Name: "{app}\monitor.log"
Type: files;     Name: "{app}\monitor-error.log"
Type: filesandordirs; Name: "{app}"

[Code]
// ── Verificar que el servicio quedó corriendo después de instalar ─────────────
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssDone then
  begin
    // Pequeña pausa para que el servicio arranque
    Sleep(2000);
  end;
end;

// ── Mensaje de bienvenida personalizado ───────────────────────────────────────
function InitializeSetup(): Boolean;
begin
  Result := True;
end;