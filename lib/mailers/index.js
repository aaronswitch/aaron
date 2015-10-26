var fs = require('fs');
var path = require('path');
var util = require('util');
var mailerDir = path.resolve('app', 'mailers');

var defaults = {
  address: '127.0.0.1',
  port: 25,
  domain: 'localhost'
}

function MailerComponent(opts) {
  var mailers = this.mailers = {};
  console.log('MailerComponent:'+JSON.stringify(opts));

  fs.readdirSync(mailerDir).forEach(function(file) {
    if(file[0] === '.') {
      return next;
    }

    var f = file.match("^(.+)\.js$");

    if(f && f[1]) {
      if(opts && opts.use) {
        var found;

        opts.use.forEach(function(m) {
          //console.log('MAILER vs '+m+','+f[1]);
          if(m == f[1]) {
            found = true;
            return false;
          }
        })

        if(!found) {
          return true;
        }
      }

      console.log('Mailer Found:'+f[1]);
      var mailer = require(path.resolve(mailerDir, file));
      mailer.prototype = defaults;
      mailers[f[1]] = mailer;
    }
  })
}

MailerComponent.prototype.load = function() {
  Mailers = mailersLoader();
  return Mailers;
}

MailerComponent.prototype.require = function(name) {
  console.log('MAILER REQUIRE:'+name);
  if(!Mailers[name]) {
    var mailer = require(path.resolve(mailerDir, name));
    mailer.prototype = defaults;
    Mailers[name] = new mailer();
  }

  return Mailers[name];
}

MailerComponent.prototype.finish = function(app) {
  var Views = app.find('views/mustache');
  //var views = Views.require();

  for(var m in this.mailers) {
    var mailer = this.mailers[m];

    /*if(Views[m]) {
      for(var i in mailer) {
        mailer[i] = Views[m][i];
      }
    }*/

    if(mailer.exportAs) {
      app.export(mailer.exportAs, mailer);
    }
  }
}

MailerComponent.create = function(opts) {
  return new this(opts);
}

module.exports = MailerComponent;
