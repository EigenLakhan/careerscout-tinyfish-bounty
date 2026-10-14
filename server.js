import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSearchQueries, discoverFollowupUrls, makeDiscoveredSearchPayload, mergeFetchPayloads, mergeSearchPayloads, normalizeSources, searchResults, selectInitialSearchResults } from "./normalize.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.TINYFISH_API_KEY;
const SEARCH_URL = "https://api.search.tinyfish.ai";
const FETCH_URL = "https://api.fetch.tinyfish.ai";
const MAX_BODY_BYTES = 16_000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      const error = new Error("Request body too large.");
      error.status = 413;
      throw error;
    }
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

async function tinyfishRequest(url, options) {
  if (!API_KEY) {
    const error = new Error("TinyFish API key is not configured. Copy .env.example to .env and set TINYFISH_API_KEY.");
    error.status = 503;
    throw error;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "X-API-Key": API_KEY,
      "Accept": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(45_000)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 6000) };
  }

  if (!response.ok) {
    // Never return request headers or secrets to the client.
    const error = new Error(`TinyFish returned HTTP ${response.status}. Check the key, request parameters, and account limits.`);
    error.status = response.status === 429 ? 429 : 502;
    error.details = data;
    throw error;
  }
  return data;
}

function safeError(res, error) {
  const status = Number.isInteger(error.status) ? error.status : 502;
  const message = status === 502 && error.name === "TimeoutError"
    ? "TinyFish request timed out. Please retry."
    : error.message || "Unexpected server error.";
  sendJson(res, status, { error: message, details: error.details || undefined });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "CareerScout Step 9.1 Classification Fix",
      tinyfishKeyConfigured: Boolean(API_KEY)
    });
  }

  if (req.method === "POST" && url.pathname === "/api/discover") {
    let body;
    try { body = await readJson(req); } catch (error) { return safeError(res, error); }
    const role = String(body.role || "software engineering internship").trim().slice(0, 120);
    const locationText = String(body.location || "India").trim().slice(0, 100);
    const keywords = String(body.keywords || "").trim().slice(0, 300);
    const seniority = String(body.seniority || "Student").trim().slice(0, 60);
    const visa = String(body.visa || "No preference").trim().slice(0, 80);
    const searchBreadth = body.searchBreadth === "expanded" ? "expanded" : "standard";
    const countryCode = String(body.countryCode || "IN").trim().toUpperCase();
    const language = String(body.language || "en").trim().toLowerCase();
    if (role.length < 2) return sendJson(res, 400, { error: "Enter a role or internship type." });
    if (!/^[A-Z]{2}$/.test(countryCode) || !/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
      return sendJson(res, 400, { error: "Invalid country or language code." });
    }
    const searchPlan = buildSearchQueries({ role, location: locationText, keywords, seniority, visa, searchBreadth });
    const query = searchPlan[0]?.query || [role, keywords, locationText, seniority].filter(Boolean).join(" ");
    try {
      // Expanded mode uses independent, preference-specific query variants. A partial
      // Search failure is non-fatal as long as at least one variant succeeds.
      const searchAttempts = await Promise.allSettled(searchPlan.map(async variant => {
        const searchUrl = new URL(SEARCH_URL);
        searchUrl.searchParams.set("query", variant.query);
        searchUrl.searchParams.set("location", countryCode);
        searchUrl.searchParams.set("language", language);
        return { variant, payload: await tinyfishRequest(searchUrl, { method: "GET" }) };
      }));
      const successfulSearches = searchAttempts.filter(item => item.status === "fulfilled").map(item => item.value);
      const failedSearches = searchAttempts.map((item, index) => item.status === "rejected" ? {
        label: searchPlan[index].label,
        message: item.reason?.message || "Search request failed"
      } : null).filter(Boolean);
      if (!successfulSearches.length) {
        const firstError = searchAttempts.find(item => item.status === "rejected")?.reason;
        throw firstError || new Error("All TinyFish Search variants failed.");
      }
      const MAX_FETCH_PER_BATCH = 5;
      const MAX_FETCH_BATCHES = 3; // initial diverse leads plus at most two link-following passes
      const batchPayloads = [];
      const searchPayloads = successfulSearches.map(item => item.payload);
      const attemptedUrls = new Set();
      let batchUrls = selectInitialSearchResults(searchPayloads, MAX_FETCH_PER_BATCH).map(result => result.url);
      let crawlBatches = 0;
      let linkedUrlsDiscovered = 0;

      // Crawl in bounded batches: initial Search results, then relevant links found on fetched pages.
      // Each batch failure is recorded per URL so other sources can still produce useful results.
      for (let batchIndex = 0; batchIndex < MAX_FETCH_BATCHES && batchUrls.length; batchIndex++) {
        const urls = [...new Set(batchUrls)].filter(Boolean).slice(0, MAX_FETCH_PER_BATCH);
        for (const item of urls) attemptedUrls.add(item);
        let batchPayload;
        try {
          batchPayload = await tinyfishRequest(FETCH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls, format: "markdown", links: true })
          });
        } catch (fetchError) {
          batchPayload = {
            provider: "TinyFish Fetch",
            data: {
              results: [],
              errors: urls.map(item => ({ url: item, error: fetchError.message || "fetch_failed" }))
            }
          };
        }
        batchPayloads.push(batchPayload);
        crawlBatches++;

        if (batchIndex === MAX_FETCH_BATCHES - 1) break;
        const combinedFetchedSoFar = mergeFetchPayloads(...batchPayloads);
        const knownSearch = mergeSearchPayloads(...searchPayloads);
        const knownUrls = [
          ...searchResults(knownSearch).map(item => item.url),
          ...attemptedUrls
        ];
        const followups = discoverFollowupUrls(combinedFetchedSoFar, knownUrls, MAX_FETCH_PER_BATCH);
        if (!followups.length) break;
        linkedUrlsDiscovered += followups.length;
        const previousRows = searchResults(knownSearch);
        const nextPosition = 100 + previousRows.length;
        searchPayloads.push(makeDiscoveredSearchPayload(followups, nextPosition));
        batchUrls = followups.map(item => item.url);
      }

      const combinedSearch = mergeSearchPayloads(...searchPayloads);
      const combinedFetch = mergeFetchPayloads(...batchPayloads);
      const normalized = normalizeSources(combinedSearch, combinedFetch, { role, location: locationText, keywords, seniority, visa });
      normalized.summary.crawlBatches = crawlBatches;
      normalized.summary.linkedUrlsDiscovered = linkedUrlsDiscovered;
      normalized.summary.fetchPageLimit = MAX_FETCH_PER_BATCH * MAX_FETCH_BATCHES;
      normalized.summary.searchBreadth = searchBreadth;
      normalized.summary.searchQueriesAttempted = searchPlan.length;
      normalized.summary.searchQueriesSucceeded = successfulSearches.length;
      normalized.summary.searchQueriesFailed = failedSearches.length;
      normalized.summary.searchVariants = searchPlan.map(variant => ({
        label: variant.label,
        query: variant.query,
        status: successfulSearches.some(item => item.variant.label === variant.label) ? "succeeded" : "failed"
      }));
      normalized.summary.searchErrors = failedSearches;
      normalized.summary.crossSourceDuplicatesMerged = normalized.opportunities.filter(job => (job.duplicateSourceCount || 1) > 1).length;
      normalized.summary.crawlNote = "CareerScout can run one preference search or three targeted Search variants, then follows relevant links for up to three Fetch batches (15 page URLs maximum). Fit categories and application-link labels are evidence-based hints, not guarantees that a vacancy remains open or that a link successfully submits an application.";
      return sendJson(res, 200, { provider: "CareerScout + TinyFish", query, searchBreadth, ...normalized });
    } catch (error) { return safeError(res, error); }
  }

  if (req.method === "GET" && url.pathname === "/api/search") {
    const query = (url.searchParams.get("query") || "").trim();
    const location = (url.searchParams.get("location") || "IN").trim().toUpperCase();
    const language = (url.searchParams.get("language") || "en").trim().toLowerCase();

    if (query.length < 3 || query.length > 400) {
      return sendJson(res, 400, { error: "Enter a search query between 3 and 400 characters." });
    }
    if (!/^[A-Z]{2}$/.test(location) || !/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
      return sendJson(res, 400, { error: "Invalid location or language code." });
    }

    const searchUrl = new URL(SEARCH_URL);
    searchUrl.searchParams.set("query", query);
    searchUrl.searchParams.set("location", location);
    searchUrl.searchParams.set("language", language);

    try {
      const data = await tinyfishRequest(searchUrl, { method: "GET" });
      return sendJson(res, 200, { provider: "TinyFish Search", query, data });
    } catch (error) {
      return safeError(res, error);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/fetch") {
    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      return safeError(res, error);
    }

    const urls = Array.isArray(body.urls) ? body.urls : [];
    if (urls.length < 1 || urls.length > 5) {
      return sendJson(res, 400, { error: "Provide between 1 and 5 URLs." });
    }
    for (const item of urls) {
      let parsed;
      try {
        parsed = new URL(item);
      } catch {
        return sendJson(res, 400, { error: `Invalid URL: ${String(item).slice(0, 120)}` });
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return sendJson(res, 400, { error: "Only HTTP and HTTPS URLs are allowed." });
      }
      if (parsed.username || parsed.password) {
        return sendJson(res, 400, { error: "URLs containing embedded credentials are not allowed." });
      }
      if (!parsed.hostname || parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost") || parsed.hostname.endsWith(".local")) {
        return sendJson(res, 400, { error: "Local or non-public hostnames are not allowed." });
      }
    }

    try {
      const data = await tinyfishRequest(FETCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, format: "markdown", links: true })
      });
      return sendJson(res, 200, { provider: "TinyFish Fetch", data });
    } catch (error) {
      return safeError(res, error);
    }
  }

  return sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  let pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(__dirname, "public", normalized);

  if (!filePath.startsWith(join(__dirname, "public"))) {
    return sendJson(res, 403, { error: "Forbidden." });
  }

  try {
    const contents = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store"
    });
    res.end(req.method === "HEAD" ? undefined : contents);
  } catch {
    sendJson(res, 404, { error: "Page not found." });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    safeError(res, error);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`CareerScout Step 9.1 running at http://127.0.0.1:${PORT}`);
  console.log(`TinyFish API key configured: ${Boolean(API_KEY)}`);
  if (!API_KEY) console.log("Next: copy .env.example to .env and set TINYFISH_API_KEY.");
});
