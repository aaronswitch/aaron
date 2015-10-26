/*
routes -- routes
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
var fs = require("fs");
var path = require("path");
var helper = require("helper");

exports.generate = function(ctx) {
  var type = ctx.argv[ctx.arg++];

  if(!type) {
    type = "apache2";
  }

  var routesJson = path.resolve('config', 'routes.json');
  var conf = helper.jReadSync(routesJson);

  if(!conf) {
    throw 'file read error: ' + routesJson;
  }

  var genPath =  path.resolve('lib', 'generators', 'routes', type + '.js');

  console.log("genPath:"+genPath);
  if(!helper.existsSync(genPath)) {
    console.log("route generator problem: "+ type);
    return;
  }

  var gen = require(genPath).generate(null, conf);
}

