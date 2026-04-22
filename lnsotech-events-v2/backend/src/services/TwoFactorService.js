const otplib = require('otplib');
const qrcode = require('qrcode');

class TwoFactorService {
    generateSecret(userEmail) {
        // No otplib v13, usamos o segredo gerado via funcional
        const secret = otplib.generateSecret();
        // No v13, keyuri chama-se generateURI e recebe um objeto
        const otpauth = otplib.generateURI({
            secret,
            label: userEmail,
            issuer: 'LNSOTECH Automation'
        });
        return { secret, otpauth };
    }

    async generateQRCode(otpauth) {
        return await qrcode.toDataURL(otpauth);
    }

    verifyToken(token, secret) {
        // Usamos verifySync para manter a compatibilidade síncrona
        return otplib.verifySync({
            token,
            secret
        });
    }
}

module.exports = new TwoFactorService();
