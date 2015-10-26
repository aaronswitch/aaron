var extend = require('util')._extend;

/*
 * Add to sequelize chainer
 */
function sqlAdd(opts) {
  opts.chainer.add(opts.ballot[opts.op] ([opts.attr], {by: opts.value}));
}

/*
 * Execute sql chainer
 */
function sqlExec(opts, callback) {
  if(!opts.chainer) {
    callback();
    return;
  }
  opts.chainer.run().success(function() {
    callback();
  })
}

/*
 * Switch sql attributes and value
 */
function sqlSwitch(value) {
  if(value < 0) {
    return {
      attr: 'downvotes',
      value: -value
    }
  }
  return {
    attr: 'upvotes',
    value: value
  }
}

/*
 * Add to redis chainer
 */
function redisAdd(opts) {
  opts.chainer[opts.op] (opts.data);
}

/*
 * Execute redis chainer
 */
function redisExec(opts, callback) {
  if(!opts.chainer) {
    callback();
    return;
  }
  opts.chainer.exec(function(err, data) {
    callback(err, data);
  })
}

/*
 * Add to sequelize chainer
 */
function sqlAdd(opts) {
  opts.chainer.add(opts.ballot[opts.op] ([opts.attr], {by: opts.value}));
}

/*
 * Simple karma counter
 */
function votingCounter(request) {
  var distance;

  if(!!request.currentVotes) {
    if(!request.vote) {
      distance = -request.currentVotes;
    } else {
      distance = -(request.currentVotes - request.vote);
    }
  } else {
    distance = request.vote;
  }

  return distance;
}

/*
 * Redis updates
 */
function updatePoll(request, callback) {
  var citizenVotes = request.citizen;
  var citizenActivity = citizenVotes + ':activity'

  // var ballotPoll = request.poll + ':' + request.ballot.id;
  var ballotPoll = request.poll;
  var rolePoll = ballotPoll + ':roles';
  var redis = Redis.poll.multi();

  if(!!request.vote) {
    redisAdd({
      chainer: redis,
      op: 'hset',
      data: [citizenVotes, ballotPoll, request.vote + ':' + request.role]
    })
    redisAdd({
      chainer: redis,
      op: 'hset',
      data: [ballotPoll, request.citizen, request.vote]
    })
  } else {
    redisAdd({
      chainer: redis,
      op: 'hdel',
      data: [citizenVotes, ballotPoll]
    })
    redisAdd({
      chainer: redis,
      op: 'hdel',
      data: [ballotPoll, request.citizen]
    })
  }

  console.log('ROleZ:'+request.currentRole+','+request.role);

  if(request.currentRole == request.role) {
    redisAdd({
      chainer: redis,
      op: 'hincrby',
      data: [rolePoll, request.role, request.distance]
    })
  } else {
    redisAdd({
      chainer: redis,
      op: 'hincrby',
      data: [rolePoll, request.currentRole, -request.currentVote]
    })

    redisAdd({
      chainer: redis,
      op: 'hincrby',
      data: [rolePoll, request.role, request.vote]
    })
  }

  var voteScore = Math.round(new Date().getTime()/1000);
  var response = ballotPoll + ':' + request.vote;

  redisAdd({
    chainer: redis,
    op: 'zadd',
    data: [citizenActivity, voteScore, response]
  })

  redisExec({chainer: redis}, function(err, xret) {
    callback({error: err, record: response});
  })
}

function upvotePolling(options) {
  this.options = options;
  // this.client = options.client;
}

function votesDiff(request) {
  var distance;
  console.log('votesDiff:'+request.currentVote+','+request.vote);

  if(!!request.currentVote) {
    if(!request.vote) {
      distance = -request.currentVote;
    } else {
      distance = -(request.currentVote - request.vote);
    }
  } else {
    distance = request.vote;
  }

  console.log('distance:'+distance);
  return distance;
}

function getCurrentRecord(request, callback) {
  var citizenRecord = request.citizen;
  //var poll = request.poll + ':' + request.ballot.id;
  var poll = request.poll;
  
  Redis.poll.hget(citizenRecord, poll, function(err, currentVote) {
    var record = currentVote ? currentVote.split(':') : [0, 'public'];

    request.currentVote = !isNaN(parseInt(record[0])) ? parseInt(record[0]) : 0;
    request.currentRole = record[1] || 'public';
    callback(err, record[0], record[1]);
  })
}

