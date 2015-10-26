function Generator() {
}

module.exports = function(opts) {
  var G = require('./generators/' + opts.name);
  return new G(opts);
}
