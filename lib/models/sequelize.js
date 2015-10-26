/*
sequelize.js -- sequelize
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
var fs = require('fs');
var path = require('path');
var extend = require('util')._extend;
var Sequelize = require('sequelize');
var Component = require(__dirname).create();

function SequelizeFactory(conf) {
  console.log('SequelizeFactory:'+JSON.stringify(conf));

  function sequelizeComponent() {
    this.createClient(conf);
    this.requireModels();
    this.setAssociations();

    this.start = function(app) {
      if(app) {
        for(var i in this.models) {
          app.export(this.specs[i].exportAs, this.models[i]);
        }
      }
    }
  }

  /*
   * Extend models with methods. All or ['models'].
   */
  sequelizeComponent.prototype.extend = function(obj, models) {
    models = models || [];

    if(!models.length) {
      for(var i in this.models) {
        extend(this.models[i], obj);
      }
    } else {
      for(var i = 0; i < models.length; i++) {
        if(this.models[models[i]]) {
          extend(this.models[models[i]], obj);
        }
      }
    }
  }

  sequelizeComponent.prototype.createClient = function(opts) {
    GLOBAL.SQL = Sequelize;
    opts.port = parseInt(opts.port);
    opts.dialect = opts.adapter;
    this.client = new Sequelize(opts.database, opts.username, opts.password, opts);
  }

  sequelizeComponent.prototype.requireModels = function(files) {
    this.specs = {};
    this.models = {};
    console.log('requireModels: sequelize');

    for (var name in Component.files) {
      var model = require(Component.files[name]);
      model.prototype.types = Sequelize;

      var spec = this.specs[name] = new model();
      this.models[name] = this.client.define(name, spec.define, spec.opts);
    }
  }

  sequelizeComponent.prototype.setRelation = function(dest, origin, assoc, settings) {
    var opts = extend({}, settings);

    if(opts.through) {
      opts.through = this.models[opts.through];
    }

    this.models[origin][assoc] (this.models[dest], opts);
  }

  sequelizeComponent.prototype.associate = function(what) {
    var associations = this.specs[what.origin][what.association];

    for(var dest in associations) {
      if(Array.isArray(associations[dest])) {
        for(var opts = 0; opts < associations[dest].length; opts++) {
          this.setRelation(dest, what.origin, what.association, associations[dest][opts]);
        }
      } else {
        this.setRelation(dest, what.origin, what.association, associations[dest]);
      }
    }
  }

  sequelizeComponent.prototype.setAssociations = function(models, names) {
    for(var spec in this.specs) {
      if(this.specs[spec].hasOne) {
        this.associate({
          origin: spec,
          association: 'hasOne',
        })
      }

      if(this.specs[spec].hasMany) {
        this.associate({
          origin: spec,
          association: 'hasMany',
        })
      }

      if(this.specs[spec].belongsTo) {
        this.associate({
          origin: spec,
          association: 'belongsTo',
        })
      }
    }
  }

  return new sequelizeComponent(conf);
}

var conf = require('../../config/database.json');

if(!module.parent) {
  conf.instance = true;
  var sequelizeController = SequelizeFactor(conf);
  sequelizeController.start();
} else {
  module.exports = SequelizeFactory(conf);
}
