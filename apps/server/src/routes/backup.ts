import { importSchema } from '@globy/shared';
import { Hono } from 'hono';
import { validate } from '../lib/validate';
import type { TripService } from '../services/trips';

export function backupRoutes(service: TripService) {
  return new Hono()
    .get('/export', (c) => {
      const date = new Date().toISOString().slice(0, 10);
      c.header('content-disposition', `attachment; filename="globy-backup-${date}.json"`);
      return c.json(service.exportBackup());
    })
    .post('/import', validate('json', importSchema), (c) => {
      const { backup, mode } = c.req.valid('json');
      return c.json(service.importBackup(backup, mode));
    });
}
