/*
passwd -- passwd factory
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
var subConf = require('../../config/submission.json');
var snuownd = require('../../public/javascripts/snuownd.js');

var passwdView = App.find('views/mustache').require({name: 'passwd'});

var auth = require('../../config/auth.json');
var crypts = require('../../app/controllers/crypt.js');
GLOBAL.CryptsController = new crypts();

function passwordGenerator(pass, callback) {
  crypto.randomBytes(auth.salt, function(ex, buf) {
    if(ex) {
      callback(ex);
      return;
    } 

    var salt = buf.toString(auth.encoding);

    console.log('pass:'+pass);
    console.log('salt:'+salt);
    CryptsController[auth.algo] (pass, salt, function(cerr, password) {
      callback(cerr, password);
    })
  })
}

var smtpTransport,
    transporter;

if(Conf.smtp_transport) {
  smtpTransport = require(Conf.smtp_transport);
  transporter = nodemailer.createTransport(smtpTransport(Conf.smtp_transport_opts));
} else {
  transporter = nodemailer.createTransport(Conf.smtp_transport_opts);
}

function passwdQ(opts) {
  this.opts = opts || {};
  this.q = [];
  this.status = 0;
  var self = this;

  process.on('SIGINT', this.dump.bind(this));
  process.on('SIGTERM', this.dump.bind(this));

  this.load(function(err, saved) {
    this.q = this.q.concat(saved);

    setInterval(function() {
      console.log('passwd:'+JSON.stringify(self.q));
      self.scan();
    }, 10*1000);
    console.log('WAKE:'+opts.wake);
  })
}

passwdQ.prototype.load = function(callback) {
  var self = this;
  console.log('passwd q load');

  Redis.cache.lrange('passwd', 0, -1, function(err, values) {
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
    console.log('loadQueue passwd:'+JSON.stringify(input));

    Redis.cache.del('passwd', function(derr, dvalue) {
      if(callback) {
        callback.call(self, derr, input);
      }
    })
  })
}

passwdQ.prototype.dump = function(callback) {
  console.log('passwd q dump');
  var self = this;

  if(this.q.length) {
    Redis.cache.rpush(['passwd'].concat(JSON.stringify(this.q)), function(err, result) {
      if(callback) {
        callback.call(self, err, result);
      }
    })
  }
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

function resetPassword(msg) {
  console.log('resetPassword::'+JSON.stringify(msg));

  if(msg.key && msg.password) {
    Knex('users').where({key: msg.key}).update({password: msg.password}).then(function(result) {
      console.log('resetPassword:'+JSON.stringify(result));
    }).catch(function(err) {
      console.log('resetPassword err:'+JSON.stringify(err));
    })
  }
}

passwdQ.prototype.scan = function() {
  var self = this;
  console.log('Incoming queueu scan:'+Object.keys(this));
  console.log('Incoming queueu:'+JSON.stringify(this.q));

  for(var i = 0; i < this.q.length; i++) {
    var item = this.q[i];

    if(item.finish == true) {
      passwordGenerator(item.password, function(perr, password) {
        var msg = extend({}, item);
        msg.password = password;
        self.dequeue(item);
        resetPassword(msg);
      })
      return true;
    }

    (function(msg) {
      crypto.randomBytes(64, function(ex, buf) {
        if(ex) {
          self.dequeue(msg);
          return;
        }

        var str = buf.toString('base64').toLowerCase().replace(/[=\/\+\\]/g, '_');
        var score = Math.round(new Date().getTime()/1000);
        var file = str.substr(0,32);
        var token = str.substr(32);
        console.log('RES ET PASSWORD:'+JSON.stringify(msg));
        var zadd = ['resetpassword', score, msg.category + ':' + msg.name + ':' + file + ':' + token];

        Redis.cache.zadd(zadd, function(rerr, result) {
          if(rerr) {
            self.dequeue(msg);
            return;
          }

          var dict = extend({}, Conf.rest);
          dict.data = {category: msg.category, name: msg.name, key: msg.key, file: file, token: token};
          var str = passwdView(dict);

          fs.writeFile('./public/' + msg.category + '/' + msg.name + '/passwd/' + file + '.html', str, function(werr) {
            console.log('FILE WRITE:' + './public/' + msg.category + '/' + msg.name + '/passwd/' + file + '.html');
            console.log('WROTE:'+str);
            console.log('ERROR:'+werr);
            self.dequeue(msg);

            var mail = {
              from: subConf.guest,
              to: msg.email,
              text: passwdView.message(dict), 
              subject: 'reset',
            }

            transporter.sendMail(mail, function(err, info){
              console.log('sendmail:'+err);
            })
          })
        })
      })
    } (item));
  }
}

// Message ops
passwdQ.prototype.is = function(item) {
  return true;
}

passwdQ.prototype.eq = function(item1, item2) {
  return true;
}

passwdQ.prototype.enqueue = function(item, generator) {
  var self = this;
  console.log('Enqueue passwd:'+JSON.stringify(item));
  console.log('IncomingQ:'+JSON.stringify(this.q));

  if(!Array.isArray(item)) {
    item = [item];
  }

  item.forEach(function(msg) {
    self.q.push(msg);
  })
}

passwdQ.prototype.dequeue = function(item) {
  console.log('passwdQ dequeue:'+JSON.stringify(item));

  for(var i = 0; i < this.q.length; i++) {
    if(item == this.q[i]) {
      console.log('DEQUEUE OK');
      this.q.splice(i, 1);
      return true;
    }
  }
}

module.exports = passwdQ;
