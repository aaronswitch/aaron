var tls = require('tls');
var fs = require('fs');
var extend = require('util')._extend;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

function tlsService(opts) {
  this.pending = true;

  var srv = opts.service.split(':');
  this.host = srv[1];
  this.port = srv[2];

  this.options = {
    key: fs.readFileSync(opts.key),
    cert: fs.readFileSync(opts.cert),
    rejectUnauthorized: opts.rejectUnauthorized,
  }
}

tlsService.prototype.create = function(master) {
  var self = this;

  tls.createServer(this.options, function (socket) {
    console.log("connected");
    self.pending = false;
    self.socket = socket;

    socket.on('end', function (messages) {
      console.log('Disconnect');
    })

    socket.on('data', function (messages) {
      if(messages) {
        console.log('Messages: '+messages.toString());
        var msgs = JSON.parse(messages.toString());
        master.enqueue(msgs, master.generator);
      }
    })
  }).listen(this.port, this.host)
}

module.exports = tlsService;
