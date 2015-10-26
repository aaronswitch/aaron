/*
 * GPLv3
 */

/*
 * Use in .forward:
 * "|exec /path/to/node /path/to/forward.js"
 */
var fs = require('fs');
var path = require('path');
var Submission = require('./lib/submission.js');
var Mail = require('./lib/mail.js');
var Aliases = require('./config/aliases.js');
var nodegit = require('nodegit');

var root = '/home/pope';
//var root = process.env.HOME;

function findMessageID(msg) {
  for(var key in msg) {
    if('message-id' === key.toLowerCase()) {
      return msg[key];
    }
  }
}

function repoCommit(msg, key) {
  console.log('MSG ID1:'+JSON.stringify(msg));
  var msgid = Submission.parseAddress(msg['Message-Id']);

  console.log('MSG ID:'+JSON.stringify(msgid));

  if(!msgid) {
    console.log('Repository wrong message id');
    return;
  }
      
  var file = msgid.name + '\@' + msgid.origin,
      repo, index, oid;

  console.log('FILE:' + file);
  console.log('KEY:' + path.join(root, key));

  nodegit.Repository.open(path.join(root, key)).then(function(repository) {
    repo = repository;
    fs.writeFile(path.join(repo.workdir(), file), JSON.stringify(msg));
    console.log('REPODIR:' + path.join(repo.workdir(), file));
    return repo.openIndex();
  }).then(function(idx) {
    index = idx;
    return index.read(1);
  }).then(function() {
    return index.addByPath(file);
  }).then(function() {
    return index.write();
  }).then(function() {
    return index.writeTree();
  }).then(function(oidResult) {
    oid = oidResult;
    return nodegit.Reference.nameToId(repo, "HEAD");
  }).then(function(head) {
    return repo.getCommit(head);
  }).then(function(parent) {
    var author = nodegit.Signature.create("Scott Chacon", "schacon@gmail.com", 123456789, 60);
    var committer = nodegit.Signature.create("Scott A Chacon", "scott@github.com", 987654321, 90);
    return repo.createCommit("HEAD", author, committer, "add: " + file, oid, [parent]);
  }).catch(function(err) {
    console.log("ERROR:"+err);
  }).done(function(commitId) {
    console.log("New Commit: ", commitId);
  })
}

process.stdin.resume();
process.stdin.setEncoding('utf8');

var data = '';

process.stdin.on('data', function(chunk) {
  data += chunk;
})

process.stdin.on('end', function() {
  var mail = new Mail(data);

  mail.submission.set({'Message-ID': findMessageID(mail.mail)});
  var msg = mail.submission.getMessage();

  if(Aliases.call(Submission, msg)) {
    repoCommit(msg, msg.Key);
  }

  // fs.writeFileSync('/home/pope/' + 'now', __dirname + ','+ process.cwd() + ',' + JSON.stringify(process.env) + ',' +JSON.stringify(mail));
  mail.print();
})
