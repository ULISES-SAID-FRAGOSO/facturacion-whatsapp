require('dotenv').config();
require('express-async-errors');
const express = require('express');
const app = express();
const whatsappService = require('./services/whatsapp');
const firebaseService = require('./services/firebase');
const axios = require('axios');

app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ========== WEBHOOK PARA RECIBIR MENSAJES DE WHATSAPP ==========
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    console.log('\n📨 ==================== MENSAJE RECIBIDO ====================');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('========================================================\n');

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      return res.json({ received: true, message: 'Sin mensajes' });
    }

    const message = value.messages[0];
    const senderId = message.from;
    const senderPhone = senderId;

    console.log(`👤 Remitente: ${senderId}`);
    console.log(`📱 Tipo de mensaje: ${message.type}`);

    // Respuesta automática inicial
    await whatsappService.sendMessage(
      senderId,
      '✅ Mensaje recibido. Procesando...'
    );

    // ========== PROCESA SEGÚN TIPO DE MENSAJE ==========

    if (message.type === 'image') {
      // ===== CASO 1: Usuario envía CSF como imagen =====
      console.log('📸 IMAGEN DETECTADA - Iniciando extracción...');
      
      try {
        const mediaId = message.image.id;
        console.log(`📥 Media ID: ${mediaId}`);

        // Obtiene URL de media
        const mediaUrl = await whatsappService.getMediaUrl(mediaId);
        console.log(`🔗 URL obtenida: ${mediaUrl.substring(0, 50)}...`);

        // Descarga imagen en base64
        const base64Image = await whatsappService.downloadMedia(mediaUrl);
        console.log(`✅ Imagen descargada (${base64Image.length} bytes)`);

        // Envía a tu proxy Cloudflare para extracción IA
        console.log('🤖 Enviando a Cloudflare Workers para extracción IA...');
        const datosExtraidos = await extraerDatosCSF(base64Image);
        
        if (!datosExtraidos.success) {
          console.log('❌ Extracción fallida:', datosExtraidos.error);
          await whatsappService.sendMessage(
            senderId,
            `❌ No pude extraer los datos del CSF.\n\n⚠️ Por favor envía:\n• Importe\n• Método de pago\n• Email destino\n• RFC del cliente\n\nEjemplo:\n5000\ntransferencia\ncliente@gmail.com\nMOHE900110P30`
          );
          return res.json({ received: true, success: false });
        }

        console.log('✅ Datos extraídos correctamente:', JSON.stringify(datosExtraidos.data, null, 2));

        // Almacena en Firebase temporalmente
        await firebaseService.guardarExtraccion(senderId, datosExtraidos.data);
        console.log('💾 Datos guardados en Firebase');

        // Responde con los datos extraídos
        const mensaje = `✅ <b>DATOS EXTRAÍDOS:</b>\n\n` +
          `<b>RFC:</b> ${datosExtraidos.data.rfc || 'No detectado'}\n` +
          `<b>Nombre:</b> ${datosExtraidos.data.nombre || 'No detectado'}\n` +
          `<b>Importe:</b> $${datosExtraidos.data.total || datosExtraidos.data.importe || 'No detectado'}\n` +
          `<b>Concepto:</b> ${datosExtraidos.data.concepto || 'Servicios'}\n\n` +
          `¿Confirmas los datos? (Escribe <b>SÍ</b> o <b>NO</b>)`;

        await whatsappService.sendMessage(senderId, mensaje);

      } catch (error) {
        console.error('❌ Error procesando imagen:', error.message);
        await whatsappService.sendMessage(
          senderId,
          `❌ Error al procesar la imagen: ${error.message}`
        );
      }

    } else if (message.type === 'text') {
      // ===== CASO 2: Usuario envía texto =====
      const texto = message.text.body.trim().toLowerCase();
      console.log(`💬 Texto recibido: "${texto}"`);

      if (texto === 'sí' || texto === 'si' || texto === 'yes') {
        // ===== CONFIRMA Y GENERA CFDI =====
        console.log('\n🔄 CONFIRMACIÓN RECIBIDA - Iniciando generación de CFDI...');

        try {
          const datosGuardados = await firebaseService.obtenerExtraccion(senderId);
          
          if (!datosGuardados) {
            console.log('❌ No hay datos previos');
            await whatsappService.sendMessage(
              senderId,
              '❌ No hay datos previos. Envía una imagen del CSF primero.'
            );
            return res.json({ received: true, success: false });
          }

          console.log('📋 Datos obtenidos de Firebase:', JSON.stringify(datosGuardados, null, 2));

          // ===== GENERA CFDI EN ONEFACTURE =====
          console.log('⚙️  Generando CFDI en OneFacture...');
          const onefactureService = require('./services/onefacture');
          const resultadoCFDI = await onefactureService.crearFactura(datosGuardados);

          if (resultadoCFDI.success) {
            console.log('✅ CFDI GENERADO:', JSON.stringify(resultadoCFDI.cfdi, null, 2));

            // Guarda folio en Firebase
            await firebaseService.guardarFactura({
              senderId,
              datos: datosGuardados,
              cfdi: resultadoCFDI.cfdi,
              estado: 'completada'
            });
            console.log('💾 Factura guardada en Firebase');

            // Envía respuesta al usuario
            const mensajeExito = `🎉 <b>¡CFDI GENERADO EXITOSAMENTE!</b>\n\n` +
              `<b>Folio:</b> ${resultadoCFDI.cfdi.folio}\n` +
              `<b>Serie:</b> ${resultadoCFDI.cfdi.serie || 'A'}\n` +
              `<b>UUID:</b> ${resultadoCFDI.cfdi.uuid}\n` +
              `<b>RFC:</b> ${datosGuardados.rfc}\n` +
              `<b>Cliente:</b> ${datosGuardados.nombre}\n` +
              `<b>Total:</b> $${datosGuardados.total}\n\n` +
              `📧 <b>Email destino:</b> ${datosGuardados.emailDestino}\n` +
              `📄 Factura enviada al cliente\n\n` +
              `✅ Proceso completado`;

            await whatsappService.sendMessage(senderId, mensajeExito);

            // Limpia extracción temporal
            await firebaseService.limpiarExtraccion(senderId);
            console.log('✅ Sesión limpiada\n');

          } else {
            console.log('❌ Error en OneFacture:', resultadoCFDI.error);
            await whatsappService.sendMessage(
              senderId,
              `❌ <b>Error generando CFDI:</b>\n${resultadoCFDI.error}\n\nPor favor contacta al administrador.`
            );
          }

        } catch (error) {
          console.error('❌ Error en proceso de CFDI:', error);
          await whatsappService.sendMessage(
            senderId,
            `❌ Error: ${error.message}`
          );
        }

      } else if (texto === 'no') {
        // ===== CANCELA PROCESO =====
        console.log('❌ CANCELADO por usuario');
        await firebaseService.limpiarExtraccion(senderId);
        await whatsappService.sendMessage(
          senderId,
          '❌ Cancelado. Envía otro CSF cuando estés listo.'
        );

      } else {
        // ===== MENSAJE NO RECONOCIDO =====
        console.log('⚠️  Comando no reconocido');
        await whatsappService.sendMessage(
          senderId,
          `Comando no reconocido.\n\n¿Qué quieres hacer?\n\n1️⃣ Envía una <b>imagen del CSF</b>\n2️⃣ Escribe <b>SÍ</b> o <b>NO</b> para confirmar datos`
        );
      }
    }

    res.json({ received: true, success: true });

  } catch (error) {
    console.error('\n❌ ========== ERROR EN WEBHOOK ==========');
    console.error(error);
    console.error('=======================================\n');
    res.status(500).json({ error: error.message });
  }
});

