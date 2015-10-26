/*
component.js -- framework component
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
 * Framework is made from components
 */
var Component = function(opts) {
  console.log('Component constructor: ' + JSON.stringify(opts));

  if(opts) {
    this.init(opts);
  }
}

/*
 * Static
 */
Component.create = function(opts) {
  return new Component(opts);
}

Component.prototype.toString = function() {
  return this.name;
}

Component.prototype.start = function() {
  console.log('Component start:'+this.name);
}

Component.prototype.init = function(opts) {
  this.name = opts.name;
  this.file = opts.file;
  console.log('Component init:'+this.name);

  return this;
}

Component.prototype.extend = function(opts) {
  // console.log('Component ' + this.name + ' extend with ' + opts.with);
  this[opts.with] = opts.action;
}

module.exports = Component;
