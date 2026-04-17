/**
 * conversationStore.js
 * 
 * Manejo de estado de conversación con bloqueo temporal.
 * Usa un Map en memoria con TTL de 5 minutos.
 * 
 * REGLAS ANTILOOP:
 * - No hay setInterval que envíe mensajes.
 * - No hay reenvío automático al expirar el timeout.
 * - El timeout SOLO elimina la entrada del Map, no ejecuta ningún envío.
 * - El envío de mensajes se controla exclusivamente desde el evento "message" en wpp.js.
 */

// Duración del bloqueo en milisegundos (5 minutos)
const COOLDOWN_MS = 5 * 60 * 1000;

// Map para almacenar los números bloqueados temporalmente
// Clave: número de teléfono (string) — Valor: ID del timeout (NodeJS.Timeout)
const blockedUsers = new Map();

/**
 * Verifica si un número está actualmente bloqueado.
 * @param {string} numero - Número de teléfono del usuario (ej: "573001234567@c.us")
 * @returns {boolean} true si está bloqueado, false si puede recibir mensaje
 */
function isBlocked(numero) {
    return blockedUsers.has(numero);
}

/**
 * Bloquea un número durante COOLDOWN_MS milisegundos.
 * Al expirar el tiempo, SOLO elimina la entrada del Map.
 * NO envía ningún mensaje ni ejecuta ninguna acción adicional.
 * 
 * @param {string} numero - Número de teléfono del usuario
 */
function blockUser(numero) {
    // Si ya existe un bloqueo previo, limpiar el timeout anterior
    if (blockedUsers.has(numero)) {
        clearTimeout(blockedUsers.get(numero));
    }

    // Crear nuevo timeout que SOLO elimina la entrada al expirar
    const timeoutId = setTimeout(() => {
        blockedUsers.delete(numero);
        console.log(`[ConversationStore] Bloqueo expirado para: ${numero}`);
        // ⚠️ IMPORTANTE: Aquí NO se envía ningún mensaje.
        // El próximo mensaje solo se enviará si el usuario vuelve a escribir.
    }, COOLDOWN_MS);

    // Evitar que el timeout mantenga vivo el proceso de Node.js
    if (timeoutId.unref) {
        timeoutId.unref();
    }

    blockedUsers.set(numero, timeoutId);
    console.log(`[ConversationStore] Usuario bloqueado por ${COOLDOWN_MS / 1000}s: ${numero}`);
}

/**
 * Desbloquea manualmente un número (uso administrativo).
 * @param {string} numero - Número de teléfono del usuario
 * @returns {boolean} true si se desbloqueó, false si no estaba bloqueado
 */
function unblockUser(numero) {
    if (blockedUsers.has(numero)) {
        clearTimeout(blockedUsers.get(numero));
        blockedUsers.delete(numero);
        console.log(`[ConversationStore] Usuario desbloqueado manualmente: ${numero}`);
        return true;
    }
    return false;
}

/**
 * Obtiene la cantidad de usuarios actualmente bloqueados.
 * @returns {number} Cantidad de usuarios bloqueados
 */
function getBlockedCount() {
    return blockedUsers.size;
}

/**
 * Limpia todos los bloqueos y timeouts (útil para shutdown).
 */
function clearAll() {
    for (const [numero, timeoutId] of blockedUsers.entries()) {
        clearTimeout(timeoutId);
    }
    blockedUsers.clear();
    console.log('[ConversationStore] Todos los bloqueos eliminados.');
}

module.exports = {
    isBlocked,
    blockUser,
    unblockUser,
    getBlockedCount,
    clearAll,
    COOLDOWN_MS
};
