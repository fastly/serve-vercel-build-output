// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as assert from 'assert';
import { Route } from '@vercel/routing-utils';

import RoutesCollection from '../../../src/routing/RoutesCollection.js';
import { Config } from '../../../src/types/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('routing/RoutesCollection', function() {
  describe('RoutesCollection', function() {
    describe('constructing', function() {

      it('constructs', function() {

        const routes: Route[] = [
          {
            src: '^/foo$',
          },
          {
            handle: 'filesystem',
          },
          {
            src: '^/bar$',
          },
        ];
        const routesCollection = new RoutesCollection(routes);

        assert.deepStrictEqual(routesCollection.routes, routes);
        assert.deepStrictEqual(routesCollection.getPhaseRoutes(null), [routes[0]]);
        assert.deepStrictEqual(routesCollection.getPhaseRoutes('filesystem'), [routes[2]]);
        assert.deepStrictEqual(routesCollection.getPhaseRoutes('resource'), []);

      });

      it('fails to construct if routes are not valid', function () {

        const routes: Route[] = [
          {
            src: '^/foo$',
          },
          {
            handle: 'hit',
          },
          {
            src: '^/bar$',
            dest: '/baz', // this is invalid, a 'hit' phase route cannot have a dest
          },
        ];

        assert.throws(() => {
          new RoutesCollection(routes);
        }, (err: any) => {
          assert.ok(err.name === 'RouteApiError');
          assert.strictEqual(err.message, 'Route at index 2 cannot define `dest` after `handle: hit`.');
          return true;
        });

      });

      it('can load routes from large config.json', function () {

        const configJson1 = fs.readFileSync(path.resolve(__dirname, '../fixtures/next-with-localization/config.json'), 'utf-8');
        const config1 = JSON.parse(configJson1) as Config;

        assert.ok(config1.routes);
        const routes1 = new RoutesCollection(config1.routes);

        assert.strictEqual(routes1.getPhaseRoutes(null).length, 14);
        assert.strictEqual(routes1.getPhaseRoutes('filesystem').length, 2);
        assert.strictEqual(routes1.getPhaseRoutes('resource').length, 2);
        assert.strictEqual(routes1.getPhaseRoutes('miss').length, 2);
        assert.strictEqual(routes1.getPhaseRoutes('rewrite').length, 10);
        assert.strictEqual(routes1.getPhaseRoutes('hit').length, 3);
        assert.strictEqual(routes1.getPhaseRoutes('error').length, 4);

        const configJson2 = fs.readFileSync(path.resolve(__dirname, '../fixtures/next-with-middleware/config.json'), 'utf-8');
        const config2 = JSON.parse(configJson2) as Config;

        assert.ok(config2.routes);
        const routes2 = new RoutesCollection(config2.routes);

        assert.strictEqual(routes2.getPhaseRoutes(null).length, 10);
        assert.strictEqual(routes2.getPhaseRoutes('filesystem').length, 2);
        assert.strictEqual(routes2.getPhaseRoutes('resource').length, 1);
        assert.strictEqual(routes2.getPhaseRoutes('miss').length, 1);
        assert.strictEqual(routes2.getPhaseRoutes('rewrite').length, 4);
        assert.strictEqual(routes2.getPhaseRoutes('hit').length, 3);
        assert.strictEqual(routes2.getPhaseRoutes('error').length, 2);


      });

    });


  });
});
