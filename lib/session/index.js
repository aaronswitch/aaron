var resolve = require('path').resolve;

module.exports = function(opts) {
  return require(resolve('config/session.json'));
}

module.exports.create = function(opts) {
  return this(opts);
}
