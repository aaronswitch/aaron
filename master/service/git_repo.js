var nodegit = require('nodegit'),
    fs = require('fs'),
    cache = require('../../app/controllers/cache.js');

function gitService(opts) {
  this.pending = true;
  console.log('git opts:'+JSON.stringify(opts))
  console.log('CONSOLE:'+JSON.stringify(Conf))
  this.uri = opts.service.substring(opts.service.indexOf(':') + 1);
  this.spool = opts.spool;
  this.repo = undefined;

  try {
    this.lastCommit = fs.readFileSync(this.spool + '.last').toString('ascii').trim();
  } catch(e) {
    this.lastCommit = '';
  }

  console.log('LAST COMMIT:'+ this.lastCommit);
}

gitService.prototype.getLastCommit = function() {
  console.log('getLastCommit:'+this.lastCommit);
  return this.lastCommit;
}

gitService.prototype.saveLastCommit = function(sha, callback) {
  this.lastCommit = sha;
  fs.writeFile(this.spool + '.last', this.lastCommit, callback);
  console.log('save last commit:' + this.lastCommit);
}

gitService.prototype.forEachCommit = function(startCommit) {
  console.log('forEachCommit:'+Object.keys(this) + ',' + startCommit.sha());

  var self = this,
      history = startCommit.history(),
      firstCommit = startCommit.sha();

  history.on('end', function() {
    if(!self.getLastCommit()) {
      self.saveLastCommit(firstCommit, function(e) {console.log('SAVE LAST COMMIT WITH ERROR:'+e); });
    }
    console.log('END:'+firstCommit);
  })

  history.on('commit', function(commit) {
    //console.log(firstCommit, self.getLastCommit());
    console.log('1');

    if(commit.sha() == self.getLastCommit()) {
      console.log('OKIOKI:'+firstCommit);
      self.saveLastCommit(firstCommit, function(e) {console.log('SAVE LAST COMMIT WITH ERROR:'+e); });
      history.end();
      return;
    }

    console.log("commit " + commit.sha());
    var author = commit.author();
    console.log("Author:\t" + author.name() + " <", author.email() + ">");
    console.log("Date:\t" + commit.date());
    console.log("Data - " + new Date(commit.date()));

    // Give some space and show the message.
    console.log("\n    " + commit.message());

    var msg = commit.message().split(':');
    console.log('msg:'+msg);

    if(msg[0].trim() === 'add') {
      var file = msg[1].trim();
      console.log('file:'+file);

      commit.getEntry(file).then(function(entry) {
        return entry.getBlob();
      }).then(function(blob) {
        //Master.insert(JSON.parse(blob), function(err, msg) {
        var message = JSON.parse(blob);

        Master.inject(message, {rmLast: true}, function(err, msg) {
          console.log('Master storeForModeration:'+err);
          console.log('Master storeForModeration:'+JSON.stringify(msg));

          /*if(!err) {
            Master.submit(msg);
          }*/
        })
      }).catch(function(err) {
        console.log('err:'+err);
      })
    }
  })

  history.start();
}

gitService.prototype.create = function(master) {
  var self = this;
  console.log('git create:'+this.uri + ',' + this.spool);

  var cloneRepository = nodegit.Clone(this.uri, this.spool, {});

  var errorAndAttemptOpen = function(err) {
    console.log('GIT OPEN ERROR:'+err);
    return nodegit.Repository.open(self.spool);
  };

  var errorAndStop = function(err) {
    console.log('GITT REPO ERROR:'+err);
  };

  cloneRepository.catch(errorAndAttemptOpen).then(function(repository) {
    self.repo = repository;

    return self.repo.fetchAll({
      credentials: function(url, userName) {
        console.log('credentials:'+url);
        return nodegit.Cred.sshKeyFromAgent(userName);
      },
      certificateCheck: function() {
        return 1;
      }
    })
  }).then(function() {
    return self.repo.mergeBranches("master", "origin/master");
  }).then(function() {
    console.log("Is the repository bare? %s", Boolean(self.repo.isBare()));
    return self.repo.getMasterCommit();
  }).catch(errorAndStop)
    .then(this.forEachCommit.bind(this));

  setInterval(function() {
    console.log('git service interval');

    self.repo.fetchAll({
      credentials: function(url, userName) {
        console.log('credentials:'+url);
        return nodegit.Cred.sshKeyFromAgent(userName);
      },
      certificateCheck: function() {
        return 1;
      }
    }).then(function() {
      return self.repo.mergeBranches("master", "origin/master");
    }).then(function() {
      console.log("Is the repository bare? %s", Boolean(self.repo.isBare()));
      return self.repo.getMasterCommit();
    }).catch(errorAndStop).then(self.forEachCommit.bind(self));
  }, 10*1000)
}

module.exports = gitService;
