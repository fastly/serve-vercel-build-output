export default function index(request, event) {
    if (request.headers.get('foo') === '1') {
        throw "error thrown";
    }

    if (request.headers.get('bar') === '1') {
        return new Response("triggered error 500", {
            status: 500,
        });
    }

    if (request.headers.get('bar') === '2') {
        return new Response("triggered error 404", {
            status: 404,
        });
    }

    if (request.headers.get('bar') === '3') {
        return new Response("triggered error 502", {
            status: 502,
        });
    }

    return new Response(
        `Hello, from the Edge!`
    );
}
