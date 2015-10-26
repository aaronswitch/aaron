var extend = require('util')._extend;
var conf = require('../config/main.json');
var crypto = require('crypto');
var addrParser = require('email-addresses');

Submission.myorigin = conf.myorigin;

function rndHex (len) {
  return crypto.randomBytes(Math.ceil(len/2))
    .toString('hex')
    .slice(0, len);
}

function Submission(msg, opts) {
  this.opts = opts;
  console.log('Submission new:'+JSON.stringify(msg));

  this.message = trivialRewrite(msg);
  console.log('Submission made:'+JSON.stringify(this.message));

  if(this.message.From && this.message.To) {
    this.id = this.rand();

    // Yeah, right
    this.origin = msg.Origin || Submission.myorigin[0];
    this.message.Key = '<' + this.id + '@' + this.origin + '>';
    this.ok = true;

    if('string' === typeof this.message.References) {
      this.message.References = this.message.References.split(/[\s\t]+/);
    }

    this.message.References = this.message.References || [];
  }
}

/*
 * Normalize string: rePly-to -> Reply-To
 */
Submission.normalize = function(input) {
  var firstCh = input[0];

  if(firstCh.match(/[a-zA-Z]/)) {
    return firstCh.toUpperCase() + input.slice(1).toLowerCase().replace(/-(.)/g, function(match, group1) {
      return '-' + group1.toUpperCase();
    })
  } else {
    return input.toLowerCase().replace(/-(.)/g, function(match, group1) {
      return '-' + group1.toUpperCase();
    })
  }
}

function isAddressUnique(arr, index) {
  var item = arr[index];
  console.log('isAddressUnique:'+index+','+JSON.stringify(item));

  for(var i = 0; i < index; i++) {
    console.log('isAddressUnique:'+JSON.stringify(arr[i]));
    if(arr[i].name == item.name && arr[i].display_name == item.display_name && arr[i].origin == item.origin) {
      return false;
    }
  }
  return true;
}

Submission.parseAddress = function(str, multi) {
  console.log('parseAddress:'+str);
  var addrs;

  if(Array.isArray(str)) {
    console.log('wh0');
    addrs = addrParser.parseAddressList(str.join(','));
  } else {
    addrs = addrParser.parseAddressList(str);
    console.log('w10:'+addrs);
  }

  if(addrs && addrs.length) {
    var list = addrs.map(function(item) {
      return {name: item.local, display_name: item.name, origin: item.domain};
    })

    var uniq = list.filter(function(item, index) {
      return isAddressUnique(list, index);
    })

    if(!multi) {
      return (uniq.length ? uniq[0] : undefined);
    }

    return uniq;
  }
}

Submission.printAddress = function(user, purge) {
  if(purge) {
    if(user.display_name) {
      return '"' + user.display_name + '" <>';
    }
    return '<>';
  } else {
    if(user.display_name) {
      return '"' + user.display_name + '" <' + user.name + '@' + user.origin + '>';
    }
    return '<' + user.name + '@' + user.origin + '>';
  }
}

Submission.getAddressArray = function(users, purge) {
  if(!users) {
    return;
  }
  if(!Array.isArray(users)) {
    users = [users];
  }
  return users.map(function(user) {
    return Submission.printAddress(user, purge);
  })
}

Submission.printAddressList = function(users, purge) {
  /*if(!users) {
    return;
  }
  if(!Array.isArray(users)) {
    users = [users];
  }
  return users.map(function(user) {
    return Submission.printAddress(user, purge);
  }).join(',');*/
  var addrs = Submission.getAddressArray(users, purge);
  return addrs ? addrs.join(',') : undefined;
}

Submission.verifyAddress = function(user, multi) {
  if('string' === typeof user) {
    return Submission.parseAddress(user, multi);
  } else if(Array.isArray(user)) {
    for(var i = 0; i < user.length; i++) {
      if(!user[i].name || !user[i].display_name || !user[i].origin) {
        return undefined;
      }
    }

    return user.filter(function(item, index) {
      return isAddressUnique(user, index);
    })
  } else if('object' === typeof user) {
    if(!user.name || !user.display_name || !user.origin) {
      return undefined;
    }
    return user;
  }
}

/*
 * Parse From,To,Cc,Bcc and normalize headers.
 * Rewrite header fields ie. normalize keys to - word's first char is uppercase
 * tO -> To, cc -> Cc, REply-to ->Reply-To, Message-ID -> Message-Id, in-rEply-TO -> In-Reply-To ...
 */
var trivialRewrite = Submission.trivialRewrite = function(msg) {
  console.log('trivial rewrite:'+JSON.stringify(msg));
  var fixed = {};

  for(var field in msg) {
    var key = Submission.normalize(field);

    switch(key) {
      case 'From':
        fixed[key] = Submission.verifyAddress(msg[field]);
        break;
      case 'To':
      case 'Cc':
      case 'Bcc':
        fixed[key] = Submission.verifyAddress(msg[field], true);
        break;
      case 'References':
        if('string' === typeof fixed[key]) {
          fixed[key] = msg[field].trim().split(/[\s\t]+/);
        } else {
          fixed[key] = msg[field];
        }
        break;
      default: fixed[key] = msg[field];
    }
  } 

  return fixed;
}

Submission.prototype.rand = function() {
  return rndHex(32);
}

Submission.prototype.set = function(headers) {
  console.log('Submission set:'+JSON.stringify(headers));
  var normalized = {};

  for(var i in headers) {
    normalized[Submission.normalize(i)] = headers[i];
  }

  extend(this.message, normalized);
}

Submission.prototype.setKey = function(key) {
  key = key || this.id;
  this.message.Key = key;
}

Submission.prototype.getMessage = function(purge) {
  var message = extend({}, this.message);

  message.From = Submission.printAddress(message.From, purge);
  message.To = Submission.printAddressList(message.To, purge);
  message.Cc = Submission.printAddressList(message.Cc, purge);
  message.Bcc = Submission.printAddressList(message.Bcc, purge);
  //message.To = Submission.getAddressArray(message.To, purge);
  //message.Cc = Submission.getAddressArray(message.Cc, purge);
  //message.Bcc = Submission.getAddressArray(message.Bcc, purge);

  return message;
}

Submission.prototype.get = function(header) {
  return this.message[Submission.normalize(header)];
}

Submission.prototype.getSer = function(header) {
  var hdr = Submission.normalize(header);

  if(this.message[hdr]) {
    return JSON.stringify(this.message[hdr]);
  }
}

Submission.prototype.print = function() {
  var tmp = extend({}, this);
  tmp = extend(tmp, {meta: {}});

  console.log('submission:'+JSON.stringify(tmp));
}

module.exports = Submission;

/*var submission = new Submission({
  From: '1',
  To: '2',
  //'Content-Type': 'application/vnd.aaron+json',
  Content: 'Lalala',
  References: '1234    5555 678 	tttt',
}, {})

submission.print();*/

