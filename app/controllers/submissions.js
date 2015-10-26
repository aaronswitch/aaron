var extend = require('util')._extend,
    net = require('net'),
    Settings = require('../../config/submission.json'),
    Submission = require('../../lib/submission.js');

module.exports = function() {
  var self = this;
  this.exportAs = 'SubmissionClient';
  this.guest = Settings.guest;
  this.q = [];

  this.dump = function(callback) {
    console.log('Submission queue dump:'+JSON.stringify(this.q));

    if(!this.q.length) {
      callback();
      return;
    }

    Redis.cache.rpush(['queues_dump'].concat(JSON.stringify(self.q)), function(err, result) {
      if(!err) {
        self.q = [];
      }
      callback(err);
    })
  }

  this.connect = function() {
    var client = new net.Socket();
    console.log('Connect to submission server');

    client.connect(Settings.port, Settings.host, function() {
      console.log('Connected to ' + Settings.host + ':' + Settings.port);
      // BUG: Need to self.send(self.q, func) here, but watch for self.q.concat from self.send()!!!
    })

    client.on('data', function(data) {
      console.log('Received: ' + data);
    })

    client.on('error', function() {
      console.log('Connection closed');
      client.destroy(); // kill client after server's response
      self.client = undefined;
    })

    client.on('close', function() {
      console.log('Connection error');
      client.destroy(); // kill client after server's response
      self.client = undefined;
    })

    this.client = client;
  }

  this.sendMsg = function(messages, callback) {
    if(!Array.isArray(messages)) {
      messages = [messages];
    }

    if(messages.length) {
      if(!this.client) {
        self.q = self.q.concat(messages);
        callback(404);
        return;
      }

      var out = JSON.stringify(messages);

      this.client.write(out, function(ex) {
        if(ex) {
          console.log('Write:' + ex);
          self.q = self.q.concat(messages);
        }

        if('function' === typeof callback) {
          callback(ex);
        }
      })
    }
  }

  this.send = function(submissions, callback) {
    if(!submissions) {
      callback();
      return;
    }

    if(!Array.isArray(submissions)) {
      submissions = [submissions];
    }

    var messages = [];

    submissions.forEach(function(sub) {
      var item = sub.getMessage();

      if(sub.ok) {
        messages.push(item);
      }
    })

    console.log('Send messages:'+JSON.stringify(messages));
    var out = JSON.stringify(messages);

    if(messages.length) {
      if(!this.client) {
        self.q = self.q.concat(messages);
        callback(404);
        return;
      }

      var out = JSON.stringify(messages);

      this.client.write(out, function(ex) {
        if(ex) {
          console.log('Write:' + ex);
          self.q = self.q.concat(messages);
        }

        if('function' === typeof callback) {
          callback(ex);
        }
      })
    }
  }

  /*
   * Automatic connect and reconnect to server.
   */
  this.connect();

  setInterval(function() {
    if(!self.client) {
      self.connect();
    }
  }, Settings.reconnect*1000)
}
