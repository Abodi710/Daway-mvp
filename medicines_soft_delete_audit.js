// Knex.js migration for Soft Delete and Audit Trail on medicines table

exports.up = function(knex) {
  return knex.schema
    .alterTable('medicines', table => {
      table.timestamp('deleted_at').nullable();
      table.string('deleted_by').nullable();
    })
    .then(() => {
      // Create audit table
      return knex.schema.createTableIfNotExists('medicines_audit', table => {
        table.increments('id');
        table.integer('med_id').notNull().references('id').inTable('medicines');
        table.string('action').notNull(); // INSERT, UPDATE, DELETE
        table.string('changed_by').notNull();
        table.timestamp('changed_at').defaultTo(knex.fn.now());
      });
    })
    .then(() => {
      // Create triggers using raw SQL
      return knex.raw(`
        -- Trigger for INSERT
        CREATE TRIGGER IF NOT EXISTS medicines_insert_audit
        AFTER INSERT ON medicines
        FOR EACH ROW
        BEGIN
          INSERT INTO medicines_audit (med_id, action, changed_by)
          VALUES (NEW.id, 'INSERT', (SELECT user_id FROM app_user LIMIT 1));
        END;
      `);
    })
    .then(() => {
      return knex.raw(`
        -- Trigger for UPDATE
        CREATE TRIGGER IF NOT EXISTS medicines_update_audit
        AFTER UPDATE ON medicines
        FOR EACH ROW
        BEGIN
          INSERT INTO medicines_audit (med_id, action, changed_by)
          VALUES (
            NEW.id,
            CASE
              WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'DELETE'
              ELSE 'UPDATE'
            END,
            (SELECT user_id FROM app_user LIMIT 1)
          );
        END;
      `);
    })
    .then(() => {
      return knex.raw(`
        -- Trigger for DELETE (hard deletes)
        CREATE TRIGGER IF NOT EXISTS medicines_delete_audit
        AFTER DELETE ON medicines
        FOR EACH ROW
        BEGIN
          INSERT INTO medicines_audit (med_id, action, changed_by)
          VALUES (
            OLD.id,
            'DELETE',
            (SELECT user_id FROM app_user LIMIT 1)
          );
        END;
      `);
    });
};

exports.down = function(knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS medicines_insert_audit;
    DROP TRIGGER IF EXISTS medicines_update_audit;
    DROP TRIGGER IF EXISTS medicines_delete_audit;
  `)
  .then(() => {
    return knex.schema.dropTableIfExists('medicines_audit');
  })
  .then(() => {
    return knex.schema.table('medicines', table => {
      table.dropColumn('deleted_at');
      table.dropColumn('deleted_by');
    });
  });
};

// Application setup note:
// For each database connection, before performing operations, execute:
//   CREATE TEMP TABLE IF NOT EXISTS app_user (user_id TEXT);
//   DELETE FROM app_user;
//   INSERT INTO app_user (user_id) VALUES (current_user_id);
// Where current_user_id is the identifier of the user performing the operation.