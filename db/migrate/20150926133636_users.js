exports.up = function(Knex, Promise) {
  return Knex.schema.createTable('users', function(t) {
    t.bigIncrements().primary();
    t.dateTime('created_at').notNull().defaultTo(Knex.raw('now()'));
    t.dateTime('updated_at').notNull().defaultTo(Knex.raw('now()'));
    t.string('name').notNull();
    t.string('category').notNull();
    t.string('email').unique().notNull();
    t.string('display_name').notNull();
    t.string('password');
    t.string('key').unique().notNull();
    t.string('origin').notNull();
    t.string('avatar').notNull();
    t.string('agenda').notNull().defaultTo('');

    t.unique(['type', 'name']);
  });  
};

exports.down = function(Knex, Promise) {
  return Knex.schema.dropTable('users');
};
