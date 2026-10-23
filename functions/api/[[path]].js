
import worker from "../../worker.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // Allow only the API endpoints used by the website.
  const allowedRoutes = new Set([
    "/api/health",
    "/api/home",
    "/api/latest",
    "/api/movies",
    "/api/trailer",
    "/api/tv/seasons",
    "/api/tv/season",
  ]);

  // Do not expose torrent-search or torrent-file download handlers.
  if (
    path === "/api/torrents" ||
    path === "/api/torrent-file"
  ) {
    return json(
      {
        error:
          "Torrent endpoints are not enabled. Use authorized viewing and download sources.",
      },
      403
    );
  }

  if (!allowedRoutes.has(path)) {
    return json({ error: "API route not found" }, 404);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // Reuse the existing Worker API logic without changing worker.js.
    return await worker.fetch(request, env, context);
  } catch (error) {
    console.error("CineX Zone API error:", error);

    return json(
      {
        error: "API request failed",
        message: "Please try again later.",
      },
      500
    );
  }
}
