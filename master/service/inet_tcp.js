var net = require('net');

function tcpService(opts) {
  this.pending = true;

  var srv = opts.service.split(':');
  this.host = srv[1];
  this.port = srv[2];
}

tcpService.prototype.create = function(master) {
  var self = this;

  net.createServer(function (socket) {
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
        Master.submit(msgs);
      }
    })
  }).listen(this.port, this.host)
}

module.exports = tcpService;
