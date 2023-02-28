import assert from "assert";
import path from "path";
import { loadRouteMatcher } from "../../../test_utils/routing";
import { createRouteMatcherContext } from "../../../../src/routing/RouteMatcherContext";
import { deepStrictEqualNullProto } from "../../../test_utils/assert";

describe(`${__dirname.split(path.sep).pop()}`, function() {

  const routeMatcher = loadRouteMatcher(__dirname);

  it('foo', async function() {

    const routeMatcherContext = createRouteMatcherContext('https://www.example.com/secret1');

    const routeMatchResult = await routeMatcher.doRouter(routeMatcherContext);

    // console.log(routeMatchResult);

    assert.ok(routeMatchResult.type === 'error');
    assert.strictEqual(routeMatchResult.status, 404);

  });

  it('foo2', async function() {

    const routeMatcherContext = createRouteMatcherContext('https://www.example.com/4-a.html');

    const routeMatchResult = await routeMatcher.doRouter(routeMatcherContext);

    // console.log(routeMatchResult);

    assert.ok(routeMatchResult.type === 'filesystem');
    assert.strictEqual(routeMatchResult.status, undefined);
    assert.strictEqual(routeMatchResult.dest, '/4-c.html');
    deepStrictEqualNullProto(routeMatchResult.headers, {
      '4-a-null': '1',
    });

  });




});
