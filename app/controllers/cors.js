var fs = require('fs');
var settings = require('../../config/cors.json');

setInterval(function() {
   fs.readFile('./config/cors.json', function(ex, data) {
     if(ex) {
       console.log('Error readin config/cors.json: ' + ex);
       return;
     }

     var cors;

     try {
       cors = JSON.parse(data);
     } catch(e) {
       console.log('Error parsing config/cors.json: ' + e);
     }

     settings = cors || settings;
   })
}, settings.reload*1000);

function setCors(res) {
  if(settings.on) {
    for(var i in settings.headers) {
      res.header(i, settings.headers[i]);
    }
  }
}

module.exports = function() {
  this.exportAs = 'CorsController';

  this.set = function(res) {
    setCors( res);
  }

  this.generic = function(req, res, next) {
    setCors(res);
    res.send({});
    return next();
  }
}