function updateBallot(request, callback) {
  var sqlChainer = new Sequelize.Utils.QueryChainer;

  // Remove current vote
  if(request.currentVote) {
    sqlAdd(extend(sqlSwitch(request.currentVote), {
      chainer: sqlChainer,
      ballot: request.ballot,
      op: 'decrement',
    }))
  }

  // New vote?
  if(!!request.vote) {
    sqlAdd(extend(sqlSwitch(request.vote), {
      chainer: sqlChainer,
      ballot: request.ballot,
      //op: 'decrement',
      op: 'increment',
    }))
  }

  // Update author's speciality ie. karma per area
  // updateSpeciality(request, chainer);

  sqlAdd({
    chainer: sqlChainer,
    ballot: request.area,
    op: 'increment',
    attr: 'speciality',
    value: request.distance
  })

  sqlExec({chainer: sqlChainer}, function(err) {
    callback(err);
  })
}

upvotePollingRecord = function(request, callback) {
  console.log('VOTE ACTION:'+JSON.stringify(request));
  request.vote = !isNaN(parseInt(request.vote)) ? parseInt(request.vote) : 0;

  getCurrentRecord(request, function(verr) {
    if(verr) {
      callback(verr);
      return;
    }

    request.distance = votesDiff(request);

    if(!request.distance) {
      callback(null, {error: 304});
      return;
    }

    updateBallot(request, function(err) {
      if(err) {
        callback(err);
        return;
      }
      updatePoll(request, function(response) {
        callback(err, response);
      })
    })
  })
}

upvotePolling.prototype.revoke = function(request) {
  console.log('revoke:'+JSON.stringify(this.options));
}

function getCurrentRecords(request, callback) {
  var citizenVotes = request.citizen;
  var poll = request.poll + ':' + request.ballot.id;
  var opinionVotes = [];

  console.log('getCurrentRecords:'+citizenVotes+','+poll);
  
  // Filter opinion groups
  request.choice.forEach(function(o) {
    var opinion = poll + ':' + o.groups;

    if(opinionVotes.indexOf(opinion) < 0) {
      opinionVotes.push(opinion);
    }
  })

  if(!opinionVotes.length) {
    request.currentVotes = [];
    callback(err, votes);
    return;
  }

  opinionVotes.unshift(citizenVotes);

  Redis.poll.hmget(opinionVotes, function(err, votes) {
    console.log('getCurrentRecords HMGET:'+JSON.stringify(opinionVotes) + ',' + JSON.stringify(votes));
    if(err) {
      request.currentVotes = [];
      callback(err, votes);
      return;
    }
    votes = votes || [];

    request.currentVotes = votes.filter(function(v) {
      if(v) {
        return true;
      }
    })
    callback(err, votes);
  })
}

function prepareVotesFlush(request, callback) {
  if(!request.currentVotes.length) {
    return {record: []};
  }

  var opts = {
    record: [],
    sql: new Sequelize.Utils.QueryChainer,
    redis: Redis.poll.multi()
  }

  var citizenActivity = request.citizen + ':activity';
  var ballotPoll = request.poll + ':' + request.ballot.id;
  var voteScore = Math.round(new Date().getTime()/1000);
  var currentVotes = [],
      votes = [];

  console.log('PREPARE VOTE FLUSH C:'+request.currentVotes);
  console.log('PREPARE VOTE FLUSH:'+JSON.stringify(request.choice));

  request.choice.forEach(function(item) {
    request.currentVotes.forEach(function(cvote) {
      if(cvote) {
        var vote = cvote.split(':');
        vote[1] = vote[1] || 'public';

        if(item.id == vote[0]) {
          //currentVotes.push('statement_opinions:' + request.ballot.id + ':' + item.groups);
          currentVotes.push('o:' + request.ballot.id + ':' + item.groups);
          console.log('vs:'+item.id+','+cvote);

          redisAdd({
            chainer: opts.redis,
            op: 'hincrby',
            data: [ballotPoll + ':roles', vote[0] + ':' + vote[1], -1]
          })

          sqlAdd({
            chainer: opts.sql,
            attr: 'votes',
            op: 'decrement',
            value: 1,
            ballot: item
          })

          if(request.action == 'erase') {
            votes.push(item.id);
          }
          return false;
        }
      }
    })
  })

  if(currentVotes.length) {
    console.log('REM current votes:'+JSON.stringify(currentVotes));

    redisAdd({
      chainer: opts.redis,
      op: 'hdel',
      data: [request.citizen].concat(currentVotes)
    })
  }

  if(request.action == 'erase' && votes.length) {
    votes.unshift(ballotPoll + ':0');
    var record = votes.join(':');
    opts.record.push(record);

    redisAdd({
      chainer: opts.redis,
      op: 'zadd',
      data: [citizenActivity, voteScore, record]
    })
  }

  return opts;
}