// ========== WEBHOOK PARA VERIFICAR SUBSCRIPCIÓN (Meta lo requiere) ==========
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`\n🔍 Verificación de webhook:`);
  console.log(`   Mode: ${mode}`);
  console.log(`   Token correcto: ${token === process.env.WHATSAPP_VERIFY_TOKEN}`);

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log(`✅ Webhook verificado\n`);
    res.status(200).send(challenge);
  } else {
    console.log(`❌ Webhook rechazado\n`);
    res.sendStatus(403);
  }
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ========== FUNCIÓN AUXILIAR: EXTRAE DATOS CON IA ==========
async function extraerDatosCSF(base64Image) {
  try {
    console.log(`🔗 Llamando a: ${process.env.CLOUDFLARE_PROXY_URL}`);
    
    const response = await axios.post(
      process.env.CLOUDFLARE_PROXY_URL,
      { imageBase64: base64Image },
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30 segundos timeout
      }
    );

    console.log('📦 Respuesta de Cloudflare:', JSON.stringify(response.data, null, 2));
    const datosExtraidos = response.data;

    // Valida que tenga campos requeridos
    if (!datosExtraidos.rfc || !datosExtraidos.total) {
      console.log('⚠️  Datos incompletos en respuesta');
      return { 
        success: false, 
        error: 'RFC o Total no encontrados en el CSF' 
      };
    }

    // Normaliza el importe (puede venir como número o string)
    datosExtraidos.total = parseFloat(datosExtraidos.total);
    datosExtraidos.importe = parseFloat(datosExtraidos.importe || datosExtraidos.total);
    datosExtraidos.subtotal = parseFloat(datosExtraidos.subtotal || (datosExtraidos.total / 1.16));
    datosExtraidos.iva = parseFloat(datosExtraidos.iva || (datosExtraidos.total - datosExtraidos.subtotal));

    return { success: true, data: datosExtraidos };

  } catch (error) {
    console.error('🔴 Error extrayendo datos:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 SERVIDOR INICIADO`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 Puerto: ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`📱 Webhook WhatsApp: POST http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`❤️  Health check: GET http://localhost:${PORT}/health`);
  console.log(`${'='.repeat(60)}\n`);

  console.log('⏳ Esperando mensajes de WhatsApp...\n');
});

module.exports = app;