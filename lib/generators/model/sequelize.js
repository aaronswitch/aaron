/*
model -- model
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
var fs = require("fs");
var path = require("path");
var helper = require("helper");

var confMigration = path.resolve('lib', 'generators', 'migration', 'migration.js');

var buildModelUpDown = function(opts, comma) {
  var out = [
    '  up: function(migration, dbTypes, done) {',
    '    migration.createTable("' + opts.name + '", module.exports.define).complete(done);',
    '  },',
    '  down: function(migration, dbTypes, done) {',
    '    migration.dropTable("' + opts.name + '").complete(done);',
  ]

  if(!!comma) {
    out.push('  },')
  } else {
    out.push('  }')
  }

  return out.join('\n')
}

var buildModelOpts = function(opts, comma) {
  var out = [ '  opts: {' ]

  if(opts.cfg[opts.cfg.use]['underscored']) {
    out.concat(['    underscored: true'])
  } else {
    out.concat(['    underscored: false'])
  }

  if(!!comma) {
    out.push('  },')
  } else {
    out.push('  }')
  }

  return out.join('\n')
}

var buildModelAssoc = function(opts, comma) {
  var out = [
    '  belongsTo: {',
    '  },',
    '  hasOne: {',
    '  },',
    '  hasMany: {',
  ]

  if(!!comma) {
    out.push('  },')
  } else {
    out.push('  }')
  }

  return out.join('\n')
}

var buildModelDefine = function(opts, comma) {
  var cfg = opts.cfg;
  var descr = opts.descr;

  var out = [
    '  deps: [],',
    '  define: {'
  ]

  if(descr.length) {
    out.push(
      '      id: { type: dbTypes.INTEGER, primaryKey: true, autoIncrement: true },'
    )

    if('timestamps' in cfg[cfg.use] && cfg[cfg.use]['timestamps']) {
      if(!('underscored' in cfg[cfg.use])) {
        cfg[cfg.use]['underscored'] = false;
      }

      if(cfg[cfg.use]['underscored']) {
        out.concat([
          "      created_at: dbTypes.DATE,",
          "      updated_at: dbTypes.DATE,"
        ])
      } else {
        out.concat([
          "      createdAt: dbTypes.DATE,",
          "      updatedAt: dbTypes.DATE,"
        ])
      }
    }
  } else {
    out.push('    /* Place model definition here */')
  }
 
  for(var i = 0; i < descr.length; i++) {
    var attribute = descr[i].split(':');

    if(attribute && attribute[0] && attribute[1]) {
      out.push('      ' + attribute[0] + ': dbTypes.' + attribute[1] + ',')
    }
  }

  if(!!comma) {
    out.push('  },')
  } else {
    out.push('  }')
  }

  return out.join('\n');
}

/*
 * Convert array into up/down migration code
 */
var modelConv = function(opts, comma) {
  console.log('modelDescr:'+JSON.stringify(opts.descr));

  var out = [
   'module.exports = {', 
    buildModelDefine(opts, true),
    buildModelUpDown(opts, comma),
   '}', 
  ]

  return out.join('\n')
}

exports.generate = function(ctx) {
  var name;

  if(ctx.argv[ctx.arg]) {
    name = ctx.argv[ctx.arg];

    var migratePath = path.resolve('lib', 'generators', 'migration', 'migration.js');

    var migrate = require(migratePath);
    var modelDescr = ctx.argv.splice(ctx.arg + 1, ctx.argv.length - ctx.arg - 1);

    var databaseJson = path.resolve('config', 'database.json');
    var cfg = require(databaseJson);

    var buildOpts = {
      cfg: cfg,
      name: name,
      descr: modelDescr,
    }

    var out = modelConv(buildOpts, false)

    /*
     * migration needs model name and types
     */
    ctx.name = ctx.argv[ctx.arg];
    ctx.data = out;

    migrate.generate(ctx);

    var modelFile = path.resolve('app', 'models', name + '.js');

    out = [
      'module.exports = {',
      buildModelDefine(buildOpts, true),
      buildModelOpts(buildOpts, true),
      buildModelAssoc(buildOpts, false),
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
