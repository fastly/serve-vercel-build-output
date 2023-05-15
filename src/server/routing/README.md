# Routing

This is an attempt to describe the server routing.

## Pseudocode

### Function "doRouter"

1. Set up a context from the Request
    * context includes
        * request `method`, `pathname`, (request) `headers`, `query`, `cookie`
        * result `status` and (response) `headers`.
    * also includes "working" values of `pathname` and `query`, which are what is used for routing
        * at the beginning of each of the steps below, the working values of `pathname` and `query`
            reset to the values from request
        * result things like `status` and (response) `headers` stick around between steps

2. "Initial phase"
    * `doRouterPhase(null)`
        * NOTE: In Next.js, `check` is never set in this phase
        * found
            * `applyRouterResult(phaseResult, doDest: true)`
            * result
                * applied -> go to end
                * error -> go to error handler
                * skipped -> go to next phase
        * not found
            * check status, lt 200 or gt 400?
                * yes -> go to error handler 
3. "Main phase"
    * `main` is a synthetic phase that has exactly one route:
        * `src`: `.*`
        * `check`: `true`
    * `doRouterPhase('main')`
        * found
            * `applyRouterResult(phaseResult, doDest: true)`
            * result?
                * applied -> go to end
                * error -> go to error handler
                * skipped -> go to next phase
        * not found
            * check status, lt 200 or gt 400?
                * yes -> go to error handler 
4. "Fallback phase"
    * `doRouterPhase('resource')`
        * found
            * `applyRouterResult(phaseResult, doDest: true)`
            * result?
                * applied -> go to end
                * error -> go to error handler
                * skipped -> go to next phase
        * not found
            * check status, lt 200 or gt 400?
                * yes -> go to error handler 
5. "Error phase"
    * go to error handler with code 404

6. Error handler
    * `doRouterPhase('error')` (match status)
        * found
            * `applyRouterResult(phaseResult, doDest: true)`
            * result?
                * applied -> go to end
                * error -> sendError(500)
                * no -> sendError(status)
        * miss
            * sendError(404) 

### Function "doRouterPhase(phase)"

* `phase` - one of `null`, `resource`, `filesystem`, `rewrite`, `hit`, `miss`, `error`, or our custom `main`
* `context`
    * method
    * host
    * headers
    * query
    * cookie
    * src

* returns `phaseResult`
    * matched route
    * status
    * headers
    * dest

1. Iterate routes in the phase
    * Compare current context with the route
        * Apply `src`, `has`, `missing`, `methods`, and (in the future) `locale` as necessary
        * If `error` phase, then `status` is something that is checked too, rather than applied 
    * Does it Match?
        * yes
            * Is it middleware? (only in `null` phase)
                * yes -> run it
                    * did it crash?
                        * yes -> return `RouterResult` with `type: error` and `status: 500`
                    * process response
                        * `x-middleware-next` => `continue` (no response)
                        * `x-middleware-rewrite` => `dest` (no response)
                        * `Location` header (no response)
                        * `x-middleware-override-headers x-middleware-request-*` => add additional request headers before going next
                        * `headers` (incl cookies) (above `x-*` headers not included)
                        * `status`, if other than 200 or "no response" has been specified above
                        * `response` as `middlewareResponse` if "no response" hasn't been specified above
            * Collect results
                * `status`
                    * except for in `error` phase, don't set it.
                * `headers` (merge)
                * `dest` (merge query) + `check`
                * `response` (if it was middleware) (merge headers and status)
            * If `requestHeaders` present, then merge them with existing headers
            * Does the route generate a "synthetic result" (for middleware)?
                * yes
                    * return `RouterResult` with `type: synthetic`
            * Does the route refer to a full URL?
                * yes
                    * return `RouterResult` with `type: proxy`
            * Does the route have a redirect?
                * yes
                    * return `RouterResult` with `type: redirect`
            * Does the route have `continue`?
                * yes - continue loop with the next route
                * no - break loop
2. Was there a matched result?
   * yes
       * return `RouterResult` with `type: dest` (if there was no dest value, then use src)
       * includes collected status/headers/dest/check
   * no
       * return `RouterResult` with `type: miss`
           * includes collected status/headers

### Function "applyRouterResult"

Applies the result generated by the router

- `doDest` - if true, then `type: dest` will be applied

1. Is the result one of the following? (parens indicate expected phase for each type)
    ```
    synthetic (phases: null)
    redirect (phases: null)
    proxy (phases: null, 'filesystem', 'rewrite', 'resource')
    error (phase: 'error')
    ```
    * yes
        * serve it
        * return `applied`

2. is `doDest` true and the result is `type: dest`?
    * Look for `dest` in filesystem (static/functions)
        * found
            * `doRouterPhase('hit')`
                * This phase is only going to have `headers`
                * NOTE: These routes MUST NOT have `dest` or `status`
                * NOTE: No `dest` means also that `check` is invalid - will ignore
                * NOTE: All routes here must have `continue`, so there should never "be a match".
            * apply the `headers` from the `hit` phase to the context
            * serve the result (the one with `type: dest`)
                * This will go to `EdgeNetworkCacheStep` to build response
                    * did it throw?
                        * yes
                            * return `error` with `status: 500`
                        * no
                            * return `applied`
        * no
            * `check` ? (also auto false for filesystem, error)
                * yes
                    * `doRouterPhase('filesystem')`
                        * matched?
                            * yes
                                * `applyRouterResult(phaseResult, doDest: false)`
                                * result
                                    * applied -> return the result 
                                    * error -> return the result 
                                    * skipped -> go to next step
                            * no
                                * `doRouterPhase('miss')`
                                    * matched?
                                        * yes 
                                            * `applyRouterResult(phaseResult, doDest: true)`
                                            * result
                                                * applied -> return the result 
                                                * error -> return the result 
                                                * skipped -> go to next step
                    * `doRouterPhase('rewrite')`
                        * NOTE: in Next.js (server build) none of these will have `check` flag set
                        * matched?
                            * yes
                                * `applyRouterResult(phaseResult, doDest: true)`
                                * result
                                    * applied -> return the result 
                                    * error -> return the result 
                                    * skipped -> go to next step
                * no
                    * `doRouterPhase('miss')`
                        * matched?
                            * yes
                                * `applyRouterResult(phaseResult, doDest: true)`
                                * result
                                    * applied -> return the result 
                                    * error -> return the result 
                                    * skipped -> go to next step
3. return `skipped`
