var fs = require('fs');
var path = require('path');
var extend = require('util')._extend;
var Submission = require('../../lib/submission.js');
var auth = require('../../config/auth.json');
var crypto = require('crypto');
var helper = require('../../master/helper.js');
var staticService = require('../../config/rest.json');
var urlPrefix = staticService.static.url + staticService.prefix;

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

function getVotes(key, callback) {
  console.log('getVotes: citizen:' + key);

  //Redis.poll.zrangebyscore(['citizen:' + key, '-inf', 'inf'], function(err, votes) {
  Redis.poll.hgetall(key, function(err, votes) {
    callback(err, votes);
  })
}

function refreshSession(req, callback) {
  Session.save(req.session, {}, function(err, sess) {
    callback(err, sess);
  })
}

// Not used but could be useful.
function getSid(str) {
  if(str) {
    var sid = str.split(':');

    if(sid.length === 2) {
      return sid[1];
    }
  }
}

function checkParams(params) {
  return params;

  var password = params.password.trim(),
      name = params.name.trim(),
      email = params.email.trim().toLowerCase(),
      display_name = params.display_name.trim();

  if(!password || !name || !email || !display_name) {
    return "Wrong params";
  }

  if(password.length < 8) {
    return "Password must be at least 8 chars";
  }

  if(!email.match()) {
    return "Password must be at least 8 chars";
  }
}

