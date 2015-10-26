exports.up = function(knex, Promise) {
  return knex.schema.createTable('messages', function(t) {
    t.bigIncrements().primary();
    t.dateTime('created_at').notNull().defaultTo(knex.raw('now()'));
    t.string('key').unique().notNull();
    t.json('references', true);
    t.json('data', true).notNull();
    t.integer('upvotes').notNull().defaultTo(0);
    t.integer('downvotes').notNull().defaultTo(0);
  });  
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('messages');
};
