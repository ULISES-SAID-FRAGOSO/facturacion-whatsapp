const nodemailer = require('nodemailer');

// Configura transporte de email
// Usando Gmail con contraseña de aplicación
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'tu-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'tu-contraseña-aplicacion'
  }
});

async function enviarCFDIAlCliente(datosFactura, datosCliente) {
  try {
    console.log('\n📧 ========== ENVIANDO EMAIL AL CLIENTE ==========');
    console.log(`📨 Destinatario: ${datosCliente.email}`);

    // Contenido del email
    const mailOptions = {
      from: process.env.EMAIL_USER || 'tu-email@gmail.com',
      to: datosCliente.email,
      subject: `🧾 Tu Factura - Folio: ${datosFactura.folio}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          
          <h2 style="color: #333; text-align: center;">✅ FACTURA GENERADA</h2>
          
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0066cc; margin-top: 0;">📋 Detalles de tu Factura:</h3>
            
            <p><strong>Folio:</strong> ${datosFactura.folio}</p>
            <p><strong>Serie:</strong> ${datosFactura.serie}</p>
            <p><strong>UUID:</strong> <code style="background: #eee; padding: 5px;">${datosFactura.uuid}</code></p>
            <p><strong>Fecha:</strong> ${datosFactura.fecha}</p>
            
            <hr style="border: none; border-top: 1px solid #ccc; margin: 15px 0;">
            
            <h3 style="color: #0066cc;">💰 Montos:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #ddd;">
                <td><strong>Subtotal:</strong></td>
                <td style="text-align: right;">$ ${parseFloat(datosFactura.subtotal).toFixed(2)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #ddd;">
                <td><strong>IVA (16%):</strong></td>
                <td style="text-align: right;">$ ${parseFloat(datosFactura.iva).toFixed(2)}</td>
              </tr>
              <tr style="background-color: #fff3cd;">
                <td><strong style="font-size: 18px;">TOTAL:</strong></td>
                <td style="text-align: right; font-size: 18px;"><strong>$ ${parseFloat(datosFactura.total).toFixed(2)}</strong></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333;">🏥 Servicios Prestados:</h3>
            <p>${datosFactura.concepto || 'Servicios Odontológicos'}</p>
            
            <h3 style="color: #333;">👤 Datos del Cliente:</h3>
            <p><strong>Nombre:</strong> ${datosCliente.nombre}</p>
            <p><strong>RFC:</strong> ${datosCliente.rfc}</p>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <h3>🔗 Archivos de tu Factura:</h3>
            <p>
              <a href="${datosFactura.pdf_url}" style="display: inline-block; margin: 5px; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">📄 Descargar PDF</a>
              <a href="${datosFactura.xml_url}" style="display: inline-block; margin: 5px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">📋 Descargar XML</a>
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Factura generada automáticamente por Sistema de Facturación WhatsApp</p>
            <p>Este email fue enviado desde un proceso automatizado. No responder a este correo.</p>
          </div>

        </div>
      `,
      attachments: [
        {
          filename: `CFDI_${datosFactura.folio}.pdf`,
          content: Buffer.from(datosFactura.pdf_base64 || 'PDF_SIMULADO'), // Si tienes PDF en base64
          contentType: 'application/pdf'
        }
      ]
    };

    // Envía el email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email enviado exitosamente');
    console.log(`📨 Message ID: ${info.messageId}`);
    console.log('==========================================\n');

    return {
      success: true,
      messageId: info.messageId,
      mensaje: 'Email enviado correctamente'
    };

  } catch (error) {
    console.error('\n❌ ========== ERROR ENVIANDO EMAIL ==========');
    console.error('Error:', error.message);
    console.error('==========================================\n');

    return {
      success: false,
      error: error.message || 'Error enviando email'
    };
  }
}

// Función alternativa: Envía email simple de confirmación
async function enviarConfirmacion(email, asunto, mensaje) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'tu-email@gmail.com',
      to: email,
      subject: asunto,
      html: `<p>${mensaje}</p>`
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error enviando email:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  enviarCFDIAlCliente,
  enviarConfirmacion
};