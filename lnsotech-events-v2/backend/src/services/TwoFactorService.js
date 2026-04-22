const { authenticator } = require('otplib');
const qrcode = require('qrcode');

class TwoFactorService {
    generateSecret(userEmail) {
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(userEmail, 'LNSOTECH Automation', secret);
        return { secret, otpauth };
    }

    async generateQRCode(otpauth) {
        return await qrcode.toDataURL(otpauth);
    }

    verifyToken(token, secret) {
        return authenticator.check(token, secret);
    }
}

module.exports = new TwoFactorService();
