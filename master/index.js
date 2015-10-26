/*
master -- Aaron master process - queue, generator glue 
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
var helper = require('./helper.js');
var extend = require('util')._extend;
var snuownd = require('../public/javascripts/snuownd.js');

var iconf = require('../config/identity.json');
var areas = require('../config/areas.json');
var register = require('../config/register.json');

var Framework = require("../lib/framework.js");
var Repo = require("../lib/repo.js");
var Submission = require("../lib/submission.js");
var framework = new Framework();

//var RolesController = new (require('../app/controllers/roles.js')) ();

var JBox = require('./jbox.js');
var QMgr = require('./qmgr.js');
var StorageDrv = require('./storage.js');

var masterConf = require('../config/master.json');
var mainConf = require('../config/main.json');
var aliasesConf = require(mainConf.alias_database);

mainConf.rest = require('../config/rest.json');
GLOBAL.Conf = mainConf;

mainConf.myorigin.forEach(function(dir) {
  try {
    fs.mkdirSync('./public/' + dir);
  } catch(e) {
    if ( e.code != 'EEXIST' ) throw e;
  }
})

function die(status, message) {
  status = status || 1;

  if('string' === typeof status) {
    message = status;
    status = 1;
  }

  console.log(message);
  process.exit(status);
}

function createService(opts) {
  console.log('createService:'+JSON.stringify(opts));
  var Service = require('./service/' + opts.type + '_' + opts.service.split(':') [0]);
  return new Service(opts);
}

function createServices(conf) {
  var service = {};

  for(var name in conf) {
    if(conf[name].on === true) {
      var srv = createService(conf[name]);

      if(srv) {
        service[name] = srv;
        srv.create(conf);
      }
    }
  }

  return service;
}

/*
 * Minimal framework context.
 * Usually resides in config/application.json.
 */
var appConf = {
  exportAs: 'App',
  version: "0.1",
  pidfile: "tmp/master.pid",
  components: {
    'dummy/dummy': {
      on: true,
      opts: {exportAs: 'Master'}
    },
    "models/knex": {
      "type": "relation",
      "on": true,
      "version": "0.1",
      "opts": {}
    },
    'views/mustache': {
      on: true,
      //opts: [{name: 'mua'},{name: 'mbox'},{name: 'messages'},{name: 'layouts'},{name: 'account_mailer'},{name: 'site_mailer'}]
      opts: {dialect: 'fumanchu'},
    },
    'nosql/redis': {
      on: true,
      opts: {use: ['priv', 'poll', 'cache']}
    }
  }
}

framework.start({
  app: 'master',
  conf: appConf,
  version: '0.1',
  init: true
}, function(app) {
  var view = App.find('views/mustache').require({name: 'mua'});
  var storage = new StorageDrv(mainConf.storage);

  app.export('View', view);
  app.export('Helper', helper);
  app.export('Storage', storage);

  var service = createServices(masterConf);
  var qmgr = new QMgr(mainConf.queues);

  var master = {
    app: app,
    conf: mainConf,
    qmgr: qmgr,
    service: service,
    mbox: JBox,
    submit: function(rawMsgs) {
      var msgs = this.qmgr.cleanup(rawMsgs);
      this.qmgr.enqueue('incoming', msgs);
      return msgs;
    },
    insert: function(msg, callback) {
      var refs = msg.References || [];
      refs = Array.isArray(refs) ? refs : [refs];
      var parentKey = refs[refs.length - 1];

      //Storage.getMessage(parentKey, {Key: parentKey, To: msg.To}, function(perr, parent) {
      Storage.getMessage(parentKey, {type: 'public'}, function(perr, parent) {
        console.log('parent:'+JSON.stringify(parent));

        if(perr) {
          callback(perr);
          return;
        }

        if(parent) {
          //headers.To = parent.data.To;
          //headers.References = parent.references || [];
          //headers.References.push(headers.Key);
        }

        Storage.storeMessage(msg, {type: 'public', key: msg.Key},function(err, message) {
          console.log('Storage:'+err);
          console.log('Storage:'+JSON.stringify(message));
          callback(err, message);
        })
      })
    },
    inject: function(msg, opts, callback) {
      var submission = new Submission(msg);

      if(!submission.ok) {
        callback(403);
        return;
      }

      submission.set({Key: msg['Message-Id']});

      var refs = submission.get('References');
      var first = refs[0];

      if(!first) {
        callback(404);
        return;
      }

      if(opts.rmLast) {
        refs.pop();
      }

      Storage.getMessage(first, {type: 'public'}, function(perr, initial) {
        console.log('initial:'+JSON.stringify(initial));

        if(perr) {
          callback(perr);
          return;
        }

        var from = Submission.verifyAddress(submission.get('From')),
            message = submission.getMessage(),
            sopts;

        if(from) {
          from = '<' + from.name + '@' + from.origin + '>';
        }

        if(initial.whitelist.indexOf(from) >= 0) {
          console.log('WHITELIST:'+from + ','+JSON.stringify(initial.whitelist));
          sopts = {type: 'public', key: submission.get('Message-Id')}
        } else {
          console.log('NOT WHITELISTED:'+from + ','+JSON.stringify(initial.whitelist));
          sopts = {type: 'private', key: submission.get('Message-Id')}
        }

        delete message['Delivered-To'];

        Storage.storeMessage(message, sopts, function(serr, m) {
          console.log('AFTER STORE MESSAGE!');

          if(sopts.type === 'public') {
            Master.submit(message);
          }
          callback(serr, m);
        })
      })
    },
    moderation: function(msg, opts, callback) {
      var refs = msg.References || [],
      refs = Array.isArray(refs) ? refs : [refs];
      var parentKey = refs[refs.length - 1];
      console.log('PARENT:'+parentKey);
      console.log('MODERATION:'+JSON.stringify(msg));

      Storage.getMessage(parentKey, {type: 'public'}, function(perr, parent) {
        console.log('perr:'+JSON.stringify(perr));
        console.log('parent:'+JSON.stringify(parent));

        if(perr && perr != 404) {
          callback(perr);
          return;
        }

        console.log('parent:'+JSON.stringify(parent));

        if(parent) {
          //headers.To = parent.data.To;
          //headers.References = parent.references || [];
          //headers.References.push(headers.Key);
        }

        console.log('WOOT?' + JSON.stringify(msg));
        var dflt = {type: 'private'};

        Storage.storeMessage(msg, extend(dflt, opts), function(err, message) {
          console.log('StorageMsg:'+err);
          console.log('StorageMsg:'+JSON.stringify(message));
          //callback(err, message);
          callback(err, msg);
        })
      })
    }
  }

  app.export('Master', master);
  console.log('GLOBAL:'+Object.keys(GLOBAL));
})
