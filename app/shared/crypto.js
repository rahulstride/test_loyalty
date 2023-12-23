const crypto = require('crypto');
var key = process.env.CRYPTO_KEY

//Encrypting text
function encrypt(text) {
    var encrypt = crypto.createCipheriv('des-ede3', key, "");
    var theCipher = encrypt.update(text, 'utf8', 'base64');
    return theCipher += encrypt.final('base64');

}

// Decrypting text
function decrypt(text) {
    var decrypt = crypto.createDecipheriv('des-ede3', key, "");
    var s = decrypt.update(text, 'base64', 'utf8');
    return s + decrypt.final('utf8')
}

exports.encrypt = encrypt;
exports.decrypt = decrypt;