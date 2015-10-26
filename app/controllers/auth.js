module.exports = function() {
  this.exportAs = 'AuthsController';

  this.auth = function(params, callback) {
    console.log('AUTH:'+JSON.stringify(params));

    if(!params.email || !params.password) {
      callback(403);
      return;
    }

    Knex('users').where({email: params.email}).select('*').then(function(result) {
      console.log('AUTH KNEX:'+JSON.stringify(result));
      var passport = {user: result[0]};

      if(!passport.user) {
        callback(403);
        return;
      }

      var banana = passport.user.password.split('$');

      if(4 !== banana.length) {
        callback(403);
        return;
      }

      var algo = banana[1];
      var salt = banana[2];
      var key = banana[3];

      if(!CryptsController[algo]) {
        callback(500);
        return;
      }

      CryptsController[algo] (params.password, salt, function(err, hash) {
        var pwd = '$' + algo + '$' + salt + '$' + key;

        if(hash === pwd) {
          delete passport.user.password;
          callback(null, passport);
        } else {
          callback({message: 'Wrong credentials'});
        }
      })
    }).error(function(err) {
      console.log('auth error?');
      callback({message: err});
    })
  }
}
