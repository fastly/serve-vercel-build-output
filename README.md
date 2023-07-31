## Serve Vercel Build Output (v3) on Fastly Compute@Edge

> NOTE: `@fastly/serve-vercel-build-output` is provided as a Fastly Labs product. Visit the [Fastly Labs](https://www.fastlylabs.com/) site for terms of use.

This library's goal is to provide a runtime environment that executes output that targets the [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3).

Vercel's Build Output API is a file-system-based specification for a directory structure that represents a Vercel deployment. It includes static files, functions, and a configuration file that expresses routing and internationalization rules.

While it's not (currently) possible to simulate it 100%, it is able to run a wide variety of programs, including those written for [Next.js v12.3 and v13.x](https://nextjs.org).

Current support includes:

* The standard `.vercel` directory containing output that targets Vercel's Build Output API
* Static files
* Functions that target the Vercel Edge Runtime
* The following features of config.json:
  * Routing
  * Overrides
  * Wildcards
  * Image Optimization

## Usage

This library is typically used with [`@fastly/next-compute-js`](https://github.com/fastly/next-compute-js) (v2).
See `@fastly/next-compute-js` for more details.

## Issues

If you encounter any non-security-related bug or unexpected behavior, please [file an issue][bug]
using the bug report template.

[bug]: https://github.com/fastly/serve-vercel-build-output/issues/new?labels=bug

### Security issues

Please see our [SECURITY.md](./SECURITY.md) for guidance on reporting security-related issues.

## License

[MIT](./LICENSE).
