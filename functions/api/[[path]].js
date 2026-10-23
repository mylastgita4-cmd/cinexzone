
const API_BASE_URL = "https://cinewave.galishadilshan045.workers.dev";

export async function onRequest(context) {
  const { request, params } = context;
  const incomingUrl = new URL(request.url);

  // Forward the API path and query parameters to the old Worker
  const pathParts = params.path || [];
  const apiPath = Array.isArray(pathParts)
    ? pathParts.join("/")
    : String(pathParts);

  const targetUrl = new URL(
    `${API_BASE_URL}/api/${apiPath}`
  );

  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method)
      ? undefined
      : request.body,
    redirect: "follow"
  });

  const response = await fetch(proxyRequest);
  const responseHeaders = new Headers(response.headers);

  responseHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}
