/*
passwd -- change user password
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

var Crypt = require('./app/controllers/crypt.js');
GLOBAL.CryptsController = new Crypt();

var Register = require('./app/controllers/register.js');
var register = new Register();

var argv = process.argv.slice(2),
    user = argv[0],
    passwd = argv[1];

if(!user || !passwd) {
  console.log('Usage: node passwd <user> <passwd>');
  process.exit(1);
}

var Framework = require("./lib/framework.js");
var framework = new Framework();

var appConf = {
  version: "0.1",
  pidfile: false,
  components: {
    'models/sequelize': {on: true}
  }
}

framework.start({
  app: 'passwd',
  conf: appConf,
  version: '0.1',
  init: true
}, function(app) {
  Identity.find({where: {name: user}}).success(function(identity) {
    if(!identity) {
      console.log('Unable to find user: ' + user);
      process.exit(2);
    }

    console.log('Found user: ' + user);

    register.passwd(passwd, function(err, password) {
      identity.updateAttributes({passwd: password}).success(function() {
        console.log(password);
      }).error(function(err) {
        console.log('Error: ' + err);
      })
    })
  })
})
