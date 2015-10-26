var fs = require('fs');
var path = require('path');
var extend = require('util')._extend;
/*
 * Geeee, whata mess. Need clean rewrite.
 */

var Views = {};

function loadViews(opts) {
  opts = opts || {};
  opts.dir = opts.dir || 'app/views';
  opts.argv = opts.argv || [];

  var plus = opts.argv.filter(function(v) {
    if(v[0] !== '-') {
      return true;
    }
  })

  var minus = opts.argv.filter(function(v) {
    if(v[0] === '-') {
      return true;
    }
  })

  opts.dir = path.resolve(opts.dir);

  var dirs = plus;

  if(!dirs.length) {
    dirs = fs.readdirSync(opts.dir);
  }

  dirs.forEach(function(subs) {
    if(minus.length && (minus.indexOf('-' + subs) >= 0)) {
      return true;
    }

    if(subs[0] === '.') {
      return true;
    }

    Views[subs] = Views[subs] || {};
    var files = fs.readdirSync(path.join(opts.dir, subs));

    files.forEach(function(file) {
      if(file[0] === '.') {
        return true;
      }
      var suffix = path.extname(file);
        var base = path.basename(file, suffix);

        if(!Views[subs][base]) {
          Views[subs][base] = fs.readFileSync(path.join(opts.dir, subs, file)).toString();
        }
      })
    })

  return Views;
}

function ViewComponent(opts) {
  opts = opts || {};

  this.forEach = function(params, callback) {
    params = params || {};
    var compiled = {};

    for(var v in views) {
      for(var t in views[v]) {
        var suffix = path.extname(t);

        if(!params.type || params.type == suffix) {
          /*callback(requireView({
            dir: opts.dir,
            view: v,
            template: t,
            suffix: suffix
          }))*/
        }
      }
    }
  }
}

ViewComponent.prototype.start = function() {}

// Wtf lol?
ViewComponent.prototype.require = function(opts) {
  if(!opts) {
    // if needed load all app/views/*
    if(!Object.keys(Views).length) {
      Views = loadViews();
    }
    return Views;
  }

  if(opts.view) {
    if(opts.type) {
      // if needed load all from app/views/{view} with sepecific type
    } else {
      // if needed load all from app/views/{view} 
    }
  }

  if(opts.type) {
    // if needed load all from app/views/*/{view} with sepecific type
  }

  opts.v = opts.dir ? path.resolve(opts.dir) : path.resolve('app/views');
  var dirs = [];
  //var dirs = fs.readdirSync(opts.dir);

  /*dirs.forEach(function(subs) {
    views[subs] = {};
    console.log('SUBS:'+JSON.stringify(subs));

    var files = fs.readdirSync(path.join(opts.dir, subs));

    files.forEach(function(file) {
      var name = path.basename(file);
      views[subs][name] = path.join(opts.dir, subs, file);
    })
  })*/
}

ViewComponent.create = function(opts) {
  console.log('ViewComponent.create:'+JSON.stringify(opts));
  //process.exit(0);
  return new this(opts);
}

if(module.parent) {
  module.exports = ViewComponent;
} else {
  console.log(JSON.stringify(loadViews({argv: process.argv.slice(2)})));
}