module.exports = function() {
  this.votes = function(req, res, next) {
    console.log('USER VOTES:'+JSON.stringify(req.params));

    if(!req.session) {
      res.send(403, {message: 'Please login'});
      return next();
    }

    Session.get(req.session, function(err, sess) {
      if(err || !sess) {
        res.send(403, {});
        return next();
      }

      console.log('user votes session:'+JSON.stringify(sess));

      getVotes(sess.user.key, function(verr, votes) {
        console.log('user votes:'+JSON.stringify(votes));
        res.send(votes || []);
        return next();
      })
    })
  }

  this.create = function(req, res, next) {
    console.log('Create user:'+JSON.stringify(req.params));
    console.log('Create user headers:'+JSON.stringify(req.headers));

    if(req.session) {
      res.send(403, {});
      return next();
    }

    if(!req.params.password || !req.params.name || !req.params.email || !req.params.display_name) {
      res.send(403, {});
      return next();
    }

    var params = checkParams(req.params);

    if(params.error) {
      res.send(403, params.message);
      return next();
    }

    passwordGenerator(req.params.password, function(err, password) {
      var u = '"' + req.params.display_name + '" <' + req.params.email + '>';

      var submission = new Submission({
        From: u,
        To: u,
        Content: 'Registration',
        Origin: Conf.myorigin[0],
      })

      if(!submission.ok) {
        res.send(500);
        return next();
      }

      var oldpwd = req.params.password;
      req.params.password = password;
      req.params.key = submission.id;
      req.params.origin = submission.get('Origin');
      req.params.category = 'u';
      var avatar = ['/', req.params.category, req.params.name, 'avatar.png'].join('/').replace(/\/+/g, '/');
      req.params.avatar = urlPrefix + avatar;

      Knex('users').returning('*').insert(req.params).then(function(u) {
        console.log('users:'+JSON.stringify(u));
        var user = u[0];

        if(!user) {
          res.send(403, {});
          return next();
        }

        req.params.password = oldpwd;

        submission.set({From: user.key + '@' + user.origin, Cc: user.key + '@' + user.origin});
        submission.set({To: user.email});
        submission.set({Info: {
          User: submission.get('From'),
          Avatar: req.params.avatar,
          Ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress
        }})

        console.log('before print');
        submission.print();
        console.log('after print:'+typeof Storage, typeof Storage.storeMessage);

        Storage.storeMessage(submission.getMessage(), function(sterr, message) {
          if(sterr) {
            res.send(500, sterr);
            return next();
          }

          // submission.setKey(submission.rand());

          SubmissionClient.send(submission, function(code) {
            console.log('submission client ret:'+code);
            console.log('cp skel!: ' + Conf.skel);
            console.log('cp skel!: ' + './public/' + u[0].name);

            if(code) {
              //res.send(403, {});
              //return next();
            }

            helper.cpDir(Conf.skel, './public/' + u[0].category + '/' + u[0].name, function(cerr) {
              if(cerr) {
                console.log('cp skel err: ' + './public/' + u[0].name);
              }
              AuthsController.auth(req.params, function(aerr, passport) {
                Session.save(passport, function(sserr, data) {
                  res.setSid(data.getId());
                  res.send(data._getData());
                  return next();
                })
              })
            })
          })
        })
      }).catch(function(err) {
        console.log('Create user:'+err);
        if(err) {
          res.send(403, {});
          return next();
        }
      })
    })
  }

  // Get user info or votes (self/0 for self atm). 
  this.show = function(req, res, next) {
    console.log('SHOW USER:'+JSON.stringify(req.params));

    if(!req.session) {
      res.send(403, {message: 'Please login'});
      return next();
    }

    Session.get(req.session, function(err, sess) {
      if(err || !sess) {
        res.send(403, {});
        return next();
      }

      req.params.key = req.params.key == '0' ? sess.user.key : req.params.key;

      if(req.params.votes && req.params.key == sess.user.key) {
        getVotes(sess.user.key, function(verr, votes) {
          res.send(votes);
          return next();
        })
        return next();
      }

      Knex('users').where({key: req.params.key}).select().then(function(user) {
        if(!user[0]) {
          res.send(404, {});
          return next();
        }

        delete user[0].password;

        if(req.params.key != sess.user.key) {
          res.send(user[0]);
          return next();
        }

        refreshSession(req, function(serr) {
          if(serr) {
            res.send(500, {});
            return next();
          }
          res.setSid(req.session);
          res.send(user[0]);
          return next();
        })
        return next();
      })
    })
  }

  this.update = function(req, res, next) {
    res.send({});
    return next();
  }

  this.destroy = function(req, res, next) {
    res.send({});
    return next();
  }

  this.login = function(req, res, next) {
    console.log('LOGIN:'+JSON.stringify(req.params));
    console.log('LOGIN session:'+req.session);

    if(req.session) {
      res.send(403, {});
      return next();
    }

    AuthsController.auth(req.params, function(aerr, passport) {
      if(aerr) {
        res.send(aerr, {});
        return next();
      }

      Session.save(passport, function(sserr, data) {
        if(sserr) {
          res.send(500, sserr);
          return next();
        }

        res.setSid(data.getId());
        res.send(data._getData());
        return next();
      })
    })
  }

  this.logout = function(req, res, next) {
    if(!req.session) {
      res.send({});
      return next();
    }

    Session.rm(req.session, function(err) {
      res.setSid();
      res.send({});
      return next();
    })
  }

  // Trigger password reset
  this.reset = function(req, res, next) {
    if(req.session) {
      res.send(403, {});
      return next();
    }

    console.log('PASSWD:'+JSON.stringify(req.params));

    Knex('users').where({email: req.params.email}).select().then(function(users) {
      var user = users[0];

      if(!user) {
        res.send(404, {});
        return next();
      }

      SubmissionClient.sendMsg({q: 'passwd', msg: user}, function(code) {
        console.log('submission client passwd:' + code);
        res.send(code, {});
        return next();
      })
    })
  }

  // Change password
  this.passwd = function(req, res, next) {
    if(req.session) {
      res.send(403, {});
      return next();
    }

    console.log('PASSWD2:'+JSON.stringify(req.params));

    Knex('users').where({email: req.params.email}).select().then(function(users) {
      var user = users[0];

      if(!user) {
        res.send(404, {});
        return next();
      }

      var fromScore = Math.round(new Date().getTime()/1000) - Conf.resetpassword;

      Redis.cache.zrangebyscore('resetpassword', fromScore, 'inf', function(err, items) {
        if(err) {
          res.send(404, {});
          return next();
        }

        var item, parts;

        items.forEach(function(i) {
          parts = i.split(':');

          if(parts[3] == req.params.token) {
            item = i;
            return false;
          }
        })

        if(!item) {
          res.send(404, {});
          return next();
        }

        var file = path.join('public/', parts[0], parts[1], 'passwd', parts[2] + '.html')

        fs.unlink(file, function (uerr) {
          if(uerr) {
            console.log('Unable to unlink:' + file);
          }

          passwordGenerator(req.params.password, function(perr, password) {
            Knex('users').where({name: item[1]}).update({password: password}).then(function(result) {
              Redis.cache.zrem('resetpassword', item, function(zerr) {
                if(zerr) {
                  res.send(404, {});
                  return next();
                }

                res.send(200, {});
                console.log('resetPassword:'+JSON.stringify(result));
              })
            }).catch(function(err) {
              console.log('resetPassword err:'+JSON.stringify(err));
            })
          })
        })

        /*SubmissionClient.sendMsg({q: 'passwd', msg: extend(user, {finish: true})}, function(code) {
          console.log('submission client passwd:' + code);
          res.send(code, {});
          return next();
        })*/
      })
    })
  }

  // Fix!
  this.avatar = function(req, res, next) {
    console.log('AVATAR:'+JSON.stringify(req.params));

    var self = this,
        sid = req.session;

    if(!sid) {
      res.send(403);
      return next();
    }

    Session.get(sid, function(err, data) {
      if(err) {
        res.send(403);
        return next();
      }

      if(!data || !data.user) {
        res.send(403);
        return next();
      }

      Knex('users').where({key: req.params.key}).select().then(function(users) {
        var user = users[0];

        if(!user) {
          req.send(404);
          return next();
        }

        if(data.user.key != user.key) {
          res.send(403, {error: 403, message: 'Forbidden'});
          return next();
        }

        return UploadController.save.call(self, {
          req: req,
          user: user,
          prefix: 'public/',
          dir: '/' + user.category + '/' + user.name,
          appendSuffix: false,
          filterSuffix: ['.png','.jpg','.jpeg','.gif','.PNG','.JPG','.JPEG','.GIF']
        }, function(serr, data) {
          res.send({});
          return next();
        })
      })
    })
  }
}
