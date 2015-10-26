/*
git -- git
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
var fs = require("fs");
var path = require("path");
var helper = require("helper");

exports.generate = function(ctx) {
  var name;

  if(ctx.argv[ctx.arg]) {
    name = ctx.argv[ctx.arg];

    var modelFile = path.resolve('app', 'models', name + '.git.js');

    var out = [
      'module.exports = function(opts) {',
      '  this.opts = opts;',
      '}'
    ].join('\n');

    if(!helper.existsSync(modelFile)) {
      if(helper.fWriteSync(modelFile, out)) {
        throw 'file write error: ' + modelFile;
      }
    } else if(ctx.force) {
      if(helper.fWriteSync(modelFile, out)) {
        throw 'file write error: ' + modelFile;
      }
    }
  } else {
    console.log("Give model name");
  }
  ctx.arg++;
}

