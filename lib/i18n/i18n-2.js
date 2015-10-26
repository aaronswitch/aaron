var path = require('path');
var util = require('util');
var component = require('./');
var i18n2 = require('i18n-2');

function i18n(o) {
  console.log('OPTS:'+JSON.stringify(o));
  var config = this.config();
  var locales = this.locales();
  var idx = locales.indexOf(config.default_locale);

  this.attach = i18n2.expressBind;

  if(idx < 0) {
    var en = locales.indexOf('en');
    console.log('en:'+en);

    if(en >= 0) {
      locales.splice(en, 1);
    }

    config.default_locale = 'en';
  } else {
    locales.splice(idx, 1);
  }

  locales.unshift(config.default_locale);

  this.opts = {
    directory: config.load_path,
    extension: '.json',
    locales: locales
  }

  var i = new i18n2({
    directory: config.load_path,
    extension: '.json',
    locales: locales
  })

  this.t = i.__.bind(i);
  GLOBAL.I18n = this;
}

util.inherits(i18n, component);
module.exports = i18n;
