var crypto = require('crypto');
var auth = require('../../config/auth.json');

module.exports = function() {
  this.exportAs = 'CryptsController';

  this.pbkdf2 = function(pass, salt, callback) {
    var s = new Buffer(salt || '', 'base64').toString('binary');

    crypto.pbkdf2(pass, s, auth.iterations, auth.len, function(err, derivedKey) {
      console.log('lalal');
      var pbk = (new Buffer(derivedKey, 'binary')).toString(auth.encoding);
      callback(null, '$' + auth.prefix + '$' + salt + '$' + pbk);
    })
  }
}
