var tls = require('tls');
var fs = require('fs');
var extend = require('util')._extend;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

function parseMessage(msg) {
  try {
    return JSON.parse(msg);
  } catch(e) {
    console.log('Message error:' + e);
    console.log('Message:' + msg.toString());
  }

  return undefined;
}

function verifyPeer(data) {
  var msg = parseMessage(data);;

  if(msg) {
    if(msg.user && msg.password) {
      var table = this.peers.table[msg.user];

      if(table && msg.password === table.password) {
        this.user = msg.user;
        this.password = msg.password;
        msg.code = 200;
      } else {
        msg.code = 403;
      }
    } else {
      msg.code = 403;
    }
    return msg;
  }

  return {code: 500}
}

function Server(opts, peers) {
  this.port = opts.port;
  this.host = opts.host;
  this.peers = peers;

  this.options = extend(opts, {
    port: undefined,
    host: undefined,
    cert: fs.readFileSync(opts.cert),
    key: fs.readFileSync(opts.key),
    rejectUnauthorized: false,
  })
}

Server.prototype.connect = function() {
  var self = this;

  return function(socket) {
    self.socket = socket;

    var peer = self.peers.createPeer(self.options, extend({
      server: self.server,
      socket: socket,
    }, Server.prototype), serverEvents);

    socket.setEncoding('utf8');
    // console.log('server connected', socket.authorized ? 'authorized' : 'unauthorized');
    // console.log('Incoming:',peer.user,peer.password, JSON.stringify(peer.polls),Object.keys(peer));

    for(var ev in peer.events) {
      socket.on(ev, peer.events[ev]);
    }
  }
}

Server.prototype.finish = function(opts) {
  this.flush();
  this.socket = this.server = undefined;
}

var serverEvents = {
  data: function(data) {
    if(this.pending) {
      var msg = verifyPeer.call(this, data);
      this.socket.write(JSON.stringify({code: msg.code}));

      switch(msg.code) {
        case 200:
          this.peers.connect(this);
          break;
        default:
          this.socket.end();
          break;
      }
    }
  }, 
  error: function(err) {
    this.finish();
  },
  close: function(data) {
  },
  end: function(data) {
    this.finish();
  }
}

Server.prototype.listen = function() {
  this.server = tls.createServer(this.options, this.connect.call(this));

  this.server.listen(this.port, this.host, function() {
    console.log('server bound');
  })
}

Server.prototype.setup = function(opts) {
  this.listen();
}

function createServer(peers, settings) {
  var server = new Server(settings, peers);
  server.listen();
  return server;
}

function Client(opts, peers) {
  this.port = opts.port,
  this.host = opts.host;
  this.peers = peers;

  this.options = extend(opts, {
    cert: undefined,
    key: undefined,
  })
}

Client.prototype.connect = function() {
  var self = this;

  this.socket = tls.connect(this.port, this.host, this.options, function() {
    // console.log('connect:' + JSON.stringify({user: self.user, password: self.password}));
    self.socket.write(JSON.stringify({user: self.user, password: self.password}));
    // self.print();
  })

  this.socket.setEncoding('utf8');

  for(var ev in this.events) {
    this.socket.on(ev, this.events[ev]);
  }
}

Client.prototype.finish = function(opts) {
  this.flush();
  this.socket = undefined;
}

var clientEvents = {
  data: function(data) {
    if(this.pending) {
      var msg = parseMessage(data);;

      switch(msg.code) {
        case 200:
          this.peers.connect(this);
          break;
        default:
          this.socket.end();
          break;
      }
    }
  }, 
  error: function(err) {
    this.finish();
  },
  end: function(data) {
    this.finish();
  },
  close: function(data) {
    console.log('CLOSE:'+typeof data);
    // this.finish();
  }
}

Client.prototype.setup = function(opts) {
  this.port = opts.port,
  this.host = opts.host;

  this.options = extend(opts, {
    cert: undefined,
    key: undefined,
  })

  this.connect();
}

