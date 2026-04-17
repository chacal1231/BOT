/**
 * server.js
 * 
 * Servidor Express con endpoints para enviar mensajes por WhatsApp.
 * Inicializa el cliente de WhatsApp al arrancar.
 * 
 * ENDPOINTS:
 * - POST /EnviarMensajeNumero  → Envía mensaje a un número individual
 * - POST /EnviarMensajeGrupo   → Envía mensaje a un grupo
 * - GET  /status               → Estado del cliente de WhatsApp
 * - GET  /health               → Health check del servidor
 */

const express = require('express');
const {
    initClient,
    isClientReady,
    enviarMensajeNumero,
    enviarMensajeGrupo
} = require('./wpp');
const { getBlockedCount, clearAll } = require('./conversationStore');

const app = express();
const PORT = process.env.PORT || 20000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

// Parsear JSON en el body de las peticiones
app.use(express.json());

// Logging básico de peticiones
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────

/**
 * POST /EnviarMensajeNumero
 * 
 * Envía un mensaje de WhatsApp a un número específico.
 * 
 * Body JSON esperado:
 * {
 *   "numero": "573001234567",
 *   "mensaje": "Texto del mensaje"
 * }
 * 
 * Respuesta exitosa (200):
 * {
 *   "success": true,
 *   "message": "Mensaje enviado correctamente",
 *   "data": { "to": "573001234567@c.us", "timestamp": ..., "messageId": "..." }
 * }
 * 
 * Respuesta error (400/500):
 * {
 *   "success": false,
 *   "error": "Descripción del error"
 * }
 */
app.post('/EnviarMensajeNumero', async (req, res) => {
    try {
        const { numero, mensaje } = req.body;

        // Validar campos obligatorios
        if (!numero || !mensaje) {
            return res.status(400).json({
                success: false,
                error: 'Los campos "numero" y "mensaje" son obligatorios.'
            });
        }

        // Validar que el número sea string y contenga solo dígitos
        if (typeof numero !== 'string' || !/^\d{10,15}$/.test(numero.replace(/\D/g, ''))) {
            return res.status(400).json({
                success: false,
                error: 'El número debe contener entre 10 y 15 dígitos numéricos.'
            });
        }

        // Validar que el mensaje no esté vacío
        if (typeof mensaje !== 'string' || mensaje.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'El mensaje no puede estar vacío.'
            });
        }

        const result = await enviarMensajeNumero(numero, mensaje);

        return res.status(200).json({
            success: true,
            message: 'Mensaje enviado correctamente.',
            data: result
        });

    } catch (error) {
        console.error('[HTTP] Error en /EnviarMensajeNumero:', error.message);

        const statusCode = error.message.includes('no está conectado') ? 503 : 500;

        return res.status(statusCode).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /EnviarMensajeGrupo
 * 
 * Envía un mensaje de WhatsApp a un grupo.
 * 
 * Body JSON esperado:
 * {
 *   "grupoId": "123456789@g.us",
 *   "mensaje": "Texto del mensaje"
 * }
 * 
 * Respuesta exitosa (200):
 * {
 *   "success": true,
 *   "message": "Mensaje enviado al grupo correctamente",
 *   "data": { "to": "123456789@g.us", "timestamp": ..., "messageId": "..." }
 * }
 */
app.post('/EnviarMensajeGrupo', async (req, res) => {
    try {
        const { grupoId, mensaje } = req.body;

        // Validar campos obligatorios
        if (!grupoId || !mensaje) {
            return res.status(400).json({
                success: false,
                error: 'Los campos "grupoId" y "mensaje" son obligatorios.'
            });
        }

    

        // Validar que el mensaje no esté vacío
        if (typeof mensaje !== 'string' || mensaje.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'El mensaje no puede estar vacío.'
            });
        }

        const result = await enviarMensajeGrupo(grupoId, mensaje);

        return res.status(200).json({
            success: true,
            message: 'Mensaje enviado al grupo correctamente.',
            data: result
        });

    } catch (error) {
        console.error('[HTTP] Error en /EnviarMensajeGrupo:', error.message);

        const statusCode = error.message.includes('no está conectado') ? 503 : 500;

        return res.status(statusCode).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /status
 * 
 * Devuelve el estado actual del cliente de WhatsApp y estadísticas.
 */
app.get('/status', (req, res) => {
    return res.status(200).json({
        success: true,
        data: {
            whatsappConnected: isClientReady(),
            blockedUsersCount: getBlockedCount(),
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * GET /health
 * 
 * Health check simple del servidor.
 */
app.get('/health', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Servidor activo.'
    });
});

// ─── MANEJO DE ERRORES GLOBAL ────────────────────────────────────────────────

// Ruta no encontrada
app.use((req, res) => {
    return res.status(404).json({
        success: false,
        error: `Ruta no encontrada: ${req.method} ${req.path}`
    });
});

// Error handler global
app.use((err, req, res, next) => {
    console.error('[HTTP] Error no manejado:', err.message);
    return res.status(500).json({
        success: false,
        error: 'Error interno del servidor.'
    });
});

// ─── INICIO DEL SERVIDOR ────────────────────────────────────────────────────

async function startServer() {
    try {
        // 1. Iniciar el servidor HTTP
        app.listen(PORT, () => {
            console.log(`[Server] Servidor Express escuchando en puerto ${PORT}`);
            console.log(`[Server] Endpoints disponibles:`);
            console.log(`         POST http://localhost:${PORT}/EnviarMensajeNumero`);
            console.log(`         POST http://localhost:${PORT}/EnviarMensajeGrupo`);
            console.log(`         GET  http://localhost:${PORT}/status`);
            console.log(`         GET  http://localhost:${PORT}/health`);
        });

        // 2. Inicializar el cliente de WhatsApp
        console.log('[Server] Inicializando cliente de WhatsApp...');
        await initClient();

    } catch (error) {
        console.error('[Server] Error fatal al iniciar:', error.message);
        process.exit(1);
    }
}

// ─── MANEJO DE CIERRE LIMPIO ─────────────────────────────────────────────────

process.on('SIGINT', () => {
    console.log('\n[Server] Cerrando servidor...');
    clearAll();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Server] Terminando servidor...');
    clearAll();
    process.exit(0);
});

// Iniciar todo
startServer();
