var fs = require('fs');
var path = require('path');
var util = require('util');
var config = require(path.resolve('config/initializers/locale.json'));

function localeComponent() {};

localeComponent.prototype.config = function() {
  return config;
}

localeComponent.prototype.locales = function() {
  var locales = [];

  fs.readdirSync(config.load_path).forEach(function(locale) {
    var locale = path.basename(locale, '.json');
    locales.push(locale);
  })

  return locales;
}

localeComponent.prototype.require = function(locale) {
  config.load_path = config.load_path || "public/locales";
  console.log('LOCALE REQUIRE:'+locale);

  fs.readdirSync(config.load_path).forEach(function(locale) {
    var file = path.resolve(config.load_path, locale);
    var locale = require(file);
    console.log('locale:'+JSON.stringify(locale));
  })
}

localeComponent.prototype.start = function() {
  console.log('START');
  // GLOBAL.I18n = this;
}

localeComponent.create = function(obj) {
  // return new this(opts);
}

if(module.parent) {
  module.exports = localeComponent;
} else {
  console.log('no parent: ' + JSON.stringify(process.argv));
  var localeDir = path.resolve(config.load_path);
}