function prepareVotesAdd(request, opts) {
  if(!request.vote) {
    return;
  }

  opts.record = opts.record || [];
  var citizenVotes = request.citizen;
  var citizenActivity = citizenVotes + ':activity'
  var ballotPoll = request.poll + ':' + request.ballot.id;

  var voteScore = Math.round(new Date().getTime()/1000);
  var voteRecord = String(ballotPoll);
  var votes = [];

  request.vote.forEach(function(vote) {
    request.choice.forEach(function(item) {
      if(item.id == vote.id) {
        console.log('ADD VOTE:'+item.id+','+JSON.stringify(vote));

        opts.sql = opts.sql || new Sequelize.Utils.QueryChainer;
        opts.redis = opts.redis || Redis.poll.multi();

        sqlAdd({
          chainer: opts.sql,
          attr: 'votes',
          op: 'increment',
          value: 1,
          ballot: item
        })
       
        redisAdd({
          chainer: opts.redis,
          op: 'hincrby',
          data: [ballotPoll + ':roles', vote.id + ':' + request.role, 1]
        })

        votes = votes.concat([
          // 'statement_opinions:' + request.ballot.id + ':' + item.groups,
          'o:' + request.ballot.id + ':' + item.groups,
          item.id + ':' + request.role
        ])

        voteRecord += ':' + item.id;
        return false;
      }
    })
  })
  opts.record.push(voteRecord);
    
  redisAdd({
    chainer: opts.redis,
    op: 'hmset',
    data: [citizenVotes].concat(votes)
  })
  redisAdd({
    chainer: opts.redis,
    op: 'zadd',
    data: [citizenActivity].concat([voteScore, voteRecord])
  })
}

choicePollingRecord = function(request, callback) {
  var chainer = new Sequelize.Utils.QueryChainer;
  console.log('OPINION VOTE ACTION:'+JSON.stringify(request));

  getCurrentRecords(request, function(gerr) {
    if(gerr) {
      callback(gerr);
      return;
    }

    console.log('CURRENT VOTE:'+JSON.stringify(request.currentVotes)+','+request.currentVotes.length);

    // potencijalni problem varijabla rmVote
    var opts = prepareVotesFlush(request);
    prepareVotesAdd(request, opts);

    /*if(!request.flush) {
      prepareVotesAdd(request, opts);
    }*/

    // New vote
    sqlExec({chainer: opts.sql}, function(err) {
      redisExec({chainer: opts.redis}, function(err, response) {
        console.log('redisExec response:'+JSON.stringify(response));
        callback(err, {record: opts.record});
      })
    })
  })
}

function attrSwitch(value) {
  if(value < 0) {
    return 'downvotes'
  }

  return 'upvotes';
}

function valueSwitch(value) {
  if(value < 0) {
    return -value;
  }

  return value;
}

function recordVote(request, vote, callback) {
  var citizen = request.user.key,
      activity = citizen + ':activity';

  var rolePoll = request.key + ':roles';
  var redis = Redis.poll.multi();

  if(!!request.vote) {
    redis.hset ([citizen, request.key, request.vote + ':' + request.role]);
    redis.hset ([request.key, request.user.key, request.vote]);
  } else {
    redis.hdel ([citizen, request.key]);
    redis.hdel ([request.key, request.user.key]);
  }

  var score = Math.round(new Date().getTime()/1000);
  // var response = request.key + ':' + request.vote + ':' + request.role + ':' + score;

  var response = [
    'vm', score, request.key, request.vote ? request.vote : 0, request.role
  ].join(':');

  //redis.zadd ([activity, score, JSON.stringify(response)]);
  redis.rpush ([activity, response]);

  redisExec({chainer: redis}, function(err, xret) {
    callback(null, {error: err, record: response});
  })
}

module.exports = function(ctx) {
  this.exportAs = 'VotingController';

  this.upvote = function(request, callback) {
    console.log('upvote request:'+JSON.stringify(request));

    Knex('messages').select('*').where({key: request.message}).then(function(m) {
      var message = m[0];
      console.log('message:'+JSON.stringify(message));

      if(!message) {
        callback(404);
        return;
      }

      request.key = message.key;

      Redis.poll.hget(request.user.key, message.key, function(err, rawRecord) {
        console.log('raw Record:'+rawRecord);

        var record = rawRecord ? rawRecord.split(':') : [0, 'public'];
        var vote = !isNaN(parseInt(record[0])) ? parseInt(record[0]) : 0;
        var currentRole = record[1] || 'public';

        if(request.vote == vote) {
          callback(null, []);
          return;
        }

        Knex('messages').where({key: message.key})
        .decrement(attrSwitch(vote), valueSwitch(vote))
        .then(function(m) {
          if(request.vote != 0) {
            Knex('messages').where({key: message.key})
            .increment(attrSwitch(request.vote), valueSwitch(request.vote))
            .then(function(m) {
              recordVote(request, vote, callback);
              console.log('err:'+err);
            })
          } else {
            recordVote(request, vote, callback);
          }
        }).catch(function(err) {
          console.log('err:'+err);
        })
      })
    })
  }
}
