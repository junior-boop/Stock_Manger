import { cleanupDatabases } from './helpers/client-db';

afterEach(() => {
  cleanupDatabases();
});