function createClient(peers, settings) {
  if(settings.debug) {
    console.log('Client: ' + settings);
  }

  var peer = peers.createPeer(settings, Client.prototype, clientEvents);
  peer.setup(settings);
  return peer;
}

function Peer(opts, prototype, events) {
  this.user = opts.user;
  this.password = opts.password;
  this.polls = opts.polls;
  this.debug = opts.debug;
  this.pending = true;
  this.opts = opts;
  this.events = {};

  extend(this, prototype);

  for(var e in events) {
    this.events[e] = events[e].bind(this);
  }
}

Peer.prototype.flush = function() {
  var self = this;
  console.log('Peer flush: ' + this.user);

  if(this.pending) {
    var pending = [];

    this.peers.pending.forEach(function(p) {
      if(p !== self) {
        pending.push(p);
      } else {
        console.log('Pending peer delete: ' + self.user);

        for(var e in p.events) {
          delete p.events[e];
        }
      }
    })

    this.peers.pending = pending;
  } else {
    var active = this.peers.active[this.user];

    if(active && active === this) {
      console.log('Active peer delete: ' + this.user);
      var peer = this.peers.active[this.user];
      delete this.peers.active[this.user];

      for(var e in peer.events) {
        delete peer.events[e];
      }
    } else {
      console.log('No active peer named: ' + this.user);
    }
  }
}

Peer.prototype.print = function() {
  console.log('Peer: ' + this.user + ', pending: ' + this.pending + ', polls: ' + JSON.stringify(this.polls));
}

function Peers(settings) {
  this.table = {};
  this.servers = {};
  this.active = {};
  this.pending = [];

  this.settings = settings;

  for(var s in settings.server) {
    var opts = extend({debug: settings.debug}, settings.server[s]);
    this.servers[s] = this.createServer(this, opts);
  }

  for(var p in settings.peers) {
    console.log('Allowed peer:'+JSON.stringify(settings.peers[p]));
    var opts = extend({debug: settings.debug}, settings.peers[p]);
    this.table[opts.user] = opts;
  }

  this.boot();
}

function retryPeers() {
  console.log('Retry peers');

  for(var l in this.table) {
    var table = this.table[l];

    if(!this.isActive(table)) {
      var peer = this.createClient(this, table);
    } else {
      console.log('Already active: ' + table.user);
    }
  }
}

Peers.prototype.boot = function(settings) {
  console.log('Peers boot');
  var self = this;

  if(this.settings.connect) {
    retryPeers.call(self);

    setInterval(function() {
      retryPeers.call(self);
    }, this.settings.connect*1000);
  }
}

// And, what if peer is already connected??
Peers.prototype.connect = function(node) {
  for(var i = 0; i < this.pending.length; i++) {
    var peer = this.pending[i];
    console.log('Each pending peer: '+peer.user);

    if(peer.user == node.user) {
      console.log('Found peer: ' + i + ', ' + node.user);
      node.pending = false;
      this.pending.splice(i, 1);
      this.active[node.user] = node;
      break;
    }
  }
}

Peers.prototype.stop = function() {
  console.log('Peers.stop');

  for(var peer in this.active) {
    this.active[peer].flush();
  }
}

Peers.prototype.isActive = function(peer) {
  return this.active[peer.user];
}

Peers.prototype.printActive = function() {
  console.log('Active peers');

  for(var peer in this.active) {
    this.active[peer].print();
  }
}

Peers.prototype.printPending = function() {
  console.log('Pending peers');

  this.pending.forEach(function(peer) {
    peer.print();
  })
}

Peers.prototype.print = function() {
  this.printActive();
  this.printPending();
}

Peers.prototype.createServer = createServer;
Peers.prototype.createClient = createClient;
Peers.prototype.createPeer = function(opts, prototype, events) {
  console.log('createPeer');
  var p = new Peer(opts, prototype, events);
  p.peers = this;

  this.pending.push(p);
  p.peers.print();
  return p;
}

if(module.parent) {
  module.exports = Peers;
} else {
  var peers = new Peers(require('../config/peers.json'));
}
