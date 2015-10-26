var resolve = require('path').resolve;

module.exports = function(opts) {
  return require(resolve('config/nosql.json'));
}

module.exports.create = function(opts) {
  return this(opts);
}
