var fs = require('fs');

var Nl = '\n'.charCodeAt(0),
    Comma = ','.charCodeAt(0),
    OBracket = '['.charCodeAt(0),
    CBracket = ']'.charCodeAt(0);

function JBox(opts) {
  this.file = opts.file;
  this.format = 'jbox';
}

function JSON2JBox(data) {
  var str = JSON.stringify(data),
      buf;

  if(!Array.isArray(data)) {
    buf = new Buffer(str.length + 2);
    buf.write(str, 1);
    buf[buf.length - 1] = Comma;
  } else {
    buf = new Buffer(str.length);
    buf.write(str, 0);
    buf[buf.length - 1] = Comma;
  }

  buf[0] = Nl;
  return buf.toString();
}

function JBox2JSON(str) {
  if(!str) {
    return [];
  }

  buf = new Buffer(str);
  buf[0] = OBracket;

  if(buf[buf.length - 1] === Nl) {
    buf[buf.length - 2] = CBracket;
  } else {
    buf[buf.length - 1] = CBracket;
  }

  try {
    console.log('BUF:|'+buf.toString()+'|');
    return JSON.parse(buf.toString());
  } catch (ex) {
    console.log(ex);
    return false;
  }
}

JBox.prototype.append = function(data, callback) {
  var str = JSON2JBox(data);
  console.log('append to:' + JSON.stringify(this.file));

  fs.appendFile(this.file, str, function(ex) {
    callback(ex);
  })
}

JBox.prototype.read = function(opts, callback) {
  var self = this;

  if('function' === typeof opts) {
    callback = opts;
  }

  this.readDate = new Date();

  fs.readFile(this.file, function(err, data) {
    var json = JBox2JSON(data);

    if(json === false) {
      this.corrupt = true;
      callback && callback('Parse error');
    } else {
      this.data = json;
      this.corrupt = false;
      callback && callback(null, json);
    }
  })
}

module.exports = JBox;

/*var jbox = new JBox({file: './public/i/1/jbox.txt'});
jbox.read(function(err, data) {
  console.log('read:'+err);
  console.log('data:'+JSON.stringify(data));
})*/
/*jbox.append({from: 1, to:2345 }, function(err, data) {
  console.log('err:'+err);
  console.log('data:|'+data+'|');
});

jbox.append([{from: 1, to:2 }, {form:3,to:4}], function(err, data) {
  console.log('err:'+err);
  console.log('data:|'+data+'|');
});

jbox.read(function(err, data) {
  console.log('read:'+err);
  console.log('data:'+JSON.stringify(data));
})*/
