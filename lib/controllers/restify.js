/*
restify.js -- restify 
Copyright (C) 2012 Ivan Popovski
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
var fs = require('fs');
var path = require('path');
var extend = require('util')._extend;
var restify = require('restify');
var bodyParser = require('restify-plugin-json-body-parser');
var cors = require('../../config/cors.json');

function pathNormalize(url) {
  return url.replace(/\/+/g, '/');
}

function methodNormalize(method) {
  switch (method) {
    case 'DELETE':
    case 'delete':
    case 'DEL':
    case 'del':
      return 'del';
      break;
    case 'OPTIONS':
    case 'options':
    case 'OPTS':
    case 'opts':
      return 'opts';
      break;
  }

  return method.toLowerCase();
}

if(cors.on && cors.reload) {
  setInterval(function() {
    fs.readFile('./config/cors.json', function(ex, data) {
      if(ex) {
        console.log('Error readin config/cors.json: ' + ex);
        return;
      }

      var settings;

      try {
        settings = JSON.parse(data);
      } catch(e) {
        console.log('Error parsing config/cors.json: ' + e);
      }

      cors = settings || cors;
     })
  }, cors.reload*1000);
}

function ControllersRestify(wha) {
  console.log('ControllersRestify:'+JSON.stringify(wha));

  function restifyInit(opts) {
    var server,
        serverOpts = {};

    console.log('OPTTS:'+JSON.stringify(opts));
    opts = opts || {conf: '../../config/rest.json'}
    console.log('OPS:'+JSON.stringify(opts));
    var conf = require(opts.conf);
    console.log('CONF:'+JSON.stringify(conf));
    var Component = require(__dirname).create(conf);
    //var routes = Component.routes(require(conf.routes).routes);
    var routes = Component.routes(conf.routes);

    if(conf['content-formatters']) {
      var formatters;

      try {
        formatters = require(path.resolve(conf['content-formatters']));
      } catch(e) {
        console.log('Error opening content formatter `' + path.resolve(conf['content-formatters']) + '` with error: ' + e);
        throw(e);
      }

      extend(serverOpts, {formaters: formatters});
    }

    server = restify.createServer(serverOpts);
    // server.use(restify.bodyParser());

    function corsHandler(req, res, next) {
      for(var i in cors.headers) {
        res.header(i, cors.headers[i]);
      }

      if (req.method.toLowerCase() === 'options') {
        // if (res.methods.indexOf('OPTIONS') === -1) res.methods.push('OPTIONS');
        res.send(204);
        return next(false);
      }
      return next();
    }

    if(cors.on) {
      server.pre(corsHandler);
    }

    server.use(restify.queryParser());
    server.use(bodyParser());

    if(conf.static.serve) {
      server.get(/.+\.[^\.]+$/, restify.serveStatic({
        directory: './public/',
        default: 'index.html'
      }))
    }

    if(GLOBAL.I18n && I18n.attach) {
      I18n.attach(server, I18n.opts);
    }

    server.listen(conf.port, conf.host, function() {
      console.log('%s listening at %s', server.name, server.url);
    })

    this.use = function(callback) {
      server.use(callback)
    }

    this.start = function(app) {
      console.log('RESTIFY ROUTES:'+JSON.stringify(routes));

      for(var i = 0; i < routes.length; i++) {
        console.log('RESTIFY START:'+JSON.stringify(routes[i]));
        var method = methodNormalize(routes[i].method);
        var action = routes[i].action;
        var controller = Component.require(routes[i].controller);

        app.export(controller.exportAs, controller);
        server[method] (conf.prefix + routes[i].path, controller[action]);
      }
      Component.finish(app);
    }
  }

  // return new restifyInit(opts);
  return restifyInit;
}

if(!module.parent) {
  var restifyController = ControllersRestify(null);
  restifyController.start();
} else {
  module.exports = ControllersRestify();
}
