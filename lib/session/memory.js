/*
memory.js -- naive session storage
Copyright (C) 2012 Ivan Popovski
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

var Manager = require('seance').Manager;
var manager = false;
var options = {};

module.exports.create = function(callback) {
  manager.create(function(err, sess) {
    callback(err, sess);
  })
}

module.exports.save = function(sid, value, callback) {
  if('object' === typeof sid) {
    if('function' === typeof value) {
      callback = value;
    }
    value = sid;
    sid = undefined;
  }

  manager.open(sid, function(err, sess) {
    //console.log('save:'+sess.id);
    sess.set(value);
    sess.save(callback);
  })
}

module.exports.rm = function(sid, callback) {
  manager.open(sid, function(err, sess) {
    var data = sess._getData();

    manager.remove(sess, function(err, sess) {
      callback(err, data);
    })
  })
}

module.exports.get = function(sid, callback) {
  manager.open(sid, function(err, sess) {
    callback(err, sess._getData());
  })
}

var clean_expired_sessions = function() {
  // console.log("Clean expired sessions!");
  manager.clean();
}

module.exports.unset = function(sid, key, callback) {
  manager.open(sid, function(err, sess) {
    // console.log('session unset:'+err+','+key);
    if(err) {
      callback(err);
      return;
    }
    sess.unset(key).save(function(err) {
      callback(err);
    })
  })
}

/*
 */
module.exports.init = function(opts) {
  options = opts;
  manager = new Manager(options);

  /*
   * expiration === 0 you are on your own, ie. clean sessions by hand.
   * You have been warned!
   * On the other hand this is useful for persistent sessions.
   */
  if(opts.expiration) {
    setInterval(clean_expired_sessions, opts.expiration*1000);
  }

  return {
    create: this.create,
    save: this.save,
    rm: this.rm,
    get: this.get,
    unset: this.usnet
  }
}
