/*
knex.js -- knex
Copyright (C) 2015 Ivan Popovski
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
var fs = require('fs');
var path = require('path');
var extend = require('util')._extend;
var Knex = require('knex');
var Component = require(__dirname).create();
var conf = require('../../config/database.json');

GLOBAL.Knex = Knex(conf);

module.exports = function(opts) {
  /*Knex('messages').select('*').then(function(m) {
    console.log(m);
  });*/

  // GLOBAL.Knex = this.client;

  this.start = function(app) {
    /* if(app) {
      for(var i in this.models) {
        app.export(this.specs[i].exportAs, this.models[i]);
      }
    } */
  }
}
