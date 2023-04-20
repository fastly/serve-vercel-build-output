// Polyfills that are needed for getting this library to work in C@E

// process.env.NODE_ENV
globalThis.process ??= {};
globalThis.process.env ??= {};
globalThis.process.env['NODE_ENV'] = 'production';

// Headers.getAll()
globalThis.Headers.prototype.getAll = function(key) {

    // We do the best we can because the unfortunate way this is defined
    const value = this.get(key);
    if (value == null) {
        return [];
    }

    // The problem here is that we can have something like the following:
    // const h = new Headers();
    // h.append("Set-Cookie", "a=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT");
    // h.append("Set-Cookie", "b=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT");
    //
    // h.get("Set-Cookie")
    // // this will output a=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT, b=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT

    // We want this function to return the two values as a single array.

    const resultingValues = [];

    // These are all the pieces split by a comma.
    // cookie value cannot contain a literal comma (they would be URL encoded) so it's safe to split on this.
    // In the above example: [ 'a=1; Expires=Wed', ' 21 Oct 2015 07:28:00 GMT', ' b=1; Expires=Wed', ' 21 Oct 2015 07:28:00 GMT' ]
    const segments = value.split(',');

    let currentItem = null;

    // look at each segment
    for (const segment of segments) {
        // See if it contains a semicolon.  If it does, we consider only the first piece
        // cookie value cannot contain a literal semicolon (they would be URL encoded) so it's safe to split on this.

        // This first segment may or may not include an equals sign.
        // If it does, assume it's a new cookie.  otherwise,
        // assume this is part of the previous segment.

        const semicolonSplits = segment.split(';');
        if (semicolonSplits[0].includes('=')) {
            // new cookie
            if (currentItem != null) {
                resultingValues.push(currentItem);
            }
            currentItem = segment.trimStart();
        } else {
            // part of previous cookie
            currentItem = currentItem + segment;
        }
    }

    // At the end, if we have a current cookie then add it
    if (currentItem != null) {
        resultingValues.push(currentItem);
    }

    return resultingValues;
};

// Response.json (static)
if (typeof globalThis.Response.json !== 'function') {
    globalThis.Response.json = function(data, init) {
        return new Response(JSON.stringify(data), init);
    };
}

// __import_unsupported: Prevent it from being defined more than once.
const oldObjectDefineProperty = Object.defineProperty;
let __import_unsupported_already_assigned = false;
Object.defineProperty = (...args) => {
    if(args[0] === globalThis && args[1] === '__import_unsupported') {
        if (__import_unsupported_already_assigned) {
            return args[0];
        }
        __import_unsupported_already_assigned = true;
    }
    return oldObjectDefineProperty.apply(Object, args);
};
