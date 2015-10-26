function Queue() {
}

module.exports = function(opts) {
  var Q = require('queues/' + opts.name);
  return new Queue(Q);
}
