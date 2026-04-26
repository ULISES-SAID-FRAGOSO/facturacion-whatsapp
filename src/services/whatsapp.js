const axios = require('axios');

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const api = axios.create({
  baseURL: `https://graph.instagram.com/v18.0/${PHONE_NUMBER_ID}`,
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Envía mensaje de texto
async function sendMessage(phoneNumber, message) {
  try {
    console.log(`\n📤 Enviando mensaje a ${phoneNumber}...`);
    const response = await api.post('/messages', {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: message }
    });
    console.log(`✅ Mensaje enviado correctamente`);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.response?.data || error.message);
    throw error;
  }
}

// Descarga medios (imágenes) de WhatsApp
async function downloadMedia(mediaUrl) {
  try {
    console.log(`\n📥 Descargando archivo de: ${mediaUrl.substring(0, 50)}...`);
    const response = await axios.get(mediaUrl, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const base64 = Buffer.from(response.data).toString('base64');
    console.log(`✅ Archivo descargado (${response.data.length} bytes)`);
    return base64;
  } catch (error) {
    console.error('❌ Error descargando media:', error.message);
    throw error;
  }
}

// Obtiene URL de la media
async function getMediaUrl(mediaId) {
  try {
    console.log(`🔗 Obteniendo URL del media ID: ${mediaId}`);
    const response = await api.get(`/${mediaId}`);
    const url = response.data.url;
    console.log(`✅ URL obtenida`);
    return url;
  } catch (error) {
    console.error('❌ Error obteniendo URL:', error.response?.data || error.message);
    throw error;
  }
}

// Envía documento (PDF)
async function sendDocument(phoneNumber, docUrl, filename) {
  try {
    console.log(`\n📄 Enviando documento a ${phoneNumber}: ${filename}`);
    await api.post('/messages', {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'document',
      document: {
        link: docUrl,
        filename: filename
      }
    });
    console.log(`✅ Documento enviado`);
  } catch (error) {
    console.error('❌ Error enviando documento:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendMessage,
  downloadMedia,
  getMediaUrl,
  sendDocument
};