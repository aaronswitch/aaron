var conf = {
  host: "127.0.0.1",
  port: 9999,
}

if(process.argv.length < 5) {
  console.log('Usage: node q.js <queue> <msg_key1> <msg_val1> <msg_key2> <msg_val2> ...');
  process.exit(0);
}

var sock = require('net').Socket();
sock.connect(conf.port, conf.host);

sock.on('end', function(data) {
  console.log('Socket end:'+JSON.stringify(data));
})

sock.on('error', function(data) {
  console.log('Send error: '+JSON.stringify(data));
  sock = undefined;
})

sock.on('data', function(data) {
  console.log('Recv data: '+JSON.stringify(data));
})

var message = {};
message.q = process.argv[2];
message.msg = {};

for(var i = 3; i <= process.argv.length; i = i + 2) {
  message.msg[process.argv[i]] = process.argv[i + 1];
}

console.log('Send message: '+JSON.stringify(message));

sock.write(JSON.stringify(message), function(ex) {
  if(ex) {
    console.log('Write error:' + ex);
  }

  process.exit(0);
})
