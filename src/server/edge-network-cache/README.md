### Edge Network Cache

https://vercel.com/docs/concepts/edge-network/caching

This step is the second level of execution in the Vercel infrastructure.

Any request not handled at the Edge Middleware is handled here:

* HTML
* CSS
* JavaScript
* Fonts
* Function Responses

At this point, the request should map to an item in the filesystem,
either static or a function.

* Static files: Vercel automatically caches at the edge after the first request.
  See [Static Files Caching](https://vercel.com/docs/concepts/edge-network/caching#static-files-caching)
  * Vercel serves static files with `Cache-Control: public, max-age=0, must-revalidate` by default,
    so that user agents don't cache them.

* Function responses
  * [Caching Edge Function Responses](https://vercel.com/docs/concepts/functions/edge-functions/edge-caching)
  * [Caching Serverless Function Responses](https://vercel.com/docs/concepts/functions/serverless-functions/edge-caching)

In our implementation, static files never need to be fetched as they are always available
(wasm-inline or object-store), and should always have a `X-Vercel-Cache: HIT`.

For serverless or edge functions we execute the function by calling the next step in
the infrastructure: Functions.

#### Exec Layer

When making a call to a serverless or edge function, we need to use Exec Layer to call back into
the application.

This is because each serverless or edge function is compiled assuming it will run in its own
sandbox, meaning that each will have its own copy of polyfills and global state. This means
we want to be able to load it in a fresh environment. There is no way to unload a module, so
the Exec Layer is a mechanism by which to call into itself.

An example of this is that Webpack injects a global variable called `__import_unsupported` into
each execution environment, and is defined with `configurable: false`. This declares that
it cannot be overwritten, which causes errors when two such programs are loaded simultaneously.

#### Prerender functions

We do also need to care for Prerender functions, which enable features such as ISR and
Preview mode.
These are configured using the `*.prerender-config.json` file, which would exist as a sibling to
the corresponding `*.func` folder.

Prerender functions allow for the following:
* The result of a prerender function with each permutation of query params specified in `allowQuery`
  will be cached with a TTL equal to `expiration` seconds.
* If the item is stale, then it renders the previous version, or if not available, then
  the prerender fallback, and kicks off a new fetch to the function to cache the result.
* Not sure what `group` does. The description in the docs says:
  *Option group number of the asset. Prerender assets with the same group number will all be
  re-validated at the same time.*

Vercel uses a global cache for prerender, so using the Fastly cache will not work well for
prerender function results.

Instead, we should use KV store for this. It also ties the revision number to the cache,
so `FASTLY_SERVICE_VERSION` might make sense to include in the "cache key" too.

NOTE: KV Store keys can be max 1024 chars, so we might have to find ways to avoid problems with
cache key.

If the header contains `x-prerender-revalidate: XXXX`, then the item is ALWAYS revalidated, unless
it also contains `x-prerender-revalidate-if-generated: 1` in which case it's only revalidated if
it has already had a value built for it. If a revalidation occurs in this way, then the
response needs to contain `X-Vercel-Cache: REVALIDATED`.

If the header contains `__prerender_bypass: XXXX` a cookie value, whether `XXXX` equals the
`bypassToken` value in `*.prerender-config.json`, then the response should bypass the caching
mechanism and the response needs to contain `X-Vercel-Cache: MISS`.

#### X-Vercel-Cache header

Vercel adds the following header value for `X-Vercel-Cache` depending on what happened.

* `MISS`: The response was not found in the edge cache and so was fetched from an origin.
* `HIT`: The response was served from the edge cache.
* `STALE`: The response was served from the edge cache. A background request to the origin server was made to
  update the content.
* `PRERENDER`: The response was served from static storage (prerender fallback). 
* `REVALIDATED`: The response was served from the origin server and the cache was refreshed due to an authorization
  from the user in the incoming request.

In our implementation, there would be some minor differences:

* `MISS`: Never happens for static assets.
