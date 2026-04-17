/**
 * wpp.js
 * 
 * Módulo del cliente de WhatsApp usando whatsapp-web.js con LocalAuth.
 * 
 * COMPORTAMIENTO:
 * - Mensajes de grupo: se IGNORAN completamente (sin respuesta, sin estado).
 * - Mensajes individuales: se responde UNA VEZ y se bloquea el número por 5 minutos.
 * - Durante el bloqueo: NO se responde aunque el usuario escriba múltiples veces.
 * - Al expirar el bloqueo: NO se envía nada automáticamente.
 * - Solo se reenvía el mensaje si el usuario escribe DESPUÉS de que expire el bloqueo.
 * 
 * REGLAS ANTILOOP:
 * - No existe ningún setInterval que envíe mensajes.
 * - El envío SOLO ocurre dentro del evento "message".
 * - El timeout en conversationStore SOLO elimina estado, no envía mensajes.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { isBlocked, blockUser } = require('./conversationStore');

// Mensaje automático exacto según especificación
const MENSAJE_AUTOMATICO = `🚫 Este canal ya no está habilitado para reportes de soporte.

📞 Para atención técnica inmediata, llámanos al +57 333 0334146 y con gusto te ayudamos.

💼 ¿Facturación, cartera o nuevos servicios? Comunícate al +57 311 8479550.

📧 También puedes escribirnos a noc@tvymas.co

Gracias por confiar en nosotros.
Equipo TVYMAS 💙`;

// Estado del cliente
let clientReady = false;

// Inicializar cliente de WhatsApp con autenticación local persistente
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './wpp-session'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
        ]
    }
});

// ─── EVENTOS DEL CLIENTE ─────────────────────────────────────────────────────

/**
 * Evento: QR generado.
 * Muestra el QR en consola para vincular el dispositivo.
 */
