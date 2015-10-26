/*
server.js -- app server
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
var name = require('./package.json').name;
var version = require('./package.json').version;
var conf = process.argv[2] || './config/application.json';
var StorageDrv = require('./lib/storage.js');
var mainConf = require('./config/main.json');
GLOBAL.Conf = mainConf;

var Framework = require("./lib/framework.js");
var framework = new Framework();

framework.start({
  app: name,
  conf: conf,
  version: version,
  init: true
}, function(app) {
  app.export('Storage', new StorageDrv());
  console.log(this.toString());
  // console.log('GLOBALS:'+Object.keys(GLOBAL));
})
