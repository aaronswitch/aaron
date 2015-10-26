var fs = require('fs');
var path = require('path');

function parsify(data, stringify) {
  var ret;

  if(Array.isArray(data)) {
    ret =  [];

    data.forEach(function(item) {
      ret.push(JSON.parse(JSON.stringify(item)));
    })
  } else {
    ret = {};

    for(var i in data) {
      ret[i] = JSON.parse(JSON.stringify(data[i]));
    }
  }

  if(stringify) {
    return JSON.stringify(ret);
  } else {
    return ret;
  }
}

function cp(source, target, cb) {
  var cbCalled = false;
  var rd = fs.createReadStream(source)
  rd.on('error', done)

  var wr = fs.createWriteStream(target)
  wr.on('error', done)
  wr.on('close', function(ex) {
    done();
  })
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}

function cpDir(src, dst, callback) {
  console.log('copyDir:'+src+','+dst);

  fs.readdir(src, function(err, files) {
    console.log('readdir:'+src+','+err);

    if(err) {
      console.log('Read dir error `' + src + '`: ' + err);
      return;
    }

    fs.mkdir(dst, function(e) {
      if(e) {
        console.log('Error creating directory: ' + dst);
        callback(e);
        return;
      }

      console.log('Created: ' + dst);
      var filenum = files.length;

      if(!filenum) {
        callback();
        return;
      }

      files.forEach(function(file) {
        var from = path.join(src, file);
        var to = path.join(dst, file);
        console.log('copy '+from + ' ' + to);

        fs.stat(from, function(serr, fstat) {
          if(fstat.isDirectory()) {
            console.log('directory' + from);

            cpDir(from, to, function() {
              console.log('copyDir done:'+filenum);
              if(!--filenum) {
                callback();
              }
            })
          } else {
            cp(from, to, function(cerr) {
              if(cerr) {
                console.log('Error copy ' + from + ' ' + to + ' [' + cerr + ']');
              }

              console.log('Ok copy ' + from + ' ' + to +','+filenum);

              if(!--filenum) {
                console.log('COPY done:'+cerr);
                callback(cerr);
              }
            })
          }
        })
      })
    })
  })
}

function getIdentity(identities, identity) {
  for(var i = 0; i < identities.length; i++) {
    if(identities[i].id == identity) {
      return identities[i];
    }
  }
}

function addIdentityId(array, identity) {
  var idx = array.indexOf(identity);

  if(idx < 0) {
    array.push(identity);
  }
}

module.exports = {
  parsify: parsify,
  cp: cp,
  cpDir: cpDir,
  getIdentity: getIdentity,
  addIdentityId: addIdentityId,
}
