/*
emailjs.js -- mailer
Copyright (C) 2013 Ivan Popovski
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
var email = require('emailjs/email');

function mailerFactory(mailer, views) {
  var client = email.server.connect(mailer);

  console.log('M:'+Object.keys(views));

  for(var method in mailer) {
    if('function' === typeof mailer[method]) {
      var origMethod = mailer[method];

      mailer[method] = (function(action) {
        return function(data) {
          data = data || {};
          data.text = views[action] (data);
          origMethod.call (mailer, data);
        }
      }) (method);
    }
  }

  mailer.mail = function(data) {
    console.log('MAIL:'+JSON.stringify(data));
   
    var msg = {
      text: data.text,
      from: data.from || this.from,
      to: data.to || this.to,
      subject: data.subject || this.subject
    }

    client.send.call(client, msg, function(err, message) {
      console.log('MMM:' + err + ',' + JSON.stringify(message));
    })
    console.log('MAILE:'+JSON.stringify(data));
  }

  delete mailer.prototype;
  return mailer;
};

function Mailers(opts) {
  console.log('MAILERS:'+JSON.stringify(opts));
  var mailers = {};
  var mailerComponent = require(__dirname).create(opts);

  this.start = function(app) {
    var views = app.find('views/mustache');

    for(var name in mailerComponent.mailers) {
      var mailer = mailerComponent.mailers[name];
      console.log('Mailers factory:'+name+' - '+Object.keys(mailerComponent.mailers));
      mailers[name] = mailerFactory(mailer, views.require({name: name}));

      if(mailers[name].exportAs) {
        app.export(mailers[name].exportAs, mailers[name]);
      }
    }
  }
}

module.exports = Mailers;
