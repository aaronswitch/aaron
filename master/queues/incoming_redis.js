/*
incoming -- incoming factory
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
var nodemailer = require('nodemailer');
var addrParser = require('email-addresses');
var localDelivery = require('../delivery/local');
var submission = require('../../lib/submission.js');
var snuownd = require('../../public/javascripts/snuownd.js');

var smtpTransport,
    transporter;

if(Conf.smtp_transport) {
  smtpTransport = require(Conf.smtp_transport);
  transporter = nodemailer.createTransport(smtpTransport(Conf.smtp_transport_opts));
} else {
  transporter = nodemailer.createTransport(Conf.smtp_transport_opts);
}

function incomingQ(opts) {
  this.opts = opts || {};
  this.q = [];
  this.status = 0;
  var self = this;

  process.on('SIGINT', this.dump.bind(this));
  process.on('SIGTERM', this.dump.bind(this));

  this.load(function(err, saved) {
    this.q = this.q.concat(saved);

    setInterval(function() {
      console.log('incoming:'+JSON.stringify(self.q));
      self.scan();
    }, 10*1000);
    console.log('WAKE:'+opts.wake);
  })
}

incomingQ.prototype.load = function(callback) {
  var self = this;
  console.log('incoming q load');

  Redis.cache.lrange('incoming', 0, -1, function(err, values) {
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
    console.log('loadQueue incoming:'+JSON.stringify(input));

    Redis.cache.del('incoming', function(derr, dvalue) {
      if(callback) {
        callback.call(self, derr, input);
      }
    })
  })
}

incomingQ.prototype.dump = function(callback) {
  console.log('incoming q dump');
  var self = this;

  if(this.q.length) {
    Redis.cache.rpush(['incoming'].concat(JSON.stringify(this.q)), function(err, result) {
      if(callback) {
        callback.call(self, err, result);
      }
    })
  }
}

function getLocalUsers(envelope) {
  var locals = [];
  console.log('getLocalUsers:'+JSON.stringify(envelope));

  ['To', 'Cc', 'Bcc'].forEach(function(field) {
    if(!envelope[field]) {
      return true;
    }

    envelope[field].forEach(function(addr) {
      console.log('addr:'+addr);
      var idx = Conf.myorigin.indexOf(addr.origin);
      console.log('get local user:'+idx+','+addr.name+'@'+addr.origin);

      if(idx >= 0 && locals.indexOf(addr.name) < 0) {
        locals.push(addr.name);
      }
    })
  })

  console.log('LOCALS:'+JSON.stringify(locals));
  return locals;
}

function getExternUsers(envelope) {
  var other = [];
  console.log('getExternUsers:'+JSON.stringify(envelope));

  ['To', 'Cc', 'Bcc'].forEach(function(field) {
    if(!envelope[field]) {
      return true;
    }

    envelope[field].forEach(function(to) {
      console.log('to:'+to);

      if(Conf.myorigin.indexOf(to.origin) < 0) {
        other.push(to.name);
      }
    })
  })

  console.log('EXTERN:'+JSON.stringify(other));
  return other;
}

function deliverToStatement(jmsg, params, callback) {
  var dst = './public/s/' + params.key + '.html';

  localDelivery(params.jbox, jmsg, function(err) {
    console.log('Deliver to ' + params.jbox);

    if(!err) {
      Master.qmgr.enqueue('generator', {
        type: 'messages',
        key: params.key,
        src: params.jbox,
        dst: dst,
      })
    }
    callback(err);
  }) 
}

function jmsg2jbox(envelope, jmsg, callback) {
  console.log('jmsg2jbox');
  var addrs = submission.trivialRewrite(jmsg);
  var cc = addrs.Cc || [];
  var locals = getLocalUsers(envelope);

  if(!locals.length) {
    callback();
    return;
  }

  console.log('jmsg2jbox locals:'+JSON.stringify(locals));

  Knex('users').select('*').whereIn('key', locals).then(function(users) {
    console.log('Get users:'+JSON.stringify(users));
    var len = users.length;

    if(len <= 0) {
      callback();
      return;
    }

    function jboxDelivery(user) {
      var jbox = Conf.queues.incoming.spool + user.key;
      var dst = './public/' + user.category + '/' + user.name + '/index.html';

      localDelivery(jbox, jmsg, function(err) {
        console.log('Deliver to ' + jbox);

        if(!err) {
          Master.qmgr.enqueue('generator', {
            type: 'messages',
            key: user.key,
            src: jbox,
            dst: dst,
          })
        }

        if(!--len) {
          var key;
          var refs = jmsg.References || [];

          if(refs.length) {
            key = refs[0];
          } else {
            key = jmsg.Key;
          }

          var id = submission.verifyAddress(key);

          deliverToStatement(jmsg, {
            user: user,
            key: id.name,
            jbox: Conf.queues.incoming.spool + key,
          }, callback);
        }
      })
    }

    for(var i = len - 1; i >= 0; i--) {
      jboxDelivery(users[i]);
    }
  })
}

function jmsg2mail(envelope, jmsg) {
  console.log('JMSG2MAIL:'+JSON.stringify(jmsg)+','+JSON.stringify(envelope));
  var mail = {envelope: {}};

  for(var field in envelope) {
    mail.envelope[field.toLowerCase()] = envelope[field];
  }

  for(var field in jmsg) {
    switch(field) {
      case 'From': mail.from = jmsg[field]; break;
      // case 'Message-ID': mail.replyTo = mail.messageId = jmsg[field]; break;
      // case 'Key': mail.replyTo = mail.messageId = '<' + jmsg[field] + '@' + jmsg.Origin + '>'; break;
      // case 'Key': mail.messageId = '<' + jmsg[field] + '@' + jmsg.Origin + '>'; break;
      case 'Key': mail.messageId = jmsg[field]; break;
      case 'Origin': break;
      case 'Content':
        mail.text = jmsg[field];
        mail.html = snuownd.getParser().render(jmsg[field]);
        mail.attachments = [{
          content: JSON.stringify(jmsg),
          contentType: 'application/json'
        }];
        break;
      default:
        mail[field.toLowerCase()] = jmsg[field];
    }
  }

  return mail;
}

function sendmail(envelope, jmsg, callback) {
  console.log('SENDMAIL envelope:'+JSON.stringify(envelope));
  if(!Object.keys(envelope).length || !envelope.To) {
    callback();
    return;
  }

  var env = extend({}, envelope);

  ['To', 'Cc', 'Bcc'].forEach(function(field) {
    if(env[field]) {
      env[field] = submission.printAddressList(env[field]);
    }
  })
  var mail = jmsg2mail(env, jmsg);
  console.log('SENDMAIL:'+JSON.stringify(mail));

  transporter.sendMail(mail, function(err, info){
    callback(err, info);
  })
}

function resolveAndSend(envelopes, msg, callback) {
  console.log('resolve And Send:'+JSON.stringify(msg)+','+JSON.stringify(envelopes));

  sendmail(envelopes.other, msg, function(err, info) {
    if(err) {
      callback(err);
      return;
    }

    if(msg['Delivered-To']) {
      callback();
      return;
    }

    jmsg2jbox(envelopes.local, msg, function(jerr) {
      console.log('after jmsg2jbox must send mail:' + jerr);

      if(err){
        console.log(err);
      } else {
        console.log('Message sent');
      }

      callback(jerr);
    })
  })
}

function createEnvelopes(msg) {
  var locals = {}, other = {};
  console.log('create envelope:'+JSON.stringify(msg));

  ['To', 'Cc', 'Bcc'].forEach(function(field) {
    var cleaned = submission.parseAddress(msg[field], true);
    console.log('cleaned:'+JSON.stringify(cleaned));

    if(!cleaned || !cleaned.length) {
      return undefined;
    }

    cleaned.forEach(function(addr) {
      console.log('envelope addr:' + JSON.stringify(addr));
      var idx = Conf.myorigin.indexOf(addr.origin);

      if(idx >= 0) {
        console.log('found local user:'+idx+','+addr.name+'@'+addr.origin);
        locals[field] = locals[field] || [];
        locals[field].push(addr);
      } else {
        console.log('found other user:'+idx+','+addr.name+'@'+addr.origin);
        other[field] = other[field] || [];
        other[field].push(addr);
      }
    })
  })

  return {local: locals, other: other};
}

incomingQ.prototype.scan = function() {
  var self = this;
  console.log('Incoming queueu scan:'+Object.keys(this));
  console.log('Incoming queueu:'+JSON.stringify(this.q));

  for(var i = 0; i < this.q.length; i++) {
    var msg = this.q[i];

    if(!msg.From && !msg.To) {
      self.dequeue(msg); // Log?
      continue;
    }

    var envelopes = createEnvelopes(msg);
    console.log('envelopes:'+JSON.stringify(envelopes));

    resolveAndSend(envelopes, msg, function(errs) {
      console.log('Send mail errore: ' + errs);
      self.dequeue(msg);
    })

    /*if(Master.qmgr.enqueue(msg.Type, msg)) {
      console.log('enqueued to: ' +msg.Type + ', msg:' + JSON.stringify(msg));
      this.dequeue(msg);
    } else {
      console.log('Cant enqueue to:'+msg.Type);
    }*/
  }
}

// Message ops
incomingQ.prototype.is = function(item) {
  return true;
}

incomingQ.prototype.eq = function(item1, item2) {
  return true;
}

incomingQ.prototype.enqueue = function(item, generator) {
  var self = this;
  console.log('Enqueue incoming:'+JSON.stringify(item));
  console.log('IncomingQ:'+JSON.stringify(this.q));

  if(!Array.isArray(item)) {
    item = [item];
  }

  item.forEach(function(i) {
    if(i.q) {
      console.log('Enqueue to: '+i.q);
      Master.qmgr.enqueue(i.q, i.msg);
      return true;
    }

    self.q.push(i);
  })
  // filterUniqMsgs(this);
}

incomingQ.prototype.dequeue = function(item) {
  console.log('incomingQ dequeue:'+JSON.stringify(item));

  for(var i = 0; i < this.q.length; i++) {
    if(item == this.q[i]) {
      console.log('DEQUEUE OK');
      this.q.splice(i, 1);
      return true;
    }
  }
}

module.exports = incomingQ;

