const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Lee el archivo firebase-key.json
const keyPath = path.join(__dirname, '../../firebase-key.json');

if (!admin.apps.length) {
  try {
    // Lee el archivo como texto y parsea como JSON
    const serviceAccountJson = fs.readFileSync(keyPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DB_URL
    });
    console.log('✅ Firebase inicializado correctamente\n');
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
    console.error('   Ruta buscada:', keyPath);
    console.error('   Verifica que firebase-key.json existe en la raíz');
    process.exit(1);
  }
}

const db = admin.database();

// Guarda datos extraídos temporalmente
async function guardarExtraccion(userId, datos) {
  try {
    const timestamp = Date.now();
    await db.ref(`extracciones/${userId}`).set({
      ...datos,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });
    console.log(`💾 Extracción guardada para usuario ${userId}`);
  } catch (error) {
    console.error('❌ Error guardando extracción:', error.message);
    throw error;
  }
}

// Obtiene última extracción del usuario
async function obtenerExtraccion(userId) {
  try {
    const snapshot = await db.ref(`extracciones/${userId}`).once('value');
    
    if (!snapshot.exists()) {
      console.log(`⚠️  No hay extracción previa para ${userId}`);
      return null;
    }
    
    const data = snapshot.val();
    console.log(`📂 Extracción obtenida para ${userId}`);
    return data;
  } catch (error) {
    console.error('❌ Error obteniendo extracción:', error.message);
    throw error;
  }
}

// Limpia extracción después de procesar
async function limpiarExtraccion(userId) {
  try {
    await db.ref(`extracciones/${userId}`).remove();
    console.log(`🧹 Extracción limpiada para ${userId}`);
  } catch (error) {
    console.error('❌ Error limpiando extracción:', error.message);
    throw error;
  }
}

// Guarda factura completada
async function guardarFactura(facturaData) {
  try {
    const id = `factura_${Date.now()}`;
    await db.ref(`facturas/${id}`).set({
      ...facturaData,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });
    console.log(`📋 Factura guardada: ${id}`);
    return id;
  } catch (error) {
    console.error('❌ Error guardando factura:', error.message);
    throw error;
  }
}

// Obtiene todas las facturas de un usuario
async function obtenerFacturasUsuario(userId) {
  try {
    const snapshot = await db.ref('facturas').orderByChild('senderId').equalTo(userId).once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('❌ Error obteniendo facturas:', error.message);
    throw error;
  }
}

module.exports = {
  guardarExtraccion,
  obtenerExtraccion,
  limpiarExtraccion,
  guardarFactura,
  obtenerFacturasUsuario
};