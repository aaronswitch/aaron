/*
controller -- controller
Copyright (C) 2012 Ivan Popovski 

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
  console.log("generate controller:"+ctx.argv[ctx.arg]);
  if(!!ctx.argv[ctx.arg]) {
    var name = ctx.argv[ctx.arg];
    var convention = ctx.app.components.generators.controller.convention;

    if('rails' === convention) {
      name = name + '_controller';
    }

    var ctlPath = path.resolve('app', 'controllers', name + '.js');
    var ctlTmpl = '';

    /*
     * Default is restify controller type
     */
    if(!ctx.generic) {
      console.log("controller: "+ctx.argv[ctx.arg]);

      var ctlTmpl = [ 'module.exports = function(ctx) {',
        '  this.index = function(req, res, next) {',
        '    console.log("INDEX"); ',
        '    res.end("index");',
        '    return next();',
        '  }',
        '  this.new = function(req, res, next) {',
        '    console.log("NEW"); ',
        '    res.end("new");',
        '    return next();',
        '  }',
        '  this.create = function(req, res, next) {',
        '    console.log("CREATE"); ',
        '    res.end("create");',
        '    return next();',
        '  }',
        '  this.show = function(req, res, next) {',
        '    console.log("SHOW"); ',
        '    res.end("show");',
        '    return next();',
        '  }',
        '  this.edit = function(req, res, next) {',
        '    console.log("EDIT"); ',
        '    res.end("edit");',
        '    return next();',
        '  }',
        '  this.update = function(req, res, next) {',
        '    console.log("UPDATE"); ',
        '    res.end("update");',
        '    return next();',
        '  }',
        '  this.destroy = function(req, res, next) {',
        '    console.log("DESTROY"); ',
        '    res.end("destroy");',
        '    return next();',
        '  }',
        '}'
      ].join('\n');
    } else {
      ctlTmpl = [
        'var helper = require(\'helper\');',
        '',
        'module.exports = function(ctx) {',
        '  this.method1 = function(arg1, arg2) {',
        '    // Call this method: this.c.' + name + '.method1(...) ',
        '  }',
        '}'
      ].join('\n');
    }

    fs.stat(ctlPath, function(err, stat) {
      if(err == null) {
        console.log("Error: EEXIST, file already exists '" + ctlPath);

        if(ctx.force) {
          if(!helper.fWriteSync(ctlPath, ctlTmpl)) {
            console.log('  create ' + ctlPath);
          } else { 
            throw 'file write error: ' + ctlPath
          }
        }
      } else {
        if(!helper.fWriteSync(ctlPath, ctlTmpl)) {
          console.log('  create ' + ctlPath);
        } else {
          throw 'file write error: ' + ctlPath;
        }
      }
    });
  } else {
    console.log("Need controller name and actions");
  }
  ctx.arg++;
}

