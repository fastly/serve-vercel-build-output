### Edge Middleware

https://vercel.com/docs/concepts/functions/edge-middleware

This step represents the first level of execution in the Vercel infrastructure.

It handles actions such as:

* Redirects
* Rewrites
* Headers
* A/B Testing
* Feature Flags

This step needs access to:

* Router Config
* Known Asset Keys
* Function Assets (Edge Middleware)

When an incoming request is made, the request is put through a routing mechanism.

The routing mechanism happens in phases, during which the request is checked against a series
of rules each having conditions such as matching request URLs or request headers, and an
action, which is defined either in the route rule or as an author-provided middleware function.

In the end, the routing result is one of the following:

* Middleware response (Author-provided Middleware Function returned response)
* Redirect response (30x, asks user agent to try a different URL)
* Proxy response (Redirect would point outside current domain)
* Error response (500, 502, 404, etc)
  * Note that a 404 means the item didn't match a known asset key. The request never makes
    it to the next step of the infrastructure in that case. 
* Filesystem result (Request matches an Asset Key)

For all cases other than a filesystem result, we simply return the response to the caller.

If the item is a filesystem result, we move to the next step in the infrastructure:
Edge Network Cache

#### Author-provided Middleware

In order to call an author-provided middleware, we will use the Exec Layer. See Functions for
a discussion on why.
