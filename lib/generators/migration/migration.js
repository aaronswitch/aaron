/*
jails -- migration
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
var Sequelize = require("sequelize");

var conf = require(path.resolve('config', 'database.json'));
var dest = path.resolve('db', 'migrate');

exports.migrate = function() {
  if(cfgExists) {
    var options  = {};

    var _ = Sequelize.Utils._;

    _.each(conf, function(value, key) {
      if(['database', 'username', 'password'].indexOf(key) == -1) {
        options[key] = value;
      }
    });

    options = _.extend(options, { logging: false, dialect: conf.adapter });

    var sequelize = new Sequelize(conf.database, conf.username, conf.password, options);
    sequelize.authenticate().success(function () {
      var migratorOptions = { path: dest };
      var migrator = sequelize.getMigrator(migratorOptions);

      sequelize.migrate().success(function() {
        process.exit(0);
      })
    })
  } else {
    throw new Error('Please add a configuration file under config/database.json.');
  }
}

exports.rollback = function() {
  var options  = {};

  var _ = Sequelize.Utils._;

  _.each(conf, function(value, key) {
    if(['database', 'username', 'password'].indexOf(key) == -1) {
      options[key] = value;
    }
  })

  options = _.extend(options, { logging: false, dialect: conf.adapter });

  var sequelize = new Sequelize(conf.database, conf.username, conf.password, options);
  sequelize.authenticate().success(function () {
    var migratorOptions = { path: dest };
    var migrator = sequelize.getMigrator(migratorOptions);

    sequelize.migrator.findOrCreateSequelizeMetaDAO().success(function(Meta) {
      Meta.find({ order: 'id DESC' }).success(function(meta) {
        if(meta) {
          migrator = sequelize.getMigrator(_.extend(migratorOptions, meta.values), true);
        }
        migrator.migrate({ method: 'down' }).success(function() {
          process.exit(0);
        })
       })
   })
  })
}

exports.generate = function(name) {
  var date = new Date();

  var year = date.getFullYear();
  var month = date.getMonth();
  var day = date.getDay();
  var hour = date.getHours();
  var min = date.getMinutes();
  var sec = date.getSeconds();

  if(month < 10) month = "0" + month;
  if(day < 10) day = "0" + day;
  if(hour < 10) hour = "0" + hour;
  if(min < 10) min = "0" + min;
  if(sec < 10) sec = "0" + sec;

  var glob = require('glob');
  var match = 'db/migrate/*-' + name + '.js';
  var files = glob.sync(match, {});

  if(files.length) {
    throw 'Existing migration? Please provide unique migration name';
  }

  migration = String(year) + month + day + hour + min + sec + "-" + name + ".js";

  var file = [
    "module.exports = {",
    "  define: {/* place model definition here */}, ",
    "  up: function(migration, types, done) {",
    "    // migration.createTable('"+name+"', module.exports.define).complete(done);",
    "  },",
    "  down: function(migration, types, done) {",
    "    // migration.dropTable('"+name+"').complete(done)",
    "  }",
    "}"
  ].join('\n')

  fs.writeFileSync(path.resolve(dest, migration), file);
}
