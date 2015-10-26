var extend = require('util')._extend;
var Submission = require('../../lib/submission.js');
var restConf = require('../../config/rest.json');

function verifyUsers(req, callback) {
  Session.get(req.session, function(err, sess) {
    if(err || !sess) {
      callback(500, {});
      return;
    }

    var info = {session: sess}, keys = [];

    // If allowed guests can forward messages as maiL
    if(sess.user && sess.user.key) {
      keys.push(sess.user.key);
    } else if(SubmissionClient.guest) {
      keys.push(SubmissionClient.guest);
    } else {
      callback(404);
      return;
    }

    if(req.params.To) {
      var to = Submission.parseAddress(req.params.To);

      if(!to) {
        keys.push(req.params.To);
      } else {
        info.To = to;
      }
    }

    console.log('keys:'+keys);
    Knex('users').whereIn('key', keys).select('category', 'name', 'key', 'origin', 'display_name', 'avatar').then(function(users) {
      console.log('users:'+JSON.stringify(users));

      if(!users.length) {
        callback(404);
        return;
      }

      info.User = users[0].key === keys[0] ? users[0] : users[1];

      if(!info.User) {
        callback(404);
        return;
      }

      info.User.url = [ restConf.static.url, info.User.category, info.User.name ].join('/').replace(/\/\/*/g, '/');
      info.From = '"' + info.User.display_name + '" <' + info.User.key + '@' + info.User.origin + '>';

      if(!info.To) {
        var to = users[0].key === keys[1] ? users[0] : users[1];

        if(to) {
          info.To = '"' + to.display_name + '" <' + to.key + '@' + to.origin + '>';
        }
      }

      callback(null, info);
    })
  })
}

function createSubmission(req, opts, callback) {
  console.log('createSubmission:'+JSON.stringify(req.params));

  verifyUsers(req, function(err, info) {
    if(err) {
      callback(err);
      return;
    }

    console.log('VERIFY SENDER:'+JSON.stringify(info));

    if(!info.User) {
      callback(403);
      return;
    }

    var headers = extend({}, req.params);
    console.log('HEADERS:'+JSON.stringify(info));
    headers.From = headers.Cc = info.From;
    headers.To = info.To;
    headers.Origin = info.User.origin;

    Storage.getMessage(headers.Key, opts, function(perr, parent) {
      console.log('parent:'+JSON.stringify(parent));

      if(perr) {
        callback(perr);
        return;
      }

      if(parent) {
        headers.To = parent.data.To;
        headers.References = parent.references || [];
        headers.References.push(parent.key);

        if(parent.data.Cc) {
          headers.Cc += ',' + parent.data.Cc;
        }
        console.log('PARENT:'+headers.To);
      }

      console.log('OPTS:'+JSON.stringify(opts));
      var submission = new Submission(headers);

      submission.type = opts.type;
      submission.meta = extend({
        req: req,
        headers: headers,
        message: headers.Key ? parent : undefined,
        parent: parent
      }, info);

      callback(null, submission);
    })
  })
}

function storeSubmission(submission, opts, callback) {
  var refs = submission.get('References');
  var msg = submission.getMessage();

  Storage.storeMessage(msg, opts, function(err, message) {
    if(err) {
      callback(err);
      return;
    }

    console.log('Create message: ' + JSON.stringify(message));
    submission.set({Date: message.created_at});
    submission.meta.message = message;

    if(refs && refs.length) {
      console.log('Parent:'+refs[refs.length - 1]);
      submission.set({Parent: refs[refs.length - 1]});
      Storage.storeMessage(msg, {type: 'private', key: refs[0]}, function(perr, message2) {
        callback(perr);
      })
    } else {
      Storage.storeMessage(msg, {private: 'private', key: message.Key}, function(perr, message2) {
        callback(null);
      })
    }
  })
}

function executeSubmission(submission, callback) {
  var meta = submission.meta,
      message = submission.getMessage(),
      req = meta.req;

  SubmissionClient.send(submission, function(code) {
    submission.set({User: meta.User});

    console.log('Create message new: ' + JSON.stringify(message));

    CacheController.create({
      ts: Math.round(new Date(meta.message.created_at).getTime()/1000),
      submission: submission,
    }, function(cerr, results) {
      if(cerr) {
        console.log('Cache error: ' + cerr);
      }
      console.log('Cache results:'+results);
      callback(cerr);
    })
  })
}

function getRoles(submission, callback) {
  var refs = submission.get('References'),
      key = refs[0] || undefined;

  if(!key) {
    callback(null, {});
    return;
  }

  Knex('roles').select().where({key: key}).then(function(roles) {
    console.log('ROLES:'+JSON.stringify(roles));
    callback(null, roles[0] || {});
  })
}

module.exports = function() {
  this.exportAs = 'MessagesController';

  this.show = function(req, res, next) {
    console.log('SHOW:'+JSON.stringify(req.params));

    Knex('messages').where({key: req.params.id}).select('*').then(function(message) {
      console.log('M:'+JSON.stringify(message));
      res.send(message);
      res.next();
    }).catch(function(err) {
      console.log('M ERR:'+JSON.stringify(err));
    })
  }

  this.role = function(req, res, next) {
    console.log('ROLES:'+JSON.stringify(req.params));

    if(!req.session) {
      res.send(403);
      return next();
    }

    Session.get(req.session, function(err, sess) {
      if(err) {
        res.send(500);
        return next();
      }

      if(!sess || !sess.user) {
        res.send(403, {message: 'Please log in'});
        return next();
      }

      Knex('roles').where({key: req.params.Key}).then(function(roles) {
        res.send(roles || {});
        return next();
      })
    })
  }

  this.private = function(req, res, next) {
    console.log('PRIVATE:'+JSON.stringify(req.params));

    if(!req.session) {
      res.send(403);
      return next();
    }

    Session.get(req.session, function(err, sess) {
      if(err) {
        res.send(500);
        return next();
      }

      if(!sess || !sess.user) {
        res.send(403, {message: 'Please log in'});
        return next();
      }

      /*Knex('roles').where({key: req.params.Key}).then(function(roles) {
        var role = roles[0];

        if(!role) {
          res.send(404, {message: 'No roles'});
          return next();
        }*/

        Redis.priv.hgetall(req.params.Key, function(perr, results) {
          if(perr) {
            res.send(500, {});
            return next();
          }

          res.send(results);
          return next();
        })
      //})
    })
  }

  this.votes = function(req, res, next) {
    var fromTs = '-inf',
        toTs = 'inf',
        range = [req.params.id, fromTs, toTs];

    Redis.priv.zrangebyscore(range, function(err, response) {
      if(err) {
        res.send(500);
        return next();
      }
      res.send(response);
      return next();
    })
  }

  this.create = function(req, res, next) {
    console.log('Message create:'+JSON.stringify(req.params));
    console.log('Knex:'+typeof Knex);

    if(!SubmissionClient.client) {
      res.send(500, {message: 'Submission client error!'});
      return next();
    }

    var opts = {
      type: 'public',
      whitelist: req.params.whitelist,
      blacklist: req.params.blacklist,
    }

    opts.blacklist = opts.blacklist ? opts.blacklist.split(/[\s\t]*,[\s\t]*/) : [];
    opts.whitelist = opts.whitelist ? opts.whitelist.split(/[\s\t]*,[\s\t]*/) : [];
    delete req.params.whitelist;
    delete req.params.blacklist;

    createSubmission(req, opts, function(err, submission) {
      // console.log('SUBMISSION:'+JSON.stringify(submission));

      if(!submission.ok) {
        res.send(403, {});
        return next();
      }

      opts.key = submission.get('Key');

      storeSubmission(submission, opts, function(serr) {
        if(serr) {
          console.log('store submission: ' + serr);
        }

        console.log('store sub:'+JSON.stringify(submission.getMessage()));

        executeSubmission(submission, function(xerr) {
          if(xerr) {
            console.log('execute submission: ' + xerr);
          }

          submission.print();
          res.send(submission.getMessage(true));
          return next();
        })
      })
    })
  }

  this.forward = function(req, res, next) {
    console.log('Create forward:'+JSON.stringify(req.params));
    console.log('Knex:'+typeof Knex);

    if(!SubmissionClient.client) {
      res.send(500, {message: 'Submission client error!'});
      return next();
    }

    createSubmission(req, {type: 'public'}, function(err, submission) {
      // console.log('SUBMISSION:'+JSON.stringify(submission));

      if(!submission.ok) {
        res.send(403, {});
        return next();
      }

      var parent = submission.meta.parent;
      console.log('meta:'+JSON.stringify(parent));
      console.log('params:'+JSON.stringify(req.params));

      submission.meta.message = parent;
      submission.message.To = submission.meta.To;
      submission.message.Content = parent.data.Content;
      submission.message['Delivered-To'] = true;
      console.log('MESSAGE:'+JSON.stringify(submission.getMessage()));

      var refs = submission.get('References'),
          first = refs[0] || submission.get('Key');

      if(!first) {
        res.send(403, {});
        return next();
      }

      Knex('messages').select().where({key: first}).then(function(initial) {
        if(!initial[0]) {
          res.send(404, {});
          return next();
        }

        var wl = initial[0].whitelist || [];
        var msg = submission.getMessage();

        if(wl.indexOf(msg.To)) {
          wl.push(msg.To);
        }

        Knex('messages').where({key: first}).update({whitelist: JSON.stringify(wl)}).then(function(initial) {
          executeSubmission(submission, function(xerr) {
            if(xerr) {
              console.log('execute submission: ' + xerr);
            }

            res.send(submission.getMessage(true));
            return next();
          })
        })
      })
    })
  }

  this.vote = function(req, res, next) {
    console.log('messages vote:'+JSON.stringify(req.params));
    var sid = req.session;

    if(!sid) {
      res.send(403);
      return next();
    }

    Session.get(sid, function(err, sess) {
      if(err) {
        res.send(500);
        return next();
      }

      var citizen = sess.user.key;

      if(!sess || !citizen) {
        res.send(403);
        return next();
      }

      Knex('messages').select('*').where({key: req.params.id}).then(function(messages) {
        var message = messages[0];
        console.log('message:'+JSON.stringify(message));

        if(!message) {
          res.send(404);
          return next();
        }

        /*var request = {
          method: 'record',
          system: 'upvote',
          data: {
            citizen: citizen.id,
            vote: req.params.value,
            // poll: 's',
            poll: req.params.msgid,
            ballot: message,
            ballotTs: Math.round(new Date(message.created_at).getTime()/1000),
            ballotArea: message.area_id,

            author: message.author_id,
            authority: message.identity_id,
          }
        }*/

        /*var submission = new Submission({
          From: sess.user.key,
          To: message.key,
          References: message.references,
          Vote: req.params.value,
        })

        if(!submission.ok) {
          res.send(403, {lala:1});
          return next();
        }*/

        // VotesController.vote(submission.getMessage(), function(verr, response) {
        VotingController.upvote({user: sess.user, message: req.params.id, vote: req.params.value}, function(verr, response) {
          console.log('voting response:'+JSON.stringify(response));

          if(verr) {
            res.send(403);
            return next();
          }

          /*SubmissionClient.send(submission, function(code) {
            res.send(response);
            return next(false);
          })*/
          console.log('MESSAGE VOTE:'+JSON.stringify(response));
          res.send(response);
        })
      }).error(function(serr) {
        res.send(500, serr);
      })
    })

    return next(false);
  }
}
