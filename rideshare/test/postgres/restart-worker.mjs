import {createDatabasePool,createPostgresTripStore} from '../../src/postgres-store.mjs';
const pool = createDatabasePool({connectionString: process.env.LIFTD_DATABASE_URL});
try {
  const store = createPostgresTripStore(pool);
  const trip = await store.get(process.argv[2]);
  const events = await store.history(process.argv[2]);
  console.log(JSON.stringify({revision: trip.revision, state: trip.state, events: events.length}));
} finally {await pool.end();}
