/*
framework.js -- framework code 
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
var fs = require("fs");
var path = require("path");
var extend = require('util')._extend;

var App = function(opts) {
  if(typeof opts.conf === 'string') {
    extend(this, opts.framework.require(opts.conf))
  } else {
    extend(this, opts.conf);
  }

  this.state = 0;
  this.version = opts.version;
  this.name = opts.name;
  this.framework = opts.framework;
  this.runtime = {};

  if(this.env) {
    for(var e in this.env) {
      console.log('process.env.' + e + '=' + this.env[e]);
      process.env[e] = this.env[e];
    }
  }

  if(this.exportAs) {
    console.log('Export app as: '+this.exportAs);
    GLOBAL[this.exportAs] = this;
  }

  for(var name in this.components) {
    if(this.components[name].on) {
      var options  = this.components[name].opts;

      this.framework.insert({
        name: name,
      })

      var component = this.framework.component(name);

      if(typeof component === 'function') {
        component = new component(options);
      }

      component.type = name.split('/') [0];
      this.runtime[name] = component;
    }
  }

  for(var name in this.runtime) {
    console.log('runtime: '+name);
  }

  this.init();

  if(opts.boot) {
    this.boot(function(dmesg) {
      console.log('Boot message: ' + dmesg);
    })
  }
}

App.prototype.forEach = function(opts, callback) {
  if('function' === typeof opts) {
    callback = opts;
    opts = false;
  }

  console.log('forEach keys:'+Object.keys(this.runtime));

  for(var name in this.runtime) {
    var component = this.runtime[name];
    console.log('forEach:'+name);

    if(!opts) {
      callback(component, name);
    } else if(opts.name === name) {
      callback(component, name);
    }
  }
}

App.prototype.find = function(name) {
  console.log('find:'+name);
  return this.runtime[name];
}

App.prototype.findAll = function(type, callback) {
  this.forEach({type: type}, function(item) {
    return callback(item);
  })
}

App.prototype.export = function(name, obj) {
  console.log('app export: '+name);
  GLOBAL[name] = obj;
}

App.prototype.boot = function(callback) {
  if(this.state) {
    callback('Already booted?');
    return;
  }

  var app = this;

  this.forEach(function(component, name) {
    component.start(app);
  })

  this.state++;
  callback('Boot finished');
}

App.prototype.init = function() {
  this.pid = process.pid;
  this.signals = {};

  if(this.pidfile !== false) {
    this.pidfile = this.pidfile || 'tmp/app.pid';
  }

  if(this.pidfile && fs.existsSync(this.pidfile)) {
    throw 'Existing pid file: ' + this.pidfile;
  }

  if(process.env.GID || !!this.gid) {
    if (process.getgid && process.setgid) {
      try {
        var gid = process.env.GID || this.gid;
        process.setgid(!isNaN(gid) ? parseInt(gid) : gid);
      } catch (err) {
        console.log('Failed to set gid: ' + err);
      }
    }
  }

  if(process.env.UID || !!this.uid) {
    if (process.getuid && process.setuid) {
      try {
        var uid = process.env.UID || this.uid;

        process.setuid(!isNaN(uid) ? parseInt(uid) : uid);
      } catch (err) {
        console.log('Failed to set uid: ' + uid +','+err);
      }
    }
  }

  if(this.pidfile) {
    fs.writeFileSync(this.pidfile, this.pid);
  }

  var self = this;

  process.on('exit', function(code) {
    if(self.pidfile) {
      fs.unlinkSync(self.pidfile);
    }
  })
}

var Framework = function(opts, callback) {
  this.name = 'jails';
  this.version = '0.0.2';
  this.root = process.cwd();

  this.components = {};
  this.callback = callback;
}

Framework.prototype.start = function(opts, callback) {
  this.app = new App({
    name: opts.app,
    version: opts.version,
    conf: opts.conf,
    framework: this,
    boot: true,
  })

  if(callback) {
    callback.call(this, this.app);
  }

  process.on('SIGINT', function() {
    process.exit(1);
  })

  process.on('SIGTERM', function() {
    process.exit(2);
  })
}

Framework.prototype.forEach = function(callback) {
  for(var name in this.components) {
    if(false === callback(this.components[name], name)) {
      break;
    }
  }
}

Framework.prototype.toString = function() {
  var components = [];
  var app = [];

  this.forEach(function(component, name) {
    components.push(name);
  })

  this.app.forEach(function(component, name) {
    app.push(name);
  })

  return [
    'App [' + this.app.name + '][v' + this.app.version + ']: ' + app.toString(),
    'Framework[' + this.name + '][v' + this.version + ']: ' + components.join(', '),
  ].join('\n');
}

Framework.prototype.require = function() {
  var file = path.join.apply(this, arguments);
  console.log('framework require: '+file);
  return require(path.resolve(this.root, file));
}

Framework.prototype.component = function(name) {
  console.log('component get: '+JSON.stringify(name));
  return this.components[name];
}

/*
 * Insert component item. Only once.
 */
Framework.prototype.insert = function(item) {
  console.log('framework insert: '+JSON.stringify(item));

  if(!this.components[item.name]) {
    var component = this.require('lib', item.name);
    this.components[item.name] = component;
  }
}

module.exports = Framework;
