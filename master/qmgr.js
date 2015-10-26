/*
qmgr -- queue manager
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

function QMgr(opts) {
  this.opts = opts || {};
  this.qs = {};

  for(var q in opts) {
    this.createQueue(q, opts[q]);
  }
}

QMgr.prototype.cleanup = function(msgs) {
  console.log('Cleanup:'+JSON.stringify(msgs));
  return msgs;
}

QMgr.prototype.enqueue = function(queue, msg) {
  if(this.qs[queue]) {
    this.qs[queue].enqueue(msg);
    return true;
  }

  return false;
}

QMgr.prototype.print = function() {
  console.log('qmgr');
  console.log('-------------------------------');

  for(var i in this.qs) {
    var q = this.qs[i];
    console.log('Queue: ' + q);
  }
}

function normalizePath(prefix, name, spool) {
  return prefix + [name, spool].join('_');
}

QMgr.prototype.createQueue = function(name, opts) {
  // console.log('createQueue:' + name + ',' + JSON.stringify(opts));
  var Queue = require(normalizePath('./queues/', name, opts.dump));
  this.qs[name] = new Queue(opts);
  return this.qs[name];
}

if(module.parent) {
  module.exports = QMgr;
} else {
  var qmgr = new QMgr();
  var activeQ = qmgr.createQueue('active', {});
  var identityQ = qmgr.createQueue('identity', {});
  qmgr.print();
  identityQ.print();
  activeQ.print();
}
