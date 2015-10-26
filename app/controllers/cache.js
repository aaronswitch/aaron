var submission = require('../../lib/submission.js');
var url = require('../../config/rest.json').static.url;

function createCacheEntries(params, callback) {
  console.log('create cache entries:'+Object.keys(params.submission));
  console.log('create cache data:'+JSON.stringify(params.data));

  var sub = params.submission,
      meta = sub.meta,
      to = [],
      cc = [],
      users = [],
      entries = [];

  var message = sub.getMessage();

  to = submission.parseAddress(message.To, true);
  cc = submission.parseAddress(message.Cc, true);

  if(meta && meta.parent) {
    //addrs = submission.trivialRewrite(meta.parent.data);
    //to = submission.parseAddress(meta.parent.data.To);
    //cc = submission.parseAddress(meta.parent.data.Cc);
  }

  console.log('T O:'+JSON.stringify(to));
  if(!to && !to.length) {
    callback(404);
    return;
  }

  to.forEach(function(item) {
    if(submission.myorigin.indexOf(item.origin) >= 0) {
      users.push(item.name);
    }
  })

  if(cc && cc.length) {
    cc.forEach(function(item) {
      if(submission.myorigin.indexOf(item.origin) >= 0) {
        users.push(item.name);
      }
    })
  }

  console.log('keys:'+users);
  Knex('users').select('*').whereIn('key', users).then(function(u) {
    var multi = Redis.cache.multi(),
        msg = JSON.stringify(params.submission.getMessage(true));

    u.forEach(function(item) {
      console.log('ZADD:');
      multi.zadd([item.key, params.ts, msg]);
    })

    multi.exec(function(err, results) {
      callback(null, entries);
    })
  }).catch(function(err) {
    callback(err);
  })
}

module.exports = function() {
  this.exportAs = 'CacheController';

  this.show = function(req, res, next) {
    console.log('CACHE SHOW:'+JSON.stringify(req.params));
    var key = req.params.key,
        ts = parseInt(req.params.ts);

    if(!req.session || isNaN(ts)) {
      res.send([]);
      return next();
    }

    console.log('zrangebyscore ' + key + ' ' + ts + ' withscores');
    Redis.cache.zrangebyscore([key, ts, 'inf', 'withscores'], function(err, patch) {
      console.log('Diff: '+err+','+JSON.stringify(patch));
      if(err) {
        res.send(500, err);
        return next();
      }
      res.send(patch);
      return next();
    })
  }

  this.create = function(params, callback) {
    console.log('CACHE message:'+Object.keys(params));
    var sub = params.submission;
    console.log('PARENT:'+JSON.stringify(sub.meta.parent));

    createCacheEntries(params, function(err, entries) {
     console.log('after create Cache Entries:'+err);
     callback(err, entries);
    })
  }
}
