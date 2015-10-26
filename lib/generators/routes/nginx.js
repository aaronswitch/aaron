/*
nginx.js -- nginx route generator
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
var helper = require('helper');

exports.generate = function(state, conf) {
  if(!conf || !('static' in conf)) {
    throw 'config/routes.json not correct';
  }

  var setup = conf.static;
  var url_path = setup.url_path;
  var dir = path.resolve('app', 'controllers');

  /*
   * resources, namespaces and rest are for REST/restify
   */
  var generateResources = function(conf) {
    var res = conf.routes.resources || [];
    var output = "";
    var port = "";

    for(var i = 0; i < res.length; i++) {
      var url = res[i];
      var file = null;
      var module = null;

      if(res[i].match(/^\//)) {
        file = path.resolve(dir, res[i].slice(1));
      } else {
        file = path.resolve(dir, res[i]);
      }

      if(helper.existsSync(file + '.rest.js')) {
        file = file + '.rest.js';
      } else {
        if(helper.existsSync(file + '.restify.js')) {
          file = file + '.restify.js';
        } else {
          throw Error('Unable to find ' + file + ' controller');
        }
      }

      module = new (require(file))();
      //console.log("module: "+typeof module);

      if(module) {
        var server = conf.REST.server;

        if('port' in conf.REST) {
          port = ":" + conf.REST.port;
        }

        if('protocol' in conf) {
          server = conf.REST.protocol + server;
        } else {
          server = 'http://' + server;
        }

        output = [
          output,
          "  location " + url_path + res[i] +" {",
          "    proxy_pass " + server + port + url_path + url + ";",
          "    proxy_redirect off;",
          "  }",
        ].join('\n');
      }
    }

    return output;
  }

  var generateNamespaces = function(conf) {
    var nss = conf.routes.namespace || {};
    var output = "";
    var port = "";

    for(var ns in nss) {
      for(var j = 0; j < nss[ns].length; j++) {
        var url = nss[ns][j];
        var file = null;
        var module = null;

        if(ns[j].match(/^\//)) {
          file = path.resolve(dir, nss[ns][j].slice(1));
        } else {
          file = path.resolve(dir, nss[ns][j]);
        }

        if(helper.existsSync(file + '.rest.js')) {
          file = file + '.rest.js';
        } else {
          if(helper.existsSync(file + '.restify.js')) {
            file = file + '.restify.js';
          } else {
            throw Error('Unable to find ' + file + ' controller');
          }
        }

        module = new (require(file))();

        if(module) {
          var server = conf.REST.server;

          if('port' in conf.REST) {
            port = ":" + conf.REST.port;
          }

          if('protocol' in conf) {
            server = conf.REST.protocol + server;
          } else {
            server = 'http://' + server;
          }

          output = [
            output,
            "  location " + url_path + ns + nss[ns][j] +" {",
            "    proxy_pass " + server + port + url_path + url + ";",
            "    proxy_redirect off;",
            "  }",
          ].join('\n');
        }
      }
    }

    return output;
  }

  var generateRest = function(conf) {
    var routes = conf.routes;
    var output = "";

    for(var r in routes) {
      if(('resources' === r) || ('namespace' === r)) {
        continue;
      }

      if("/" == url_path) url_path = "";

      var file = path.resolve(dir, routes[r].controller);

      if(helper.existsSync(file + '.rest.js')) {
        file = file + '.rest.js';
      } else {
        if(helper.existsSync(file + '.restify.js')) {
          file = file + '.restify.js';
        } else {
          throw Error('Unable to find ' + file + ' controller');
        }
      }

      var module = new (require(file))();

      if(module) {
        var server = conf.REST.server;
        var proto = conf.REST.protocol;
        var port = "";

        if('port' in conf.REST) {
          port = ":" + conf.REST.port;
        }

        if('protocol' in conf) {
          server = conf.REST.protocol + server;
        } else {
          server = 'http://' + server;
        }

        var parts = r.match(/^([^ \t]+)[ \t]+(.+)$/);

        if(parts && parts[2]) {
          output = [
            output,
            "  location " + url_path + parts[2] +" {",
            "    proxy_pass " + server + port + url_path + parts[2] + ";",
            "    proxy_redirect off;",
            "  }",
          ].join('\n');
        }
      }
    }

    return output;
  }

  var generateSocketIo = function(conf) {
    var routes = conf.routes;
    var output = "";

    /*
     * Looks like socket.io is multiplexing all over /socket.io/
     * If that is correct, only /socket.io should be generated.
     * Because of that, only one socket.io server can be started per app.
     */
    if('socket.io' in conf) {
      var c = conf['socket.io'];

      if('port' in c) {
        if(c.port) {
          c.port = ':' + c.port;
        } else {
          c.port = '';
        }
      } else {
        c.port = "";
      }

      output = [
        output,
        "  location " + "/socket.io {",
        "    proxy_pass " + c.protocol + c.server + c.port + "/socket.io;",
        "    proxy_redirect off;",
        "  }",
      ].join('\n');
    }

    return output;
  }

  /*
   * All other pass properties!
   */
  var generatePass = function(obj) {
    var output = "";
    var reserved = [ 'static', 'resources', 'namespace', 'routes', 'socket.io' ];
    var conf = {};

    for(conf in obj) {
      var forward = false;

      for(var i = 0; i < reserved.length; i++) {
        if(conf === reserved[i]) {
          forward = true;
          break;
        }
      }

      if(forward) {
        continue;
      }

      if('pass' in obj[conf] && 'server' in obj[conf]) {
        var server = obj[conf].server;
        var pass = Object.keys(obj[conf].pass);
        var proto = obj[conf].protocol;
        var port = "";

        if('port' in obj[conf]) {
          port = ":" + obj[conf].port;
        }

        if('protocol' in obj[conf]) {
          server = obj[conf].protocol + server;
        } else {
          server = 'http://' + server;
        }

        for(var i = 0; i < pass.length; i++) {
          if("/" == url_path) url_path = "";

          if(obj[conf].pass[pass[i]]) {
            output = [
              output,
              "  location " + url_path + pass[i] +" {",
              "    proxy_pass " + server + port + url_path + pass[i] + ";",
              "    proxy_redirect off;",
              "  }",
            ].join('\n');
          }
        }
      }
    }

    return output;
  }

  if(!!setup && (('doc_root' in setup)
      && ('vhost' in setup)
      && ('dir_path' in setup)
      && ('url_path' in setup)
      && ('server_name' in setup)
      && ('errlog' in setup)
      && ('accesslog' in setup))) {

    var doc_root = path.resolve(setup.doc_root);
    var dir_path = path.resolve(setup.dir_path);
    var url_path = setup.url_path;

    var output = [
      "server {", 
      "  listen " + setup.vhost + ";",
      "  server_name " + setup.server_name + ";",
      "  index index.html;",
      "  root " + doc_root + ";",
      "  error_page  404 /404.html;",
    ].join('\n');

    if('/' !== url_path) {
      var output = [
        output,
        "  location " + url_path + " {",
        "    alias " + dir_path + ";",
        "  }",
      ].join('\n');
    } else {
      var output = [
        output,
        "  location / {",
        "    root " + dir_path + ";",
        "  }",
      ].join('\n');
    }

    url_path = setup.url_path;
    if("/" == url_path) url_path = "";

    var check = false;

    output = [
      output,
      generateRest(conf),
      generateResources(conf),
      generateNamespaces(conf),
      generatePass(conf),
      generateSocketIo(conf),
    ].join('\n');

    output = [ output, "}" ].join('\n');
    console.log(output);
  }
}

