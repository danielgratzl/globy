import { buddyCreateSchema, buddyPatchSchema, idSchema } from '@globy/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../lib/validate';
import type { BuddyService } from '../services/buddies';

const params = z.object({ id: idSchema });

export function buddyRoutes(service: BuddyService) {
  return new Hono()
    .get('/', (c) => c.json({ buddies: service.list() }))
    .post('/', validate('json', buddyCreateSchema), (c) => c.json(service.create(c.req.valid('json')), 201))
    .patch('/:id', validate('param', params), validate('json', buddyPatchSchema), (c) =>
      c.json(service.rename(c.req.valid('param').id, c.req.valid('json'))),
    )
    .delete('/:id', validate('param', params), (c) =>
      c.json({ removedFromTrips: service.remove(c.req.valid('param').id) }),
    );
}
