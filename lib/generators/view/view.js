/*
view -- view
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
var mustache = require("mustache");

exports.generate = function(ctx) {
  var views = {};
  console.log("generate views:"+ctx.argv[ctx.arg]);

  if(!ctx.view_type) {
    ctx['view_type'] = 'mustache';
  }

  try {
    views = ctx.load().lib().generators().view(ctx['view_type'] + '.js');

    if(!views) {
      throw Error('Unable to load view generator');
    }
  } catch(e) {
    throw e;
  }

  var tmplDir = false;

  if(ctx.argv[ctx.arg]) {
    tmplDir = path.resolve('app', 'views', ctx.argv[ctx.arg]);
  }

  try {
    views.init.call(ctx, tmplDir);
  } catch(e) {
    throw e;
  }

  if(ctx.force) {
    var web, conf;
    var public = path.resolve('public');
    var layouts = path.resolve('app', 'views', 'layouts');

    try {
      web = ctx.load().config('web.json');
      conf = ctx.load().public('config.json');
    } catch(e) {
      throw e;
    }

    var files = fs.readdirSync(layouts);

    for(var i = 0; i < files.length; i++) {
      var suffixPattern = '^(.+)\.' + ctx['view_type'] + '$';
      var result = files[i].match(suffixPattern);

      if(result[1]) {
        var data = helper.fReadSync(path.resolve(layouts, files[i]));

        if(data) {
          var tmpl = mustache.compile(data);

          /*
           * Move to some normal place
           */
          var out = tmpl({
            "styleSheetLinkTag": '<link rel="stylesheet" href="http://twitter.github.com/bootstrap/assets/css/bootstrap.css">',
            "javascriptIncludeTag": '<script src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script>',
            "host_name": web.static.server_name,
            "url_path": web.static.url_path
          });

          var file = path.resolve(public, result[1]);

          if(!helper.fWriteSync(file, out)) {
            console.log("  update " + file);
          } else {
            throw 'json write error: ' + file;
          }
        }
      }
    }
  }
}

