var fs = require('fs');
var path = require('path');
var extend = require('util')._extend;

function requireDatabase(file) {
  console.log('FILE:'+file);
  return require(file || path.resolve('config/database.json'));
}

function findModels(opts) {
  opts = opts || {};
  opts.dir = opts.dir ? path.resolve(opts.dir) : path.resolve('app/models');
  var files = fs.readdirSync(opts.dir);
  var models = {};

  files.forEach(function(file) {
    if(file[0] === '.') {
      return true;
    }

    var suffix = path.extname(file);

    if(suffix === '.js') {
      var name = path.basename(file, '.js');
      models[name] = path.join(opts.dir, file);
    }
  })

  console.log('loadModels:'+JSON.stringify(models));
  return models;
}

module.exports = function(opts) {
  opts = opts || {};
  console.log('MODEL CONSTRUCTOR:'+JSON.stringify(opts));

  this.db = requireDatabase(opts.conf);
  this.files = findModels();
}

module.exports.create = function(opts) {
  return new this(opts);
}
