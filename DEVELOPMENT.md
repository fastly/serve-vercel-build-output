# Development

This document aims to describe the architecture of this library and how one might want to
expand on this library.

## High level

`@fastly/serve-vercel-build-output` is a runtime library for Fastly Compute@Edge, which aims to execute an application
that conforms to [Vercel](https://vercel.com/)'s [Build Output API](https://vercel.com/docs/build-output-api/v3).

There are some specific goals here:

* Support [routing](https://vercel.com/docs/build-output-api/v3/configuration#routes), including middleware.

* Support [Middleware](https://vercel.com/docs/concepts/functions/edge-middleware), as part of a routing step.

* Support select [Vercel Primitives](https://vercel.com/docs/build-output-api/v3/primitives):

| Primitive Type                                                                                      | Support | Notes                                                                     |
|-----------------------------------------------------------------------------------------------------|---------|---------------------------------------------------------------------------|
| [Static Files](https://vercel.com/docs/build-output-api/v3/primitives#static-files)                 | Yes     | Similar to Vercel, all these files will be served from the Edge.          |
| [Serverless Functions](https://vercel.com/docs/build-output-api/v3/primitives#serverless-functions) | No      | At the current time we do not directly support Serverless Functions. (*1) | 
| [Edge Functions](https://vercel.com/docs/build-output-api/v3/primitives#edge-functions)             | Yes     | These are run against the Compute@Edge JavaScript runtime.                | 
| [Prerender Functions](https://vercel.com/docs/build-output-api/v3/primitives#prerender-functions)   | Yes     | These use the KV store to store the generated versions. (*2)              | 

*1 - Next.js running with `runtime: "nodejs"` will normally compile to a Serverless function. `@fastly/next-compute-js`
provides a replacement runtime to convert this into an Edge function so that it is possible to use with Compute@Edge.    

*2 - Vercel describes this as a "Serverless Function that will be cached by the Vercel Edge Network", but we support this
using an Edge function.

There are some non-goals:

* At this point, we do not plan to support Serverless functions.
  * A future option may be a way to delegate this to a node runtime running on an origin server.

## Architecture

## Classes

`VercelBuildOutputServer` - The "server" application that adapter code should call into. This makes the decision between
whether the current call is for the Infrastructure Layer or the Exec Layer, and then dispatches the appropriate call.

`VercelIntrastructureLayer` - When the server runs in Infrastructure mode, then it has a few steps to take:
* Edge Middleware Step
* Edge Cache Step
* Function Step

`EdgeMiddlewareStep` - Runs the Router

`VercelEdgeRouter` - the router class used by the edge middleware, used to generate some sort of
result.  The result is either a "redirect", "proxy", "synthetic", "filesystem", "error".
- redirect - a 302 (or any other 3xx) redirect to another URL, same or different domain.
- proxy - proxy a request to a backend
- synthetic - result synthesized by a middleware




`EdgeCacheStep` -

`FunctionStep` -

`VercelExecProxy` - A class that represents a call to and response from the Vercel Exec Layer.

`VercelExecLayer` - When the server runs in Exec mode, it loads the appropriate edge function and runs. 



