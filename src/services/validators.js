// Valida RFC mexicano (formato básico)
function validarRFC(rfc) {
  const regexRFC = /^[A-ZÑ&]{3,4}\d{6}[A-V0-9]{3}$/;
  return regexRFC.test(rfc.toUpperCase());
}

// Valida email
function validarEmail(email) {
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regexEmail.test(email);
}

// Valida importe (número positivo)
function validarImporte(importe) {
  const num = parseFloat(importe);
  return !isNaN(num) && num > 0;
}

module.exports = {
  validarRFC,
  validarEmail,
  validarImporte
};