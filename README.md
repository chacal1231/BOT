# WhatsApp Bot - TVYMAS Soporte Desactivado

Bot de WhatsApp que desactiva el soporte por este canal y redirige a los usuarios a los canales oficiales de atención de TVYMAS.

## Estructura del Proyecto

```
whatsapp-bot/
├── server.js              # Servidor Express + arranque
├── wpp.js                 # Cliente WhatsApp + lógica de mensajes
├── conversationStore.js   # Control de estado con bloqueo temporal (Map + TTL)
├── package.json           # Dependencias
└── README.md              # Este archivo
```

## Requisitos Previos

- **Node.js** >= 18.0.0
- **Google Chrome** o **Chromium** instalado en el servidor (requerido por Puppeteer)

### Instalar Chromium en Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y chromium-browser
# o en algunas distros:
sudo apt install -y chromium
```

### Instalar dependencias del sistema para Puppeteer:

```bash
sudo apt install -y \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
    libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
    libxtst6 ca-certificates fonts-liberation libnss3 lsb-release \
    xdg-utils wget
```

## Instalación y Ejecución

```bash
# 1. Clonar o copiar los archivos del proyecto

# 2. Instalar dependencias de Node.js
npm install

# 3. Ejecutar el servidor
node server.js
```

Al iniciar por primera vez:
1. Se mostrará un **código QR** en la consola.
2. Abre WhatsApp en tu teléfono → **Dispositivos vinculados** → **Vincular un dispositivo**.
3. Escanea el QR.
4. Una vez conectado, verás: `[WPP] Cliente de WhatsApp listo y conectado.`

La sesión se guarda localmente en `./wpp-session/`, por lo que no necesitarás escanear el QR nuevamente en futuros reinicios.

## Endpoints de la API

### POST /EnviarMensajeNumero

Envía un mensaje a un número específico.

```bash
curl -X POST http://localhost:3000/EnviarMensajeNumero \
  -H "Content-Type: application/json" \
  -d '{
    "numero": "573001234567",
    "mensaje": "Hola, este es un mensaje de prueba"
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Mensaje enviado correctamente.",
  "data": {
    "to": "573001234567@c.us",
    "timestamp": 1700000000,
    "messageId": "true_573001234567@c.us_ABC123"
  }
}
```

### POST /EnviarMensajeGrupo

Envía un mensaje a un grupo de WhatsApp.

```bash
curl -X POST http://localhost:3000/EnviarMensajeGrupo \
  -H "Content-Type: application/json" \
  -d '{
    "grupoId": "120363012345678901@g.us",
    "mensaje": "Mensaje al grupo"
  }'
```

### GET /status

```bash
curl http://localhost:3000/status
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "whatsappConnected": true,
    "blockedUsersCount": 3,
    "uptime": 1234.56,
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

### GET /health

```bash
curl http://localhost:3000/health
```

## Comportamiento del Bot

| Escenario | Acción |
|---|---|
| Mensaje de **grupo** | Se ignora completamente |
| Mensaje **individual** (primera vez o después de 5 min) | Responde con el mensaje automático y bloquea 5 min |
| Mensaje **individual** (durante bloqueo de 5 min) | Se ignora silenciosamente |
| **Expiración** del bloqueo | Solo se elimina el estado. NO se envía nada |
| Mensaje **individual** (después de expiración) | Responde nuevamente con el mensaje automático |

## Mensaje Automático

```
📵 Este medio para reportar soporte fue desactivado.

☎️ Por favor comuníquese a la línea: +57 333 0334146

📧 O escriba a: noc@tvymas.co

Si necesita algo más, por favor espere en la línea.
```

## Reglas Antiloop Implementadas

- ✅ **No existe** ningún `setInterval` que envíe mensajes.
- ✅ **No hay** reenvío automático al expirar el timeout.
- ✅ El control se hace con `Map` en memoria con TTL vía `setTimeout`.
- ✅ El envío **solo ocurre** dentro del evento `message`.
- ✅ El timeout **solo elimina** el estado del Map.

## Variables de Entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor Express |

## Notas de Producción

- La sesión de WhatsApp se persiste en `./wpp-session/`.
- En producción, considere usar un process manager como **PM2**: `pm2 start server.js --name whatsapp-bot`.
- El QR solo se muestra en consola. En producción la sesión ya estará guardada.
- Para reiniciar la sesión, elimine la carpeta `./wpp-session/` y reinicie.
