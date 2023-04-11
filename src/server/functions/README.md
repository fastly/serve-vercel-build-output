### Functions

https://vercel.com/docs/concepts/functions/serverless-functions
https://vercel.com/docs/concepts/functions/edge-functions

Functions are the deepest level of execution in the Vercel infrastructure.

By this point it means the route matched a filesystem object, and that the object
was not found in cache.

* Serverless Function
* Edge Function
* API Route (Serverless function)
* Server-Rendering (Serverless or edge function)
* ISR (Serverless (or edge?) function)

#### Edge Function

These can be called simply by loading the Edge Function as a module asset,
calling the export specified by the config file, and then returning the response.

#### Serverless Function

We can't really support these realistically. The best we can do is to support Next.js
by running it in NextComputeJsServer for API Routes, Server-Rendering, and ISR.

We cannot support other runtimes such as generic nodejs, go, ruby, etc.

We can know that a function is a Next.js app by checking the `.vc-config.json` file
for the following values:

* `runtime`: Starts with `nodejs`
* `handler`: `___next_launcher.cjs`

#### NextComputeJsServer

This is in @fastly/next-compute-js and currently supports the 
API Route and Server-Rendering features of Next 12.3.0 (but not ISR or Preview).
