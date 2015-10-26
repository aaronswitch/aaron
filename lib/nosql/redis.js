var redis = require('redis');
var conf = require(__dirname).create().redis;

function RedisComponent(opts) {
  var use = opts ? opts.use : undefined;

  if(!use) {
    opts = conf;
  } else {
    opts = {};
    use.forEach(function(item) {
     opts[item] = conf[item];
    })
  }
  var clients = this.clients = {};

  this.start = function(app) {
    app.export('Redis', clients)
  }

  for(var r in opts) {
    var item = opts[r];
    console.log(JSON.stringify(item));

    if(!!item.unixsock) {
      clients[r] = redis.createClient(item.unixsock);
    } else {
      clients[r] = redis.createClient(item);
    }

    if(item.password) {
      clients[r].auth(item.password, function(err) {
        if(err) throw err;
      })
    }

    if(item.db) {
      clients[r].select(item.db, function(err) {
        if(err) throw err;
      })
    }
  }
}

module.exports = RedisComponent;