client.on('qr', (qr) => {
    console.log('\n[WPP] Escanea el siguiente código QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
    console.log('[WPP] Esperando escaneo del QR...\n');
});

/**
 * Evento: Cliente autenticado correctamente.
 */
client.on('authenticated', () => {
    console.log('[WPP] Autenticación exitosa.');
});

/**
 * Evento: Fallo de autenticación.
 */
client.on('auth_failure', (msg) => {
    console.error('[WPP] Error de autenticación:', msg);
});

/**
 * Evento: Cliente listo para enviar y recibir mensajes.
 */
client.on('ready', () => {
    clientReady = true;
    console.log('[WPP] Cliente de WhatsApp listo y conectado.');
});

/**
 * Evento: Cliente desconectado.
 */
client.on('disconnected', (reason) => {
    clientReady = false;
    console.log('[WPP] Cliente desconectado:', reason);
});

/**
 * Evento: Mensaje entrante.
 * 
 * FLUJO DE DECISIÓN:
 * 1. ¿Es de un grupo? → IGNORAR completamente.
 * 2. ¿Es un mensaje propio (enviado por el bot)? → IGNORAR.
 * 3. ¿El número está bloqueado? → NO responder.
 * 4. Si no está bloqueado → Enviar mensaje automático y bloquear por 5 minutos.
 */
client.on('message', async (msg) => {
    try {
        // ── PASO 1: Ignorar mensajes de grupos ──
        // Los mensajes de grupo tienen un remoteId que termina en @g.us
        const chat = await msg.getChat();

        if (chat.isGroup) {
            // NO responder, NO guardar estado, IGNORAR completamente
            return;
        }

        // ── PASO 2: Ignorar mensajes propios ──
        // Evita que el bot responda a sus propios mensajes
        if (msg.fromMe) {
            return;
        }

        // ── PASO 3: Verificar bloqueo temporal ──
        const senderId = msg.from; // Formato: "573001234567@c.us"

        if (isBlocked(senderId)) {
            // El usuario está en período de bloqueo (5 minutos).
            // NO se responde nada. Se ignora silenciosamente.
            console.log(`[WPP] Mensaje ignorado (usuario bloqueado): ${senderId}`);
            return;
        }

        // ── PASO 4: Enviar mensaje automático y bloquear ──
        // El usuario NO está bloqueado, se envía el mensaje UNA VEZ.
        await client.sendMessage(senderId, MENSAJE_AUTOMATICO);
        console.log(`[WPP] Mensaje automático enviado a: ${senderId}`);

        // Bloquear al usuario por 5 minutos.
        // El timeout en conversationStore SOLO eliminará la entrada del Map.
        // NO enviará ningún mensaje al expirar.
        blockUser(senderId);

    } catch (error) {
        console.error('[WPP] Error procesando mensaje entrante:', error.message);
    }
});

// ─── FUNCIONES EXPORTADAS ────────────────────────────────────────────────────

/**
 * Inicializa el cliente de WhatsApp.
 * @returns {Promise<void>}
 */
async function initClient() {
    try {
        console.log('[WPP] Inicializando cliente de WhatsApp...');
        await client.initialize();
    } catch (error) {
        console.error('[WPP] Error al inicializar el cliente:', error.message);
        throw error;
    }
}

/**
 * Verifica si el cliente está listo para operar.
 * @returns {boolean}
 */
function isClientReady() {
    return clientReady;
}

/**
 * Envía un mensaje a un número de teléfono específico.
 * 
 * @param {string} numero - Número en formato internacional sin "+" (ej: "573001234567")
 * @param {string} mensaje - Texto del mensaje a enviar
 * @returns {Promise<object>} Resultado del envío
 * @throws {Error} Si el cliente no está listo o el envío falla
 */
async function enviarMensajeNumero(numero, mensaje) {
    if (!clientReady) {
        throw new Error('El cliente de WhatsApp no está conectado.');
    }

    // Validar formato del número (solo dígitos, mínimo 10, máximo 15)
    const numeroLimpio = numero.replace(/\D/g, '');
    if (numeroLimpio.length < 10 || numeroLimpio.length > 15) {
        throw new Error('Formato de número inválido. Debe tener entre 10 y 15 dígitos.');
    }

    // Formato requerido por whatsapp-web.js: "numero@c.us"
    const chatId = `${numeroLimpio}@c.us`;

    try {
        const result = await client.sendMessage(chatId, mensaje);
        console.log(`[WPP] Mensaje enviado a número: ${chatId}`);
        return {
            success: true,
            to: chatId,
            timestamp: result.timestamp,
            messageId: result.id._serialized
        };
    } catch (error) {
        console.error(`[WPP] Error enviando mensaje a ${chatId}:`, error.message);
        throw new Error(`No se pudo enviar el mensaje a ${numero}: ${error.message}`);
    }
}

/**
 * Envía un mensaje a un grupo de WhatsApp.
 * 
 * @param {string} grupoId - ID del grupo (formato: "123456789@g.us")
 * @param {string} mensaje - Texto del mensaje a enviar
 * @returns {Promise<object>} Resultado del envío
 * @throws {Error} Si el cliente no está listo, el formato es inválido o el envío falla
 */
async function enviarMensajeGrupo(grupoId, mensaje) {
    if (!clientReady) {
        throw new Error('El cliente de WhatsApp no está conectado.');
    }

    try {
        const chats = await client.getChats();
        const group = chats.find(chat => chat.name === grupoId);
        // Validar formato del ID de grupo
        if (!group) {
            throw new Error('❌ Grupo no encontrado: ${Group}');
        }
        const result = await group.sendMessage(mensaje);
        return {
            success: true,
            to: grupoId,
            timestamp: result.timestamp,
            messageId: result.id._serialized
        };
    } catch (error) {
        console.error(`[WPP] Error enviando mensaje al grupo ${grupoId}:`, error.message);
        throw new Error(`No se pudo enviar el mensaje al grupo ${grupoId}: ${error.message}`);
    }
    
   
}

/**
 * Crea un grupo de WhatsApp.
 *
 * Basado en la API oficial de whatsapp-web.js:
 * client.createGroup(title, participants, options)
 *
 * @param {string} titulo - Nombre del grupo
 * @param {string[]} participantes - Números en formato internacional sin "+"
 * @param {object} [opciones={}] - Opciones opcionales para createGroup
 * @returns {Promise<object|string>} Resultado entregado por whatsapp-web.js
 * @throws {Error} Si el cliente no está listo, no soporta createGroup o la creación falla
 */
async function crearGrupo(titulo, participantes, opciones = {}) {
    if (!clientReady) {
        throw new Error('El cliente de WhatsApp no está conectado.');
    }

    if (typeof client.createGroup !== 'function') {
        throw new Error('La versión actual de whatsapp-web.js no soporta createGroup().');
    }

    const participantesFormateados = participantes.map((numero) => {
        const numeroLimpio = String(numero).replace(/\D/g, '');

        if (numeroLimpio.length < 10 || numeroLimpio.length > 15) {
            throw new Error(`Formato de número inválido: ${numero}`);
        }

        return `${numeroLimpio}@c.us`;
    });

    try {
        const result = await client.createGroup(
            titulo.trim(),
            participantesFormateados,
            opciones
        );

        console.log(
            `[WPP] Solicitud de creación de grupo procesada: ${titulo} (${participantesFormateados.length} participantes)`
        );

        return result;
    } catch (error) {
        console.error(`[WPP] Error creando grupo "${titulo}":`, error.message);
        throw new Error(`No se pudo crear el grupo "${titulo}": ${error.message}`);
    }
}

module.exports = {
    initClient,
    isClientReady,
    enviarMensajeNumero,
    enviarMensajeGrupo,
    crearGrupo
};
