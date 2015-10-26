/*
usermod --
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
var helper = require('./master/helper.js');
var staticService = require('./config/rest.json');
var urlPrefix = staticService.static.url + staticService.prefix;
var Conf = require('./config/main.json');
var Submission = require('./lib/submission.js');

var Crypt = require('./app/controllers/crypt.js');
var Auth = require('./app/controllers/auth.js');
var Users = require('./app/controllers/users.js');
var submissionClient = require('./app/controllers/submissions.js');

GLOBAL.CryptsController = new Crypt();
GLOBAL.AuthsController = new Auth();
GLOBAL.SubmissionClient = new submissionClient();
GLOBAL.UsersController = new Users();

var argv = process.argv.slice(2),
    cmd = argv[0],
    attrs = {};

if(!cmd) {
  console.log('Usage: node user <add|mod> name <name> email <email> password <pwd> display_name \'<display_name>\' ...');
  process.exit(1);
}

for(var i = 1; i < argv.length; i = i + 2) {
  attrs[argv[i]] = argv[i + 1];
}

if(!Object.keys(attrs).length) {
  console.log('Usage: node user <add|mod> name <name> email <email> password <pwd> display_name \'<display_name>\' ...');
  process.exit(1);
}

function passwordGenerator(attrs, callback) {
  if(attrs.password) {
    UsersController.passwd(attrs.password, function(err, password) {
      callback(null, password);
    })
  } else {
    callback();
  }
}

function userAdd(attrs, callback) {
  attrs.category = attrs.category || '';

  var avatar = ['/', attrs.category, attrs.name, 'avatar.png'].join('/').replace(/\/+/g, '/');
  attrs.avatar = attrs.avatar || (urlPrefix + avatar);

  console.log('user add:'+JSON.stringify(attrs));
  console.log('password:'+attrs.password);

  passwordGenerator(attrs, function(err, password) {
    attrs.password = password;
    console.log('passwd:'+err+','+password);

    Knex('users').returning('*').insert(attrs).then(function(users) {
      var u = '"' + attrs.display_name + '" <' + attrs.email + '>';

      var submission = new Submission({
        From: u,
        To: u,
        Content: "Registration",
      })

      if(!submission.ok) {
        callback(500);
        return;
      }

      submission.set({To: attrs.key});
      submission.set({Info: {
        User: submission.get('From'),
        Avatar: attrs.avatar
      }})

      submission.print();

      console.log(typeof SubmissionClient);
      SubmissionClient.send(submission, function(code) {
        console.log('submission client ret:'+code);

        if(code) {
          //res.send(403, {});
          //return next();
        }

        users[0].category = users[0].category || [];

        helper.cpDir(Conf.skel, './public/' + users[0].category + '/' + users[0].name, function(cerr) {
          if(cerr) {
            console.log('cp skel err: ' + './public/' + u[0].name);
          }
          callback(null, users[0]);
        })
      })
    }).catch(function(err) {
      console.log('err:'+err);
      callback(err);
    })
  })
}

function userMod(attrs, callback) {
  Knex('users').select('*').where({name: attrs.name}).then(function(users) {
    if(!users[0]) {
      console.log('User not found: ' + attrs.name);
      callback(403);
      return;
    }

    if(!attrs.password) {
      identity.updateAttributes(attrs).success(function() {
        console.log('Done.');
        callback(0, identity);
      }).error(function(err) {
        console.log('Error: ' + err);
        callback(444);
      })
    } else {
      var Register = require('./app/controllers/register.js'),
          register = new Register();

      register.password(attrs.password, function(err, password) {
        attrs.password = password;

        identity.updateAttributes(attrs).success(function() {
          var Cache = require('./app/controllers/cache.js');
          var cache = new Cache();
        }).error(function(err) {
          console.log('Error: ' + err);
          callback(444);
        })
      })
    }
  })
}

var Framework = require("./lib/framework.js");
var framework = new Framework();

var appConf = {
  version: '0.1',
  pidfile: false,
  exportAs: 'Aaron',
  components: {
    'models/knex': {on: true},
    'nosql/redis': {on: true},
    'views/mustache': {on: true, opts: {dialect: 'fumanchu'}},
  }
}

framework.start({
  app: 'usermod',
  conf: appConf,
  version: '0.1',
  init: true
}, function(app) {
  switch(cmd) {
    case 'a':
    case 'ad':
    case 'add':
      userAdd(attrs, function(code, user) {
        console.log('Useradd done: ' + JSON.stringify(user));
        process.exit(code);
      })
      break;
    case 'm':
    case 'mo':
    case 'mod':
      userMod(attrs, function(code, identity) {
        console.log('Usermode done.');
        process.exit(code);
      })
      break;
  }
})
