# WhatsApp Bot TVYMAS

API en Node.js con Express y `whatsapp-web.js` para:

- responder automáticamente a mensajes entrantes de WhatsApp en chats individuales,
- ignorar mensajes de grupos,
- evitar loops con un bloqueo temporal de 5 minutos por usuario,
- exponer endpoints HTTP para enviar mensajes a números o grupos manualmente,
- crear grupos de WhatsApp por API.

## Qué hace el proyecto

Cuando un usuario escribe por WhatsApp:

- si el mensaje viene de un grupo, el bot lo ignora,
- si el mensaje viene de un chat individual y el usuario no está bloqueado, envía un mensaje automático de redirección,
- después de responder, bloquea temporalmente a ese usuario por 5 minutos,
- si el usuario vuelve a escribir durante ese tiempo, no responde nada,
- cuando expira el bloqueo, no se envía ningún mensaje automático; solo queda habilitado para responder si la persona vuelve a escribir.

## Stack

- Node.js
- Express
- `whatsapp-web.js`
- `qrcode-terminal`
- autenticación persistente con `LocalAuth`

## Estructura

```text
.
├── server.js
├── wpp.js
├── conversationStore.js
├── package.json
└── README.md
```

## Requisitos

- Node.js 18 o superior
- `npm`
- Google Chrome o Chromium disponible en el servidor

## Instalación

```bash
npm install
```

## Ejecución

Modo normal:

```bash
npm start
```

Modo desarrollo:

```bash
npm run dev
```

Al iniciar por primera vez:

1. se mostrará un código QR en la terminal,
2. abre WhatsApp en tu teléfono,
3. entra a `Dispositivos vinculados`,
4. escanea el QR,
5. espera el mensaje de cliente conectado en consola.

La sesión queda persistida en la carpeta `./wpp-session`.

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|---|---:|---|
| `PORT` | `20000` | Puerto del servidor Express |

## Endpoints

### `POST /EnviarMensajeNumero`

Envía un mensaje a un número individual.

Body:

```json
{
  "numero": "573001234567",
  "mensaje": "Hola, este es un mensaje de prueba"
}
```

Ejemplo:

```bash
curl -X POST http://localhost:20000/EnviarMensajeNumero \
  -H "Content-Type: application/json" \
  -d '{
    "numero": "573001234567",
    "mensaje": "Hola, este es un mensaje de prueba"
  }'
```

Respuesta exitosa:

```json
{
  "success": true,
  "message": "Mensaje enviado correctamente.",
  "data": {
    "success": true,
    "to": "573001234567@c.us",
    "timestamp": 1700000000,
    "messageId": "true_573001234567@c.us_ABC123"
  }
}
```

Validaciones principales:

- `numero` es obligatorio,
- `mensaje` es obligatorio,
- el número debe contener entre 10 y 15 dígitos,
- el mensaje no puede estar vacío.

### `POST /EnviarMensajeGrupo`

Envía un mensaje a un grupo.

Body:

```json
{
  "grupoId": "Nombre del grupo",
  "mensaje": "Mensaje para el grupo"
}
```

Ejemplo:

```bash
curl -X POST http://localhost:20000/EnviarMensajeGrupo \
  -H "Content-Type: application/json" \
  -d '{
    "grupoId": "Soporte Interno",
    "mensaje": "Mensaje para el grupo"
  }'
```

Respuesta exitosa:

```json
{
  "success": true,
  "message": "Mensaje enviado al grupo correctamente.",
  "data": {
    "success": true,
    "to": "Soporte Interno",
    "timestamp": 1700000000,
    "messageId": "true_120363000000000000@g.us_ABC123"
  }
}
```

Nota importante:

- aunque el campo se llama `grupoId`, el código actual busca el grupo por `chat.name`, es decir, por el nombre visible del grupo.

### `POST /CrearGrupo`

Crea un grupo de WhatsApp usando `client.createGroup(title, participants, options)`.

Body:

```json
{
  "titulo": "Clientes Prioritarios",
  "participantes": ["573001234567", "573009876543"],
  "opciones": {}
}
```

Ejemplo:

```bash
curl -X POST http://localhost:20000/CrearGrupo \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Clientes Prioritarios",
    "participantes": ["573001234567", "573009876543"],
    "opciones": {}
  }'
```

Notas:

- `titulo` es obligatorio,
- `participantes` debe ser un arreglo con al menos un número,
- los números se convierten internamente al formato `@c.us`,
- `opciones` es opcional y se envía tal cual a `createGroup`,
- si la versión instalada de `whatsapp-web.js` no soporta `createGroup`, la API responderá con `501`.

### `GET /status`

Devuelve el estado del servicio y algunas métricas básicas.

```bash
curl http://localhost:20000/status
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "whatsappConnected": true,
    "blockedUsersCount": 3,
    "uptime": 1234.56,
    "timestamp": "2026-04-17T12:00:00.000Z"
  }
}
```

### `GET /health`

Health check simple del servidor.

```bash
curl http://localhost:20000/health
```

## Mensaje automático actual

```text
🚫 Este canal ya no está habilitado para reportes de soporte.

📞 Para atención técnica inmediata, llámanos al +57 333 0334146 y con gusto te ayudamos.

💼 ¿Facturación, cartera o nuevos servicios? Comunícate al +57 311 8479550.

📧 También puedes escribirnos a noc@tvymas.co

Gracias por confiar en nosotros.
Equipo TVYMAS 💙
```

## Lógica antispam y antiloop

- el bloqueo temporal dura 5 minutos,
- el estado se guarda en memoria con un `Map`,
- el desbloqueo ocurre con `setTimeout`,
- al expirar el tiempo no se dispara ningún envío automático,
- el bot nunca responde a sus propios mensajes,
- los grupos se ignoran en el flujo de mensajes entrantes.

## Respuestas HTTP habituales

- `200` cuando la operación fue exitosa,
- `400` cuando faltan campos o el body es inválido,
- `404` cuando la ruta no existe,
- `500` ante errores internos,
- `503` cuando el cliente de WhatsApp no está listo.

## Notas operativas

- La autenticación de WhatsApp se almacena localmente en `./wpp-session`.
- Si necesitas reiniciar la sesión, elimina esa carpeta y vuelve a iniciar el proyecto.
- En producción conviene ejecutar el servicio con PM2 o un process manager similar.
- El contador de bloqueos es en memoria, así que se reinicia al reiniciar el proceso.
