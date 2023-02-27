module.exports = (request, response) => {

    if (request.headers['foo'] === '1') {
        throw "error thrown";
    }

    if (request.headers['bar'] === '1') {
        response.statusCode = 500;
        response.end('triggered error 500');
        return;
    }

    if (request.headers['bar'] === '2') {
        response.statusCode = 404;
        response.end('triggered error 404');
        return;
    }

    if (request.headers['bar'] === '3') {
        response.statusCode = 502;
        response.end('triggered error 502');
        return;
    }

    response.end('Hello from serverless');
}
