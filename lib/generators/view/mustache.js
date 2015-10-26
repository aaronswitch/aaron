/*
mustache.js -- mustache template generator
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

/*
 */
var fs = require("fs");
var sys = require("sys");
var path = require("path");
var wrench = require("wrench");
var helper = require("helper");

/*
 * Refresh public/config.json from app/views/{subdirs}/{files}.mustache
 */
var regenerate = function(tmplDir, dirs) {
  var configPath = path.resolve('public', 'config.json');
  var configJson = {};
  var meta = "{{}}";

  if(helper.existsSync(configPath)) {
    configJson = require(configPath);

    if(!!configJson.meta) {
      meta = configJson.meta;
    }
  }

  var app = helper.jReadSync(path.resolve('config', 'application.json'));
  var routes = helper.jReadSync(path.resolve('config', 'routes.json'));
  var web = helper.jReadSync(path.resolve('config', 'web.json'));
  var locale = helper.jReadSync(path.resolve('config', 'locales.json'));
  var session = helper.jReadSync(path.resolve('config', 'session.json'));

  if(!web.type) {
    routes.static.type = "REST";
    web.type = "REST";
  }

  if("front" === web.type) {
    configJson = {
      type: "mustache",
      protocol: web.static.protocol,
      secure: web.static.secure,
      host_name: web.static.server_name,
      port: web.static.port,
      url_path: web.static.url_path,
      meta: meta
    }
  } else {
    if(!!web[web.type]) {
      var t = web[web.type];

      configJson = {
        type: "mustache",
        protocol: t.protocol,
        secure: web.static.secure,
        host_name: t.server,
        port: t.port,
        url_path: web.static.url_path,
        meta: meta
      }
    } else {
      throw "Error, wrong routes static type";
    }
  }

  if(!!locale) {
    configJson.locale = locale;
  }

  if(!!session && !!session.on) {
    if(!!session.path) {
      configJson.session = {path: session.path};
    }
    if(!!session.domain) {
      configJson.session = configJson.session || {};
      configJson.session.domain = session.domain;
    }
    if(!!session.expiration) {
      configJson.session = configJson.session || {};
      configJson.session.expiration = session.expiration;
    }
  }

  /*if(!!app.components.controllers['socket.io'].on) {
    configJson.sock = {};
  }*/

  configJson.url = configJson.protocol + configJson.host_name;
  configJson.secure = configJson.secure + configJson.host_name;

  if(!!configJson.port) {
    configJson.url += ':' + configJson.port;
    configJson.secure += ':' + configJson.port;
  }

  if(!!routes['socket.io']) {
    configJson['socket.io'] = configJson.url;

    if('/' !== configJson.url.charAt(configJson.url.length - 1)) {
      configJson['socket.io'] += '/';
    }
    console.log('sourcet io:'+configJson['socket.io']);
  }

  configJson.url += configJson.url_path;
  configJson.secure += configJson.url_path;
  configJson.views = {};

  for(var i = 0; i < dirs.length; i++) {
    var files = wrench.readdirSyncRecursive(path.join(tmplDir, dirs[i]));

    for(var j = 0; j < files.length; j++) {
      var name = files[j].match("^(.+)\.mustache$");

      if(name && name[1]) {
        var stats = fs.statSync(path.resolve(tmplDir, dirs[i], files[j]));

        if(stats.isFile()) {
          var tmpl = path.basename(path.join(tmplDir, dirs[i]));
          if(!configJson['views'][tmpl]) {
            configJson.views[tmpl] = {};
          }
          var p = path.resolve(tmplDir, dirs[i], files[j]);
          var data = helper.fReadSync(p);

          if(data) {
            configJson.views[tmpl][name[1]] = data;
          }
        }
      }
    }
  }

  configJson.views['I18N'] = {
    'I18N': [
      '<div id="__i18n_translator__">',
      '  <script>',
      '    $("#__i18n_translator__").parent()._t($.trim($("#__i18n_translator__").parent().children().remove().end().text()));',
      '  </script>',
      '</div>'
    ].join('\n')
  }

  if(helper.existsSync(configPath)) {
    console.log("  update public/config.json");
  } else {
    console.log("  create public/config.json");
  }

  if(helper.jWriteSync(configPath, configJson)) {
    throw 'json write error: ' + configPath;
  }
}

exports.init = function(viewDir) {
  var sources = this.sources;
  var tmplSrc = path.resolve(sources, 'tmpl');
  var dirs = [];

  viewDir = viewDir || path.resolve('app', 'views');

  /*
   * Additional argument
   */ 
  if(!!this.argv[this.arg]) {
    if(!helper.existsSync(viewDir)) {
      fs.mkdirSync(viewDir);
    } else {
      var stat = fs.statSync(viewDir);

      if(!stat.isDirectory()) {
        throw Error(viewDir + " is not directory");
      }
    }

    var baseName = this.argv[this.arg];
    var tmplDir = path.resolve(viewDir);
    var tmplName = path.resolve(tmplDir, this.argv[this.arg] + '.mustache');

    this.arg++;
    var stats = null;

    if(!!this.argv[this.arg]) {
      tmplName = path.resolve(tmplDir, this.argv[this.arg] + ".mustache");
      baseName = this.argv[this.arg];

      if(!helper.existsSync(tmplDir)) {
        fs.mkdirSync(tmplDir);
      } else {
        var stat = fs.statSync(tmplDir);

        if(!stat.isDirectory()) {
          throw Error(viewDir + this.argv[this.arg] + " is not directory");
        }
      }
    } else {
    }

    if(!helper.existsSync(tmplName)) {
      if(helper.fWriteSync(tmplName, "Hello {{{ping}}}")) {
        throw 'json write error: ' + tmplName;
      }
    } else {
      if(this.force) {
        if(!helper.fWriteSync(tmplName, "Hello {{{ping}}}")) {
          throw 'json write error: ' + tmplName;
        }
      }
    }
  } 

  var files = wrench.readdirSyncRecursive(viewDir);

  for(var i = 0; i < files.length; i++) {
    var stats = fs.statSync(path.join(viewDir, files[i]));
    if(stats.isDirectory()) {
      if('layouts' !== files[i]) {
        dirs.push(files[i]);
      }
    }
  }

  regenerate.call(this, viewDir, dirs);
  this.arg++;
}

