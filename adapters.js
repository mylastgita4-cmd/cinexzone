export async function searchTorrents(query, env) {
  const provider = env.TORRENT_PROVIDER || "yts";
  if (provider === "none") {
    throw new Error("Torrent endpoints are not enabled. Use authorized viewing and download sources.");
  }

  const cacheKey = `torrent:${provider}:${query.toLowerCase()}`;
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, "json");
    if (cached) return cached;
  }

  let results = [];
  if (provider === "yts") {
    results = await searchYTS(query);
  } else if (provider === "jackett") {
    results = await searchJackett(query, env);
  } else if (provider === "prowlarr") {
    results = await searchProwlarr(query, env);
  }

  if (env.CACHE && results.length) {
    await env.CACHE.put(cacheKey, JSON.stringify(results), {
      expirationTtl: parseInt(env.TORRENT_CACHE_TTL || "1800", 10),
    });
  }
  return results;
}

async function searchYTS(query) {
  const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}&limit=20&sort_by=seeds&order_by=desc`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`YTS request failed: ${res.status}`);
  const data = await res.json();
  const movies = data?.data?.movies || [];
  const out = [];
  for (const m of movies) {
    for (const t of m.torrents || []) {
      out.push({
        title: `${m.title_long} [${t.quality}]`,
        size: t.size,
        seeds: t.seeds,
        peers: t.peers,
        magnet: t.url,
      });
    }
  }
  return out;
}

async function searchJackett(query, env) {
  const base = env.JACKETT_URL?.replace(/\/$/, "");
  const url = `${base}/api/v2.0/indexers/all/results?apikey=${env.JACKETT_API_KEY}&Query=${encodeURIComponent(query)}&Limit=20`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Jackett request failed: ${res.status}`);
  const data = await res.json();
  return (data.Results || []).map((r) => ({
    title: r.Title,
    size: formatBytes(r.Size),
    seeds: r.Seeders,
    peers: r.Peers,
    magnet: r.MagnetUri || r.Link,
  }));
}

async function searchProwlarr(query, env) {
  const base = env.PROWLARR_URL?.replace(/\/$/, "");
  const url = `${base}/api/v1/search?apikey=${env.PROWLARR_API_KEY}&query=${encodeURIComponent(query)}&type=search&limit=20`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Prowlarr request failed: ${res.status}`);
  const data = await res.json();
  return data.map((r) => ({
    title: r.title,
    size: formatBytes(r.size),
    seeds: r.seeders,
    peers: r.leechers,
    magnet: r.magnetUrl || r.downloadUrl,
  }));
}

function formatBytes(bytes) {
  if (!bytes) return "N/A";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}
