## Serve Vercel Build Output (v3) on Fastly Compute@Edge

The [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3) is a file-system-based specification for a directory structure that represents a Vercel deployment. It includes static files, functions, and a configuration file that expresses routing and internationalization rules.

This library's goal is to provide a runtime environment that executes output that targets Vercel's Build Output API. While it's not (currently) possible to simulate it 100%, it is able to run a wide variety of programs, including those written for [Next.js v12.3 and v13.0](https://nextjs.org).

Current support includes:

* The standard `.vercel` directory containing output that targets Vercel's Build Output API
* Static files
* Functions that target the Vercel Edge Runtime
* The following features of config.json:
  * Routing
  * Overrides
  * Wildcards
  * Image Optimization

