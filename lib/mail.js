/*
 * GPLv3
 */

/*
 * Use in .forward:
 * "|exec /path/to/node /path/to/forward.js"
 */
var fs = require('fs');
var extend=require('util')._extend;
var Submission = require('./submission.js');
var root = process.argv[2];

console.log(JSON.stringify(process.argv));

// Ignoring date from first line. Is that ok?
function firstLine(line) {
  if(0 === line.indexOf('From ')) {
    var from = line.substring(5).split(/[\s\t]+/, 1);
    return {From: from[0]};
  }

  return {};
}

function Mail(data) {
  this.data = data;
  this.parse();

  this.submission = new Submission(this.mail);

  this.toJSON = function() {
    return this.submission.getMessage();
  }

  this.print = function() {
    console.log(JSON.stringify(this.submission.getMessage()));
  }
}

function addHeader(mail, key, value) {
  if(!mail[key]) {
    mail[key] = value;
    return;
  }

  if(Array.isArray(mail[key])) {
    mail[key].push(value);
  } else {
    mail[key] = [mail[key], value];
  }
}

function catHeader(mail, key, value) {
  if(Array.isArray(mail[key])) {
    var idx = mail[key].length - 1;

    mail[key][idx] += value;
  } else {
    mail[key] += value;
  }
}

Mail.prototype.parse = function() {
  var border = this.data.indexOf('\n\n'),
      mail = this.mail = {};

  if(border < 0) {
    return {};
  }

  var header = this.data.substr(0, border).split('\n').slice(1),
      hdr;

  header.forEach(function(line) {
    var val;

    if(line[0] != ' ' && line[0] != '\t') {
      hdr = line.split(':', 1) [0];
      val = line.substring(line.indexOf(':') + 1);

      addHeader(mail, hdr, val.replace(/^[\s\t]+/, ''));
    } else {
      catHeader(mail, hdr, line);
    }
  })

  mail.Content = this.data.substring(border + 2);
  console.log('MAIL:'+JSON.stringify(mail));
}

module.exports = Mail;
