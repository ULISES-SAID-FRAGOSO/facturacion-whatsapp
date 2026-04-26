const axios = require('axios');

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
    console.log('\n⚙️  =========== GENERANDO CFDI EN ONEFACTURE ===========');
    
    // Prepara payload
    const subtotal = datos.subtotal || (datos.total / 1.16);
    const iva = datos.iva || (datos.total - subtotal);

    const payload = {
      rfc_emisor: process.env.RFC_DENTISTA,
      rfc_receptor: datos.rfc,
      nombre_receptor: datos.nombre,
      concepto: datos.concepto || 'Servicios dentales',
      importe_subtotal: parseFloat(subtotal).toFixed(2),
      importe_iva: parseFloat(iva).toFixed(2),
      importe_total: parseFloat(datos.total).toFixed(2),
      metodo_pago: datos.metodoPago || '01', // 01 = Efectivo
      uso_cfdi: 'G301', // Servicios generales
      tipo_factura: 'I', // Ingreso
      serie: 'A',
      correo_receptor: datos.emailDestino || '',
      observaciones: `Factura generada automáticamente por sistema de facturación`
    };

    console.log('📦 Payload OneFacture:');
    console.log(JSON.stringify(payload, null, 2));

    const response = await onefactureApi.post('/factura/emitir', payload);

    console.log('\n✅ RESPUESTA ONEFACTURE:');
    console.log(JSON.stringify(response.data, null, 2));

    const cfdi = {
      folio: response.data.folio,
      serie: response.data.serie || 'A',
      uuid: response.data.uuid,
      pdf_url: response.data.pdf_url,
      xml_url: response.data.xml_url,
      timestamp: new Date().toISOString(),
      rfc_receptor: datos.rfc,
      total: datos.total
    };

    console.log('=====================================================\n');

    return {
      success: true,
      cfdi: cfdi
    };

  } catch (error) {
    console.error('\n❌ ========== ERROR ONEFACTURE ==========');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    console.error('========================================\n');

    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Error desconocido en OneFacture'
    };
  }
}

module.exports = {
  crearFactura
};