var fs = require('fs')
var path = require('path')
var extend = require('util')._extend
var formidable = require('formidable');
var im = require('imagemagick');

module.exports = function() {
  this.exportAs = 'UploadController';

  this.save = function(opts, callback) {
    var form = new formidable.IncomingForm();
    var files = []; 

    extend(form, {uploadDir: opts.prefix + opts.dir, encoding: 'utf-8'})

    form.on('file', function(field, file) {
      var basename = opts.file || file.name;
      var f = form.uploadDir + basename;
      var suffix = false;

      if(opts.appendSuffix) {
        var suffixMatch = file.name.match(/^.*(\..*)$/);

        if(suffixMatch && suffixMatch[1]) {
          f = f + suffixMatch[1];
        }
      }

      if(opts.filterSuffix) {
        var suffixMatch = file.name.match(/^.*(\..*)$/);

        if(suffixMatch && suffixMatch[1]) {
          var suffixFound = false;

          for(var i in opts.filterSuffix) {
            if(opts.filterSuffix[i] === suffixMatch[1]) {
              suffixFound = true;
              break;
            }
          }

          if(!suffixFound) {
            fs.unlink(file.path);
            callback(403);
            return;
          }
        } else {
          fs.unlink(file.path);
          callback(403);
          return;
        }
      }

      fs.rename(file.path, f, function(ex) {
        if(ex) {
          callback(500);
          return;
        }
        im.convert([f, '-resize', '128x128', form.uploadDir + '/avatar.png'], function(imgerr0, stdout0, stderr0) {
          if (!!imgerr0) {
            callback(500);
            return;
          }

          im.resize({
            srcPath: f,
            dstPath: f,
            width: 256,
          }, function(imgerr, stdout, stderr){
            if (!!imgerr) {
              callback(500);
              return;
            }
            var up = opts.dir + basename;
            callback(null, {path: f});
          })
        })
      })
    }).on('end', function() {
      console.log('END');
      // callback({});
    }).on('error', function() {
      console.log('ERROR');
      callback(500);
    })
    form.parse(opts.req);
  }
}
