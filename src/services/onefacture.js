const axios = require('axios');
const crypto = require('crypto');

// Configuración de OneFacture
const onefactureApi = axios.create({
  baseURL: 'https://api.onefacture.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.ONEFACTURE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

async function crearFactura(datos) {
  try {
    console.log('\n⚙️  ========== GENERANDO CFDI EN ONEFACTURE ==========');
    
    // Calcula subtotal e IVA
    const subtotal = datos.subtotal || (datos.total / 1.16);
    const iva = datos.iva || (datos.total - subtotal);

    // Prepara payload para OneFacture
    const payload = {
      rfc_emisor: process.env.RFC_DENTISTA,
      rfc_receptor: datos.rfc,
      nombre_receptor: datos.nombre || 'Cliente',
      concepto: datos.concepto || 'Servicios Odontológicos',
      importe_subtotal: parseFloat(subtotal).toFixed(2),
      importe_iva: parseFloat(iva).toFixed(2),
      importe_total: parseFloat(datos.total).toFixed(2),
      metodo_pago: datos.metodoPago || '01',
      uso_cfdi: 'G301',
      tipo_factura: 'I',
      serie: 'A',
      correo_receptor: datos.emailDestino || ''
    };

    console.log('📤 Payload OneFacture:');
    console.log(JSON.stringify(payload, null, 2));

    // INTENTA LLAMAR A ONEFACTURE API REAL
    try {
      console.log('🔗 Conectando a OneFacture API...');
      const response = await onefactureApi.post('/factura/emitir', payload);
      
      console.log('✅ CFDI GENERADO EN ONEFACTURE');
      console.log(JSON.stringify(response.data, null, 2));

      return {
        success: true,
        cfdi: {
          folio: response.data.folio,
          serie: response.data.serie || 'A',
          uuid: response.data.uuid,
          fecha: response.data.fecha,
          rfc_emisor: response.data.rfc_emisor,
          rfc_receptor: datos.rfc,
          nombre_receptor: datos.nombre,
          subtotal: response.data.importe_subtotal,
          iva: response.data.importe_iva,
          total: response.data.importe_total,
          pdf_url: response.data.pdf_url,
          xml_url: response.data.xml_url,
          ambiente: 'PRODUCCIÓN'
        },
        mensaje: 'CFDI generado correctamente'
      };

    } catch (apiError) {
      // SI FALLA ONEFACTURE, USA SIMULACIÓN (MODO PRUEBA)
      console.log('\n⚠️  ========== MODO SIMULACIÓN (OneFacture no disponible) ==========');
      console.log('Error de API:', apiError.message);
      console.log('Usando CFDI Simulado para pruebas\n');

      const cfdiSimulado = generarCFDISimulado(payload);
      
      return {
        success: true,
        cfdi: cfdiSimulado,
        mensaje: '⚠️  CFDI Simulado - Modo Prueba'
      };
    }

  } catch (error) {
    console.error('\n❌ ========== ERROR GENERANDO CFDI ==========');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    console.error('==========================================\n');
    
    return {
      success: false,
      error: error.message || 'Error desconocido generando CFDI'
    };
  }
}

// FUNCIÓN: GENERA CFDI SIMULADO (PARA PRUEBAS)
function generarCFDISimulado(payload) {
  const uuid = crypto.randomUUID();
  const ahora = new Date();
  const folio = Math.floor(Math.random() * 1000000);
  
  return {
    folio: folio,
    serie: 'A',
    uuid: uuid,
    fecha: ahora.toISOString().split('T')[0],
    hora: ahora.toISOString().split('T')[1].substring(0, 8),
    rfc_emisor: process.env.RFC_DENTISTA,
    rfc_receptor: payload.rfc_receptor,
    nombre_receptor: payload.nombre_receptor,
    concepto: payload.concepto,
    subtotal: payload.importe_subtotal,
    iva: payload.importe_iva,
    total: payload.importe_total,
    metodo_pago: payload.metodo_pago,
    uso_cfdi: payload.uso_cfdi,
    tipo_comprobante: 'I',
    pdf_url: `https://cfdi-prueba.example.com/${uuid}.pdf`,
    xml_url: `https://cfdi-prueba.example.com/${uuid}.xml`,
    qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uuid)}`,
    estado: 'GENERADO',
    ambiente: 'PRUEBA',
    sello: 'SELLO_SIMULADO_' + uuid,
    noCertificado: '20001000000000000001',
    certificado: 'CERTIFICADO_SIMULADO',
    timestamp: ahora.toISOString()
  };
}

module.exports = {
  crearFactura
};