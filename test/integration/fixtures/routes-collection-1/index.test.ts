import assert from "assert";
import path from "path";
import { loadRouteMatcher } from "../../../test_utils/routing";
import { requestToRouteMatcherContext } from "../../../../src/routing/RouteMatcherContext";
import { deepStrictEqualNullProto } from "../../../test_utils/assert";

describe.only(`${__dirname.split(path.sep).pop()}`, function() {

  const routeMatcher = loadRouteMatcher(__dirname);

  it('foo', async function() {

    const request = new Request('https://www.example.com/secret1');
    const routeMatcherContext = requestToRouteMatcherContext(request);

    const routeMatchResult = await routeMatcher.doRouter(routeMatcherContext);

    console.log(routeMatchResult);

    assert.ok(routeMatchResult.type === 'error');
    assert.strictEqual(routeMatchResult.status, 404);

  });

  it('foo2', async function() {

    const request = new Request('https://www.example.com/4-a.html');
    const routeMatcherContext = requestToRouteMatcherContext(request);

    const routeMatchResult = await routeMatcher.doRouter(routeMatcherContext);

    console.log(routeMatchResult);

    assert.ok(routeMatchResult.type === 'filesystem');
    assert.strictEqual(routeMatchResult.status, undefined);
    assert.strictEqual(routeMatchResult.dest, '/4-c.html');
    deepStrictEqualNullProto(routeMatchResult.headers, {
      '4-a-null': '1',
    });

  });




});
