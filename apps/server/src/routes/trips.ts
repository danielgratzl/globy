import { idSchema, tripCreateSchema, tripPatchSchema } from '@globy/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../lib/validate';
import type { TripService } from '../services/trips';

const params = z.object({ id: idSchema });

export function tripRoutes(service: TripService) {
  return new Hono()
    .get('/', (c) => c.json({ trips: service.list() }))
    .post('/', validate('json', tripCreateSchema), (c) => c.json(service.create(c.req.valid('json')), 201))
    .get('/:id', validate('param', params), (c) => c.json(service.get(c.req.valid('param').id)))
    .patch('/:id', validate('param', params), validate('json', tripPatchSchema), (c) =>
      c.json(service.update(c.req.valid('param').id, c.req.valid('json'))),
    )
    .delete('/:id', validate('param', params), (c) => {
      service.remove(c.req.valid('param').id);
      return c.body(null, 204);
    })
    .post('/:id/restore', validate('param', params), (c) => c.json(service.restore(c.req.valid('param').id)));
}
