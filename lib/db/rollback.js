var path = require("path");
var extend = require("util")._extend;
var Sequelize = require("sequelize");
var conf = require(path.resolve('config', 'database.json'));
var dest = path.resolve('db', 'migrate');
var options  = {};

// Types
GLOBAL.types = Sequelize;

module.exports = function(args) {
var _ = Sequelize.Utils._;

for(var key in conf) {
  var value = conf[key];

  if(['database', 'username', 'password'].indexOf(key) == -1) {
    options[key] = value;
  }
}

options = extend(options, { logging: false, dialect: conf.adapter });

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
