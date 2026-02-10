import { DataSource } from 'typeorm';
import * as path from 'path';

// Database configuration from environment
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'hiperteam_master',
  migrations: [path.join(__dirname, '../migrations/*.js')],
  migrationsTableName: 'typeorm_migrations',
  logging: true,
});

async function runMigrations() {
  const command = process.argv[2];

  try {
    await dataSource.initialize();
    console.log('Database connected');

    if (command === 'run') {
      console.log('Running pending migrations...');
      const migrations = await dataSource.runMigrations();
      if (migrations.length === 0) {
        console.log('No pending migrations');
      } else {
        console.log(`Executed ${migrations.length} migrations:`);
        migrations.forEach(m => console.log(`  - ${m.name}`));
      }
    } else if (command === 'revert') {
      console.log('Reverting last migration...');
      await dataSource.undoLastMigration();
      console.log('Migration reverted');
    } else if (command === 'status') {
      const pendingMigrations = await dataSource.showMigrations();
      console.log('Pending migrations:', pendingMigrations);
    } else {
      console.log('Usage: npm run migrate [run|revert|status]');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runMigrations();