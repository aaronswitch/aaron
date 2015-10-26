
function Store(opts) {
  this.opts = opts;
}

Store.prototype.getUser = function(keys, callback) {
  Knex('users').select('*').whereIn('key', keys).then(function(users) {
    console.log('getUser:'+JSON.stringify(users));
    callback(null, users);
  }).catch(function(err) {
    callback(err);
  })
}

Store.prototype.getPublicMessage = function(key, opts, callback) {
  Knex('messages').select('*').where({key: key}).then(function(msgs) {
    console.log('getMessage:'+JSON.stringify(msgs));

    if(!msgs || !msgs.length) {
      callback(404);
    } else {
      callback(null, msgs[0]);
    }
  })
}

Store.prototype.getPrivateMessage = function(key, opts, callback) {
  Redis.priv.hget(opts.Key, key, function(err, result) {
    console.log('Redis priv:', params.Key, params['Message-Id']);
    if(err) {
      callback(err, result);
    }
  })
}

Store.prototype.getMessage = function(key, opts, callback) {
  console.log('getParentMessage:'+key);

  if(!key) {
    callback();
    return;
  }

  switch (opts.type) {
    case 'public':
      this.getPublicMessage(key, opts, callback);
      break;
    case 'private':
      this.getPrivateMessage(key, opts, callback);
      break;
    default:
      callback(500);
      break;
  }
}

Store.prototype.storePublicMessage = function(message, opts, callback) {
  console.log('Store public:' + JSON.stringify(opts) +','+ JSON.stringify(message));
  Knex('messages').returning('*').insert({
    // key: message.Key,
    key: opts.key,
    data: message,
    references: JSON.stringify(message.References), // ?
    whitelist: JSON.stringify(opts.whitelist),
    blacklist: JSON.stringify(opts.blacklist),
  }).then(function(messages) {
    var msg = messages[0],
        parents = msg.References;

    console.log('Create message: ' + JSON.stringify(msg));
    callback(null, msg);
  }).catch(function(err) {
    console.log('store message erro:'+err);
    callback(err);
  })
}

Store.prototype.storePrivateMessage = function(message, opts, callback) {
  // Redis.priv.hset(message.Key, message['Message-Id'], JSON.stringify(message), function(err, results) {
  console.log('Redis priv:' + JSON.stringify(opts) +','+ JSON.stringify(message));
  Redis.priv.hset(opts.key, message.Key, JSON.stringify(message), function(err, results) {
    console.log('Redis err:'+err);
    console.log('Redis results:'+results);
    //callback(err, results);
    callback(err, message);
  })
}

Store.prototype.storeMessage = function(message, opts, callback) {
  console.log('storeMessage:'+JSON.stringify(message));
  console.log('storeMessage:'+JSON.stringify(opts));
  opts = opts || {};

  if('function' === typeof opts) {
    callback = opts;
    opts = {};
  }

  if(!opts.key) {
    callback(404);
    return;
  }

  console.log('opts:'+JSON.stringify(opts));

  switch (opts.type) {
    case 'public':
      //this.storePublicMessage(message, {Key: message.Key}, callback);
      this.storePublicMessage(message, opts, callback);
      break;
    case 'private':
      this.storePrivateMessage(message, opts, callback);
      break;
    default:
      callback(500);
      break;
  }
}

function storeForModeration(message, callback) {
  console.log('store for moderation to:'+message['Message-ID']);

  Redis.priv.hset(message.Key, message['Message-Id'], JSON.stringify(message), function(err, result) {
    console.log('Redis priv:', message.Key, message['Message-ID'], JSON.stringify(message));
  })
}

/*module.exports = {
  getUser: getUser,
  getMessage: getMessage,
  storeMessage: storeMessage,
  storeForModeration: storeForModeration,
}*/
module.exports = Store;
