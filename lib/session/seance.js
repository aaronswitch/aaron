var path = require('path');
var conf = require(path.resolve('config/session.json'));
var Component = require(__dirname).create();

var findCookie = function(cookieHeader, cookie) {
  if(cookieHeader) {
    var currentCursor = cookieHeader.indexOf(cookie + '=');
    var endCursor = cookieHeader.indexOf(';', currentCursor);

    return !~currentCursor ? undefined : cookieHeader.substring(
      currentCursor, ~endCursor ? endCursor : undefined
    ).split('=') [1];
  }
};

var createCookie = function(key, value, conf) {
  var expires = value ? conf.expiration : -1;
  var cookie = [key + '=' + value];

  if(expires) {
    if(expires < 0) {
      cookie.push('expires=' + new Date(0))
    } else {
      cookie.push('expires=' + new Date(new Date().getTime() + 1000*expires))
    }
  }

  conf.path && cookie.push('Path=' + conf.path);
  conf.domain && cookie.push('Domain=' + conf.domain);
  conf.httpOnly && cookie.push('HttpOnly');
  return cookie.join(';');
}

function seanceController(opts) {
  var store = require('./' + opts.storage.type).init(opts);

  function setSid(value) {
    var cookie = createCookie(Component.sid, value, Component);
    console.log('set sid: ' + cookie);
    this.setHeader('Set-Cookie', cookie);
  }

  this.start = function(app) {
    app.export('Session', store);
    var restify = app.find('controllers/restify');

    restify.use(function(req, res, next) {
      req.session = findCookie(req.headers['cookie'], Component.sid);
      res.setSid = setSid.bind(res);
      return next();
    })
  }
}

module.exports = new seanceController(conf);
