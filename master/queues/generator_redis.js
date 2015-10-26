/*
generator -- generator factory
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

var conf = require('../../config/generate.json');

function generatorQ(opts) {
  var self = this;

  this.opts = opts || {};
  this.q = [];
  this.status = 0;
  this.generators = {};
  this.import = opts.import || {};
  this.generators = (require('../generators/')) (opts.import);

  console.log('GENERATORS:'+Object.keys(this.generators));

  process.on('SIGINT', this.dump.bind(this));
  process.on('SIGTERM', this.dump.bind(this));

  this.load(function(err, saved) {
    this.q = this.q.concat(saved);

    setInterval(function() {
      console.log('generator:'+JSON.stringify(self.q));
      self.scan();
    }, 10*1000);
    console.log('WAKE:'+opts.wake);
  })
}

generatorQ.prototype.load = function(callback) {
  var self = this;
  console.log('generator q load');

  Redis.cache.lrange('generator', 0, -1, function(err, values) {
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
    console.log('loadQueue generator:'+JSON.stringify(input));

    Redis.cache.del('generator', function(derr, dvalue) {
      if(callback) {
        callback.call(self, derr, input);
      }
    })
  })
}

generatorQ.prototype.dump = function(callback) {
  console.log('generator q dump');
  var self = this;

  if(this.q.length) {
    Redis.cache.rpush(['generator'].concat(JSON.stringify(this.q)), function(err, result) {
      if(callback) {
        callback.call(self, err, result);
      }
    })
  }
}

generatorQ.prototype.scan = function() {
  console.log('Generator queueu scan:'+Object.keys(this));
  console.log('Generator queueu:'+JSON.stringify(this.q));

  for(var i = 0; i < this.q.length; i++) {
    var msg = this.q[i],
        generator = this.generators[msg.type];

    if(generator) {
      generator (msg);
      this.dequeue(msg);
    } else {
      console.log('Generator type unknown, msg: ' + JSON.stringify(msg));
    }
  }
}

// Message ops
generatorQ.prototype.is = function(item) {
  return true;
}

generatorQ.prototype.eq = function(item1, item2) {
  return true;
}

generatorQ.prototype.enqueue = function(item, generator) {
  var self = this;
  console.log('Enqueue generator:'+JSON.stringify(item));
  console.log('GeneratorQ:'+JSON.stringify(this.q));

  if(!Array.isArray(item)) {
    item = [item];
  }

  item.forEach(function(msg) {
    self.q.push(msg);
  })
  // filterUniqMsgs(this);
}

generatorQ.prototype.dequeue = function(item) {
  console.log('generatorQ dequeue:'+JSON.stringify(item));

  for(var i = 0; i < this.q.length; i++) {
    if(item == this.q[i]) {
      console.log('DEQUEUE OK');
      this.q.splice(i, 1);
      return true;
    }
  }
}

module.exports = generatorQ;
