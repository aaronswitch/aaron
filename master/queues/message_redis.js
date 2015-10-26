/*
queue -- queue factory
Copyright (C) 2015 Ivan Popovski

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var extend = require('util')._extend;
var localDelivery = require('../delivery/local');

function messageQ(opts) {
  console.log('messageQ OPTS:'+JSON.stringify(opts));
  var self = this;
  this.q = [];
  this.status = 0;
  this.spool = opts.spool; 

  process.on('SIGINT', this.dump.bind(this));
  process.on('SIGTERM', this.dump.bind(this));

  this.load(function(err, saved) {
    var self = this;

    if(err) {
      return;
    }

    this.q = self.q.concat(saved);
    this.status = 1;
    this.scan();

    setInterval(function() {
      console.log('messageQ wake');
      self.scan();
    }, opts.wake*1000);
  })
}

messageQ.prototype.load = function(callback) {
  var self = this;
  console.log('Load message queue');

  Redis.cache.lrange('message', 0, -1, function(err, values) {
    if(err) {
      if(callback) {
        callback.call(self, err);
      }
      return;
    }

    values = values || [];
    var input = [];

    values.forEach(function(item) {
      var itmp = JSON.parse(item);

      // If needed, flat.
      if(!Array.isArray(itmp)) {
        itmp = [itmp];
      }

      itmp.forEach(function(i) {
        input.push(i);
      })
    })
    console.log('loadQueue message:'+JSON.stringify(input));

    Redis.cache.del('redis', function(derr, dvalue) {
      if(callback) {
        callback.call(self, derr, input);
      }
    })
  })
}

messageQ.prototype.dump = function(callback) {
  console.log('Dump message queue');

  if(this.q.length) {
    Redis.cache.rpush(['message'].concat(JSON.stringify(this.q)), function(err, result) {
      if(callback) {
        callback.call(this, err, result);
      }
    })
  }
}

messageQ.prototype.scan = function() {
  var self = this;
  console.log('Statement queue scan:'+JSON.stringify(this.q));

  this.q.forEach(function(item) {
    var mbox = self.spool + item.body.id;

    localDelivery(mbox, item, function(err) {
      console.log('Deliver to ' + self.spool + ', err ' + err + ', msg ' + JSON.stringify(err));

      if(!err) {
        self.dequeue(item);

        Master.qmgr.enqueue('generator', {
          type: 'message',
          src: mbox,
          dst: mbox + '.html' 
        });
        return;
      }
    })
  })
}

messageQ.prototype.is = function(item) {
  if(item.message) {
    return true;
  }
  return false;
}

messageQ.prototype.eq = function(item1, item2) {
  if(item1.message && (item1.message == item2.message)) {
    return true;
  }
  return false;
}

messageQ.prototype.enqueue = function(item) {
  console.log('STATEMENT ENQUEUE:'+JSON.stringify(item));
  this.q.push(item);
  return true;
}

messageQ.prototype.dequeue = function(item) {
  for(var i = 0; i < this.q.length; i++) {
    if(item == this.q[i]) {
      console.log('DEQUEUE OK');
      this.q.splice(i, 1);
      return true;
    }
  }
}

module.exports = messageQ;
