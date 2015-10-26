/*
mustache.js -- mustache 
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
var fs = require('fs');
var path = require('path');
var mustache;
var Partials = {};

function mustacheSetup(template) {
  mustache.parse(Partials[template]);

  return function(dict) {
    return mustache.render(Partials[template], dict, Partials);
  }
}

function compileViews(views) {
  var compiled = {};

  for(var view in views) {
    compiled[view] = mustacheSetup(view);
    Partials[view] = views[view][view];

    for(var tmpl in views[view]) {
      if(tmpl != view) {
        compiled[view][tmpl] = mustacheSetup(view + '.' + tmpl);
        Partials[view + '.' + tmpl] = views[view][tmpl];
      }
    }
  }

  return compiled;
}

function ViewsMustache(optz) {
  function MustacheFactory(opts) {
    console.log('MUSTACHE OPTS:'+JSON.stringify(opts));

    if(opts.dialect == 'fumanchu') {
      mustache = require('./fumanchu.js');
    } else {
      mustache = require('mustache');
    }

    var Component = require(__dirname).create(opts);
    var views = this.views = compileViews(Component.require());
    this.start = function() {console.log('MUSTACHE START');};

    this.require = function(what) {
      if(what.partial) {
        return views[what.name][what.partial];
      } else {
        return views[what.name];
      }
    }
  }

  return MustacheFactory;
}

if(!module.parent) {
  var viewMustache = ViewsMustache();
} else {
  module.exports = ViewsMustache();
}
