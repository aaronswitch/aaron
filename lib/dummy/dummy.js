module.exports = function(opts) {
  this.start = function(app) {
    app.export(opts.exportAs, {});
  }
}
