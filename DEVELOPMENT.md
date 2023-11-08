# Development

This document aims to describe the architecture of this library and how one might want to
expand on this library.

## High level

`@fastly/serve-vercel-build-output` is a runtime library for Fastly Compute, which aims to execute an application
that conforms to [Vercel](https://vercel.com/)'s [Build Output API](https://vercel.com/docs/build-output-api/v3).

There are some specific goals here:

* Support [routing](https://vercel.com/docs/build-output-api/v3/configuration#routes), including middleware.

* Support [Middleware](https://vercel.com/docs/concepts/functions/edge-middleware), as part of a routing step.

* Support select [Vercel Primitives](https://vercel.com/docs/build-output-api/v3/primitives):

| Primitive Type                                                                                      | Support | Notes                                                                     |
|-----------------------------------------------------------------------------------------------------|---------|---------------------------------------------------------------------------|
| [Static Files](https://vercel.com/docs/build-output-api/v3/primitives#static-files)                 | Yes     | Similar to Vercel, all these files will be served from the Edge.          |
| [Serverless Functions](https://vercel.com/docs/build-output-api/v3/primitives#serverless-functions) | No      | At the current time we do not directly support Serverless Functions. (*1) | 
| [Edge Functions](https://vercel.com/docs/build-output-api/v3/primitives#edge-functions)             | Yes     | These are run against the Compute JavaScript runtime.                     | 
| [Prerender Functions](https://vercel.com/docs/build-output-api/v3/primitives#prerender-functions)   | Yes     | These use the KV store to store the generated versions. (*2)              | 

*1 - Next.js running with `runtime: "nodejs"` will normally compile to a Serverless function. `@fastly/next-compute-js`
provides a replacement runtime to convert this into an Edge function so that it is possible to use with Compute.    

*2 - Vercel describes this as a "Serverless Function that will be cached by the Vercel Edge Network", but we support this
using an Edge function.

There are some non-goals:

* At this point, we do not plan to support Serverless functions.
  * A future option may be a way to delegate this to a node runtime running on an origin server.

## Architecture

## Classes

### Infrastructure

`VercelBuildOutputServer` - The "server" application that adapter code should call into.
This class orchestrates instances of the classes below and dispatches a request to the
`EdgeMiddlewareStep`, where processing begins.

`EdgeMiddlewareStep` - Simulates Vercel's "Edge Middleware Step":
* Performs routing - see `RouteMatcher` below
* Calls middleware if present
* Applies wildcards
* Calls into the Edge Network Cache step to serve static and function responses

`EdgeNetworkCacheStep` - Simulates Vercel's "Edge Network Cache Step":
* Checks if current request has a cached response
* If cache entry exists and is not expired, responds with cached copy
* Otherwise, calls into Function step to generate function response
* Always serves static assets as though they are cached

`FunctionsStep` - Executes an Edge function that corresponds to the current
request and returns the response.

`VercelExecLayer` - Used by `EdgeMiddlewareStep` and `FunctionsStep` to prepare the
request for calling a function asset.

### Routing

`RouteMatcher` - Performs actual routing of the current request against the
Vercel routing rules. See README.md in routing for implementation details.

`RoutesCollection` - Holds an abstraction of the routes defined in the Vercel config file.

`RouteSrcMatcher` - Tests a single route's "src" against a path string. 
