/*
mailer -- mailer
Copyright (C) 2013 Ivan Popovski 

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/*
 */
var sys = require("sys");
var fs = require("fs");
var path = require("path");
var helper = require("helper");

exports.generate = function(ctx) {
  console.log("generate mailer:"+ctx.argv[ctx.arg]);

  if(!!ctx.argv[ctx.arg]) {
    var name = ctx.argv[ctx.arg];

    var mailerTmpl = [ 
      'module.exports = {',
      '  setup: {',
      '    // user: "username",',
      '    // password: "password",',
      '    host: "host.domain.com",',
      '    ssl: false',
      '  },',
      '  customMethod: function() {',
      '    console.log("Call me like this: this.mail.name.customMethod()")',
      '  }',
      '}'
    ].join('\n');

    var mailPath = path.resolve('app', 'mailers', name + '.js');

    fs.stat(mailPath, function(err, stat) {
      if(err == null) {
        console.log("Error: EEXIST, file already exists '"+name+".js'");
        if(ctx.force) {
          if(!helper.fWriteSync(mailPath, mailerTmpl)) {
            console.log('  create ' + mailPath);
          } else { 
            throw 'file write error: ' + mailPath
          }
        }
      } else {
        if(!helper.fWriteSync(mailPath, mailerTmpl)) {
          console.log("  create package.json");
        } else {
          throw 'file write error: ' + mailPath;
        }
      }
    });
  } else {
    console.log("Need mailer name and actions");
  }
  ctx.arg++;
}

