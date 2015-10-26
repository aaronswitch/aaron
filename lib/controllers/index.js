var path = require('path');
var fs = require('fs');
var dir = 'app/controllers/';

var cache = {};

module.exports = function(opts) {
  opts = opts || {};
  this.path = opts.path || dir;
  console.log('CONTROLLER COMPONENT PATH:'+JSON.stringify(opts));
  // this.routes = requireRoutes(opts.conf);
  // this.require = requireController;
  this.require = function(name) {
    console.log('requireController:' + path.resolve(this.path + name));

    if(!cache[name]) {
      cache[name] = new (require(path.resolve(this.path + name))) ();
    }
    return cache[name];
  }

  this.routes = function(file) {
    console.log('R:'+JSON.stringify(file));
    var conf = require(file || path.resolve('config/routes.json'));
    var routes = [];

    console.log('ROUTES:'+file);

    for(var i in conf.routes) {
      var route = i.split(' ');
      
      routes.push({
        method: route[0],
        path: route[1],
        controller: conf.routes[i].controller,
        action: conf.routes[i].action,
      })
    }

    console.log('ROUTES:'+JSON.stringify(routes));
    return routes;
  }

  this.finish = function(app) {
    var self = this;
    var files = fs.readdirSync(this.path);

    files.forEach(function(file) {
      if(file[0] === '.') {
        return true;
      }
      var suffix = path.extname(file);

      if(suffix === '.js') {
        var name = path.basename(file, suffix);

        if(!cache[name]) {
          cache[name] = new (require(path.resolve(self.path + name))) ();

          if(cache[name].exportAs) {
            app.export(cache[name].exportAs, cache[name]);
          }
        }
      }
    })
  }
}

module.exports.create = function(opts) {
  console.log('CONTROLLER CREATE:'+JSON.stringify(opts));
  return new this(opts);
}
