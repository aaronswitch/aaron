/*
setup -- setup database with predefined data
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
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var extend = require('util')._extend;
var addrParser = require('email-addresses');
var snuownd = require('../../public/javascripts/snuownd.js');
var Generate = require('../../config/generate.js');
var restConf = require('../../config/rest.json');

function findMessage(messages, msgid) {
  messages = messages || [];

  for(var i = 0; i < messages.length; i++) {
    console.log(messages[i].Key, 'lol', msgid);
    //if(messages[i]['Message-ID'] == msgid) {
    if(messages[i].Key == msgid) {
      console.log('match:'+msgid);
      return messages[i];
    }
  }
}

function parentCommentInc(msg, parent) {
  msg.__parent__ = parent;

  for(var p = msg.__parent__; p; p = p.__parent__) {
    p.children = p.children || 0;
    p.children++;
  }
}

function arrangeMessages(messages, key, callback) {
  var arranged = [],
      userKeys = [],
      ts = Math.round(new Date().getTime()/1000);

  console.log('Not arranged:'+JSON.stringify(messages));
  messages.reverse();

  messages.forEach(function(msg, callback) {
    msg.replies = msg.replies || [];
    msg.children = msg.children || 0;
    msg.Date = msg.Date ? new Date(msg.Date).toLocaleString() : false;
    var from = addrParser.parseOneAddress(msg.From);

    var ident = msg.Key.split('@') [0];

    if(ident[0] == '<') {
      ident = ident.slice(1);
    }
    if(ident[ident.length - 1] == '>') {
      ident = ident.slice(0, ident.length - 1);
    }

    msg.ident = ident;

    if(from) {
      msg.From = from.name;
      //msg.userKey = from.address;
      msg.userKey = from.local;
      //userKeys.push(from.address);
      userKeys.push(from.local);
    } else {
      msg.From = '<>';
    }

    if(msg.Content) {
      msg.Content = snuownd.getParser().render(msg.Content);
    } else {
      msg.Content = false;
    }

    var msgId = msg.Key;

    if(!msg.References || !msg.References.length) {
      arranged.push(msg);
      return true;
    }

    var reference = msg.References[msg.References.length - 1];

    if(!reference) {
      arranged.replies.push(msg);
      return true;
    }

    var parent = findMessage(messages, reference);

    if(!parent) {
      arranged.push(msg);
      return true;
    }

    msg.Parent = parent.Key;
    parent.replies = parent.replies || [];
    parent.replies.push(msg);
    // parentCommentInc(msg, parent);
  })

  arranged.forEach(function(item) {
    var ref = item.Key.split('@') [0];

    if(ref[0] == '<') {
      ref = ref.slice(1);
    }
    if(ref[ref.length - 1] == '>') {
      ref = ref.slice(0, ref.length - 1);
    }

    item.Ref = ref;
  })

  console.log('Arranged:'+JSON.stringify(messages));
  console.log('Find user:'+key);
  console.log('Find users:'+userKeys);
  //Knex('users').whereIn('key', userKeys).select().then(function(users) {
  var q = Knex('users').select().where(function() {
    if(userKeys.length) {
      this.where({key: key}).whereIn('key', userKeys);
    } else {
      this.where({key: key});
    }
  }).toString();
  console.log('QUERY:'+q);

  Knex('users').select().where(function() {
    if(userKeys.length) {
      this.where({key: key}).orWhereIn('key', userKeys);
    } else {
      this.where({key: key});
    }
  }).then(function(users) {
    console.log('Ok users:'+JSON.stringify(users));
    var user;

    messages.forEach(function(msg) {
      users.forEach(function(item) {
        console.log('msg vs user:'+msg.userKey + ' vs ' + item.key);
        if(item.key == key) {
          console.log('USER KEY:'+key +','+JSON.stringify(item));
          user = item;
        }
        item.url = restConf.static.url + '/' + item.category + '/' + item.name;

        if(msg.userKey == item.key) {
          msg.User = item;
          return true;
        }
      })
      msg.User = msg.User || false;
    })
    //console.log('Knex arranged:'+JSON.stringify(arranged));
    //console.log('Knex user:'+JSON.stringify(user));
    callback(null, extend({ts: ts, User: user, messages: arranged}, Generate.mbox.message))
  }).catch(function(err) {
    console.log('Knex err:'+err);
    callback(err);
  })
}

module.exports = function(msg, opts, callback) {
  console.log('MAsTeR:'+Object.keys(Master));
  var jbox = new Master.mbox({file: msg.src});

  jbox.read(function(err, data) {
    arrangeMessages(data, msg.key, function(aerr, msgs) {
      var messages = View(msgs);
      //console.log('messages:'+messages);

      fs.writeFile(msg.dst, messages, function(ex) {
        if(ex) {
          console.log('Unable to write to: ' + dst.msg);
        }

        if(callback) {
          callback(ex);
        }
      })
    })
  })
}
