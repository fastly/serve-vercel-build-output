# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

## [0.5.2] - 2024-04-09

### Fixed

- Include response headers from route matching (this includes those added by config files and middleware)
- Include correct headers in route errors 

## [0.5.1] - 2023-11-08

### Updated

- Apply "Compute" branding change.

## [0.5.0] - 2023-09-19

### Added

- Patch server-side fetch() so that loopback requests are replaced with a call to serveRequest().

### Updated

- Position @fastly/js-compute as a devDependency and peerDependency.

## [0.4.1] - 2023-07-24

### Updated

- Updated dependency libs

## [0.4.0] - 2023-07-04

### Added

- Initial public release

[unreleased]: https://github.com/fastly/serve-vercel-build-output/compare/v0.5.2...HEAD
[0.5.1]: https://github.com/fastly/serve-vercel-build-output/compare/v0.5.0...v0.5.2
[0.5.1]: https://github.com/fastly/serve-vercel-build-output/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/fastly/serve-vercel-build-output/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/fastly/serve-vercel-build-output/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/fastly/serve-vercel-build-output/releases/tag/v0.4.0
