const JOB_WORDS = /\b(intern(ship)?|graduate|new grad|early career|software engineer|developer|research engineer|data scientist|machine learning|quant(itative)?|analyst|summer associate|co-op|cooperative education|product manager|portfolio manager|manager|designer|scientist)\b/i;
const AGGREGATOR_HOSTS = /(^|\.)(linkedin\.com|indeed\.com|glassdoor\.(com|co\.in)|naukri\.com|internshala\.com|foundit\.in|instahyre\.com|unstop\.com)$/i;
const SOCIAL_HOSTS = /(^|\.)(facebook\.com|instagram\.com|youtube\.com|twitter\.com|x\.com|tiktok\.com|pinterest\.com)$/i;
const ASSET_PATH = /\.(?:png|jpe?g|gif|webp|svg|css|js|woff2?|ttf|ico|pdf)(?:$|\?)/i;
const JOB_PATH = /\/(?:jobs?\/(?:view\/|\d{4,}(?:\/|$)|[^/?#]{3,}|)|job-details?\/|jobdetail(?:s)?\/|job-openings?\/|job\/|positions?\/|requisitions?\/|vacancies\/|careers?\/job\/|job-results?\/\d+|opportunities\/[^/?#]+|internships?\/[^/?#]+)(?:[/?#]|$)/i;
const JOB_ID_PARAM = /(?:[?&](?:jobid|job_id|gh_jid|jk|reqid|requisitionid|jobpostingid|jobpostid|positionid|currentjobid)=|\/jobs?\/view\/\d+)/i;
const SPECIFIC_JOB_PATH = /\/jobs?\/(?:view\/\d{3,}|\d{4,}(?:\/|$)|[^/]+[-_]\d{4,}(?:\/|$))|\/viewjob(?:\.|\/|$)|\/job\/[^/]+\/(?:\d{3,}|apply)(?:\/|$)/i;
const SPECIFIC_JOB_TEXT = /\b(job description|responsibilities|what you(?:'|’)ll do|minimum qualifications|basic qualifications|requisition id|job id|apply for this job|about the role|role overview|what we(?:'|’)re looking for|qualifications)\b/i;
const BOARD_POSTING_TITLE = /(?:\bhiring\s+.{5,}\s+(?:at|in)\s+|\bapply for\s+.{5,}\s+at\s+|\b.{4,}\s+at\s+[A-Z][A-Za-z0-9&.' -]{1,60}(?:\s+[—–|-]\s+LinkedIn(?: Jobs)?)?$)/i;
const GENERIC_BOARD_TITLE = /\b(?:top|\d+[+,]?\s+)?(?:software|quantitative|data science|engineering|internship|intern)\b.{0,45}\b(?:jobs?|open roles|openings|vacancies|positions)\b|\bjobs?\s+in\s+(?:india|united states|uk|canada)\b/i;
const GENERIC_OPENING_TITLE = /^(?:internships?|internship openings?|internship opportunities|internship programs?|internship positions?|internship roles?|early careers?|early career opportunities|student opportunities|graduate opportunities|careers?|jobs?|job openings|job opportunities|open positions|open roles|opportunities|university recruiting|student programs?)(?:\s*(?:\||—|–|-|::)\s*[^|]+)?$/i;
const DATE_PATTERNS = [
  /(?:apply|application|applications|submit).{0,50}?(?:by|before|deadline|closes? on|closing date)\s*[:\-]?\s*((?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(?:\d{1,2}\s+[A-Z][a-z]+\s+\d{4})|(?:[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}))/i,
  /(?:deadline|closing date)\s*[:\-]?\s*((?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(?:\d{1,2}\s+[A-Z][a-z]+\s+\d{4})|(?:[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}))/i
];
const CITY_PATTERNS = [
  /\b(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|New Delhi|Delhi|Gurugram|Gurgaon|Chennai|Noida|Jaipur|Pilani|Kolkata|Ahmedabad|Seattle|San Francisco|New York|Austin|Boston|London|Toronto|Singapore|Vancouver|Dublin|Berlin|Paris|Tokyo|Sydney)\b/i,
  /\b(Remote|Hybrid|On[- ]site|Work from home|Anywhere in India|India|United States|USA|United Kingdom|Canada|Australia)\b/i
];

export function asArray(value) { return Array.isArray(value) ? value : []; }

/** Build a transparent one-query or three-query search plan. Expanded mode is opt-in
 * because each variant can consume an additional TinyFish Search request. */
export function buildSearchQueries({ role, location, keywords = "", seniority = "", visa = "No preference", searchBreadth = "standard" } = {}) {
  const roleText = clean(role) || "software engineering internship";
  const locationText = clean(location) || "India";
  const keywordText = clean(keywords);
  const levelText = clean(seniority);
  const visaText = visa && !/^no preference$/i.test(visa) ? clean(visa) : "";
  const primary = [roleText, keywordText, locationText, levelText, visaText, "official careers internship jobs application"]
    .filter(Boolean).join(" ").slice(0, 400);
  const plans = [{ label: "Preference search", query: primary }];
  if (searchBreadth === "expanded") {
    const specific = [`"${roleText.replace(/["\\]/g, "").slice(0, 100)}"`, locationText, levelText, keywordText, visaText,
      "individual job posting responsibilities qualifications apply"]
      .filter(Boolean).join(" ").slice(0, 400);
    const employers = [roleText, locationText, levelText, keywordText, visaText,
      "employer careers application boards.greenhouse.io jobs.lever.co jobs.ashbyhq.com myworkdayjobs.com smartrecruiters.com"]
      .filter(Boolean).join(" ").slice(0, 400);
    plans.push({ label: "Specific-posting search", query: specific });
    plans.push({ label: "Employer and ATS search", query: employers });
  }
  const seen = new Set();
  return plans.filter(item => {
    const key = normal(item.query);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Round-robin search variants and prefer distinct hosts for the small first Fetch batch. */
export function selectInitialSearchResults(searchPayloads, limit = 5) {
  const lists = searchPayloads.map(searchResults);
  const maxLength = Math.max(0, ...lists.map(list => list.length));
  const ordered = [];
  const seenUrls = new Set();
  for (let rank = 0; rank < maxLength; rank++) {
    for (const list of lists) {
      const row = list[rank];
      if (!row) continue;
      const key = canonicalUrl(row.url);
      if (!key || seenUrls.has(key)) continue;
      seenUrls.add(key);
      ordered.push(row);
    }
  }
  const chosen = [];
  const usedHosts = new Set();
  for (const row of ordered) {
    const host = hostname(row.url);
    if (usedHosts.has(host)) continue;
    chosen.push(row);
    usedHosts.add(host);
    if (chosen.length >= Math.max(0, limit)) return chosen;
  }
  if (chosen.length < limit) {
    for (const row of ordered) {
      if (chosen.some(item => canonicalUrl(item.url) === canonicalUrl(row.url))) continue;
      chosen.push(row);
      if (chosen.length >= limit) break;
    }
  }
  return chosen;
}

export function searchResults(payload) {
  const data = payload?.data ?? payload;
  return asArray(data?.results).map((r, i) => ({
    position: Number.isFinite(r?.position) ? r.position : i + 1,
    title: clean(r?.title) || "Untitled search result",
    url: safeHttpUrl(r?.url),
    siteName: clean(r?.site_name),
    snippet: clean(r?.snippet),
    discoveredFrom: safeHttpUrl(r?.discovered_from),
    provider: clean(payload?.provider) || "TinyFish Search"
  })).filter(r => r.url);
}

export function fetchResults(payload) {
  const data = payload?.data ?? payload;
  return asArray(data?.results).map(r => {
    const text = cleanMultiline(r?.text);
    const linkDetails = normalizeLinkDetails(r?.links, text, r?.link_details ?? r?.linkDetails);
    return {
      url: safeHttpUrl(r?.url),
      finalUrl: safeHttpUrl(r?.final_url) || safeHttpUrl(r?.url),
      title: clean(r?.title),
      description: clean(r?.description),
      text,
      links: linkDetails.map(item => item.url),
      linkDetails,
      language: clean(r?.language),
      error: null
    };
  }).filter(r => r.url);
}

export function fetchErrors(payload) {
  return asArray(payload?.data?.errors ?? payload?.errors).map(e => ({
    url: safeHttpUrl(e?.url),
    error: clean(e?.error) || "fetch_failed"
  })).filter(e => e.url);
}

/**
 * Select a bounded set of live links worth inspecting in the next Fetch batch.
 * TinyFish commonly returns the links field as URL strings. When anchor metadata
 * or Markdown links are present, their labels are retained as additional evidence.
 */
export function discoverFollowupUrls(fetchPayload, alreadyKnownUrls = [], limit = 5) {
  const known = new Set(alreadyKnownUrls.map(canonicalUrl).filter(Boolean));
  for (const page of fetchResults(fetchPayload)) {
    known.add(canonicalUrl(page.url));
    known.add(canonicalUrl(page.finalUrl));
  }
  const candidates = new Map();
  for (const page of fetchResults(fetchPayload)) {
    for (const link of page.links) {
      const key = canonicalUrl(link);
      if (!key || known.has(key) || key === canonicalUrl(page.finalUrl) || ASSET_PATH.test(link)) continue;
      const score = followupScore(link, page.finalUrl || page.url);
      if (score < 4) continue;
      const prior = candidates.get(key);
      if (!prior || score > prior.score) candidates.set(key, {
        url: link,
        parentUrl: page.finalUrl || page.url,
        score,
        title: titleFromUrl(link)
      });
    }
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, Math.max(0, limit));
}

export function makeDiscoveredSearchPayload(candidates, startingPosition = 100) {
  return {
    provider: "CareerScout link discovery",
    data: { results: candidates.map((candidate, index) => ({
      position: startingPosition + index,
      site_name: hostname(candidate.url),
      title: candidate.title || titleFromUrl(candidate.url) || "Discovered career link",
      url: candidate.url,
      snippet: "Discovered by following a relevant link from a fetched live source. The page must be inspected before treating it as an opening.",
      discovered_from: candidate.parentUrl
    })) }
  };
}

export function mergeSearchPayloads(...payloads) {
  const rows = payloads.flatMap(payload => searchResults(payload));
  const seen = new Set();
  const results = [];
  for (const row of rows) {
    const key = canonicalUrl(row.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    results.push({
      position: row.position,
      site_name: row.siteName,
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      discovered_from: row.discoveredFrom || undefined
    });
  }
  return { provider: "CareerScout merged live discovery", data: { results } };
}

export function mergeFetchPayloads(...payloads) {
  const results = [];
  const errors = [];
  const seenResults = new Set();
  const errorByUrl = new Map();
  for (const payload of payloads) {
    for (const row of fetchResults(payload)) {
      const finalKey = canonicalUrl(row.finalUrl || row.url);
      const originalKey = canonicalUrl(row.url);
      const key = finalKey || originalKey;
      if (key && !seenResults.has(key)) {
        seenResults.add(key);
        if (originalKey) seenResults.add(originalKey);
        results.push({
          url: row.url,
          final_url: row.finalUrl,
          title: row.title,
          description: row.description,
          text: row.text,
          links: row.links,
          link_details: row.linkDetails,
          language: row.language
        });
      }
    }
    for (const row of fetchErrors(payload)) {
      const key = canonicalUrl(row.url);
      if (key && !errorByUrl.has(key)) errorByUrl.set(key, row.error);
    }
  }
  for (const [key, error] of errorByUrl) {
    if (!seenResults.has(key)) errors.push({ url: key, error });
  }
  return { provider: "TinyFish Fetch (merged batches)", data: { results, errors } };
}

export function normalizeSources(searchPayload, fetchPayload, preferences = {}) {
  const search = searchResults(searchPayload);
  const fetched = fetchResults(fetchPayload);
  const errors = fetchErrors(fetchPayload);
  const byUrl = new Map();
  for (const page of fetched) {
    const key = canonicalUrl(page.finalUrl || page.url);
    if (key) byUrl.set(key, page);
    const originalKey = canonicalUrl(page.url);
    if (originalKey) byUrl.set(originalKey, page);
  }
  const errorByUrl = new Map(errors.map(e => [canonicalUrl(e.url), e.error]));
  const opportunities = [];
  const sources = [];
  let linkedPages = 0;

  for (const result of search) {
    const page = byUrl.get(canonicalUrl(result.url));
    const fetchError = errorByUrl.get(canonicalUrl(result.url));
    const text = page?.text || "";
    const title = usableTitle(page?.title, result.title, result.url);
    const host = hostname(page?.finalUrl || result.url);
    const companyEvidence = inferCompanyEvidence(host, title, result.siteName, result.snippet, text);
    const company = companyEvidence.value;
    const sourceType = classifySource(result.url, title, text, page, result.snippet);
    const applicationLink = inferApplicationLink(page, result.url, sourceType);
    const deadline = inferDeadline(text);
    const eligibility = inferEligibility(text);
    // Keep location provenance explicit. Aggregator feeds can contain dozens of
    // unrelated cities, so only their title is used for location inference.
    const locationSources = [{ label: page?.title ? "Fetched page title" : "Search result title", text: title }];
    if (result.snippet) locationSources.push({ label: "Search result snippet", text: result.snippet });
    if (page && sourceType !== "job_board_or_aggregator") locationSources.push({ label: "Fetched page text", text });
    const locationInfo = inferLocationEvidence(locationSources, preferences.location);
    const location = locationInfo.value;
    const evidence = makeEvidence(result, page, sourceType, fetchError);
    const isSpecificJob = sourceType === "individual_job";
    const match = scoreMatch({ title, snippet: result.snippet, text, location, company }, preferences);
    const fitAssessment = assessPreferenceFit({ title, snippet: result.snippet, text, location }, preferences, match);
    const availabilitySignal = inferAvailabilitySignal(text);
    const fieldEvidence = makeFieldEvidence({ result, page, title, company, companyEvidence, locationInfo, eligibility, match, fitAssessment, applicationLink });
    if (result.discoveredFrom) linkedPages++;
    const record = {
      id: stableId(`${title}|${result.url}`),
      title,
      company,
      location,
      roleType: inferRoleType(`${title}\n${result.snippet}\n${text}`),
      eligibility,
      deadline,
      applicationUrl: applicationLink?.url || null,
      applicationLinkKind: applicationLink?.kind || "not_found",
      applicationLinkLabel: applicationLink?.label || null,
      applicationLinkNote: applicationLink?.note || null,
      applicationLinkBasis: applicationLink?.basis || null,
      fitAssessment,
      fieldEvidence,
      sourceUrl: page?.finalUrl || result.url,
      sourceName: result.siteName || host,
      sourceType,
      verificationStatus: fetchError ? "fetch_failed" : page ? (isSpecificJob ? "page_checked_opening_candidate" : "page_checked_source_only") : "search_result_unverified",
      confidence: fetchError ? "low" : page ? (isSpecificJob ? "medium" : "low") : "low",
      availabilitySignal,
      discoveredFrom: result.discoveredFrom || null,
      evidence,
      matchScore: match.score,
      matchReasons: match.reasons,
      _searchPosition: result.position
    };
    if (isSpecificJob) opportunities.push(record);
    else sources.push({
      id: record.id,
      title: record.title,
      company: record.company,
      location: record.location,
      url: record.sourceUrl,
      sourceName: record.sourceName,
      sourceType: record.sourceType,
      status: record.verificationStatus,
      error: fetchError || null,
      summary: page?.description || result.snippet || "No summary available.",
      applicationUrl: applicationLink?.url || null,
      applicationLinkKind: applicationLink?.kind || "not_found",
      applicationLinkLabel: applicationLink?.label || null,
      applicationLinkNote: applicationLink?.note || null,
      applicationLinkBasis: applicationLink?.basis || null,
      fitAssessment,
      fieldEvidence,
      discoveredFrom: result.discoveredFrom || null,
      relevantLinks: (page?.links || []).filter(link => isCareerRelatedUrl(link)).slice(0, 8),
      evidence: record.evidence,
      matchScore: match.score,
      matchReasons: match.reasons
    });
  }

  const uniqueJobs = dedupe(opportunities);
  const uniqueSources = dedupeSources(sources);
  uniqueJobs.sort((a, b) => b.matchScore - a.matchScore || a._searchPosition - b._searchPosition);
  uniqueSources.sort((a, b) => b.matchScore - a.matchScore);
  for (const job of uniqueJobs) delete job._searchPosition;

  return {
    preferences,
    summary: {
      searchResults: search.length,
      pagesFetched: fetched.length,
      fetchFailures: errors.length,
      individualJobCandidates: uniqueJobs.length,
      sourcePages: uniqueSources.length,
      linkedPagesInspected: linkedPages,
      possibleClosedSignals: uniqueJobs.filter(job => job.availabilitySignal === "closed_signal_detected").length,
      strongMatches: uniqueJobs.filter(job => job.fitAssessment?.category === "strong_match").length,
      potentialMatches: uniqueJobs.filter(job => job.fitAssessment?.category === "potential_match").length,
      needsReview: uniqueJobs.filter(job => job.fitAssessment?.category === "review_seniority").length,
      preferenceMismatches: uniqueJobs.filter(job => job.fitAssessment?.category === "preference_mismatch").length,
      lowMatches: uniqueJobs.filter(job => job.fitAssessment?.category === "low_match").length,
      withDirectApplyLinks: uniqueJobs.filter(job => job.applicationLinkKind === "direct_apply_link").length,
      withSpecificRolePages: uniqueJobs.filter(job => job.applicationLinkKind === "specific_role_page").length,
      withRolePageOnly: uniqueJobs.filter(job => job.applicationLinkKind === "role_page_fallback").length,
      note: "A candidate is not a guarantee that the vacancy is still open. Confirm details on the employer's application page. Missing fields are intentionally left blank. Relevance scores are heuristic, not a guarantee of fit."
    },
    opportunities: uniqueJobs,
    sources: uniqueSources,
    errors
  };
}

function normalizeLinkDetails(rawLinks, text = "", existingDetails = []) {
  const items = [];
  const byUrl = new Map();
  const add = (rawUrl, rawLabel = "", origin = "TinyFish links array") => {
    const url = safeHttpUrl(rawUrl);
    if (!url) return;
    const key = canonicalUrl(url);
    if (!key) return;
    const label = clean(rawLabel).replace(/^[-•*]+\s*/, "").slice(0, 120);
    if (byUrl.has(key)) {
      const prior = byUrl.get(key);
      if (!prior.label && label) prior.label = label;
      if (prior.origin === "TinyFish links array" && origin !== "TinyFish links array") prior.origin = origin;
      return;
    }
    if (items.length >= 60) return;
    const row = { url, label, origin };
    byUrl.set(key, row);
    items.push(row);
  };
  for (const raw of [...asArray(rawLinks), ...asArray(existingDetails)]) {
    if (typeof raw === "string") add(raw);
    else if (raw && typeof raw === "object") {
      add(raw.url || raw.href || raw.uri, raw.label || raw.text || raw.anchor_text || raw.anchorText || raw.name || raw.title || "", "structured link metadata");
    }
  }
  const markdownLink = /\[([^\]]{1,120})\]\((https?:\/\/[^)\s]+)\)/gi;
  let match;
  while ((match = markdownLink.exec(String(text || ""))) !== null) add(match[2].replace(/[.,;!?]+$/, ""), match[1], "Markdown link in fetched text");
  const rawUrlRegex = /https?:\/\/[^\s<>"'`\])]+/gi;
  while ((match = rawUrlRegex.exec(String(text || ""))) !== null) {
    const url = match[0].replace(/[.,;!?]+$/, "");
    const prefix = String(text || "").slice(Math.max(0, match.index - 100), match.index);
    const labelMatch = prefix.match(/(?:apply(?:\s+now|\s+here|\s+for (?:this|the) job)?|submit application|start application)\s*[:—–>-]*\s*$/i);
    add(url, labelMatch?.[0]?.trim().replace(/[:—–>-]+$/, "") || "", "URL extracted from fetched text");
  }
  return items;
}

function followupScore(value, parentUrl) {
  let u;
  try { u = new URL(value); } catch { return -100; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!/^https?:$/.test(u.protocol) || SOCIAL_HOSTS.test(host) || ASSET_PATH.test(u.href)) return -100;
  if (/^(mailto|tel):/i.test(value)) return -100;
  const full = `${host}${u.pathname}${u.search}`.toLowerCase();
  const path = u.pathname.toLowerCase();
  let score = 0;
  if (hasSpecificJobUrl(value)) score += 8;
  else if (JOB_PATH.test(path)) score += 2;
  if (JOB_ID_PARAM.test(u.href) && !hasSpecificJobUrl(value)) score += 5;
  if (isAtsSpecificRoleUrl(value)) score += 8;
  if (/\b(apply|application|job|jobs|career|careers|intern|internship|position|requisition|opening|vacanc|opportunit)\b/i.test(full)) score += 3;
  if (/[?&](?:seniority|level|role|team|category)=?(?:intern|student|early|graduate)/i.test(u.search)) score += 2;
  if (/(^|\/)careers?\/?$|(^|\/)jobs?\/?$|(^|\/)internships?\/?$|(^|\/)search\/?$/i.test(path) && !/[?&](?:seniority|level|role|team|category)=?(?:intern|student|early|graduate)/i.test(u.search)) score -= 2;
  if (canonicalUrl(value) === canonicalUrl(parentUrl)) return -100;
  return score;
}

function classifySource(url, title, text, page, snippet = "") {
  const host = hostname(url);
  let path = "";
  try { path = new URL(url).pathname.toLowerCase(); } catch {}
  const titleText = clean(title);
  const hasRoleTitle = JOB_WORDS.test(titleText) && titleText.length < 180;
  const genericTitle = isGenericOpeningTitle(titleText);
  const specificRoleTitle = hasRoleTitle && !genericTitle && !GENERIC_BOARD_TITLE.test(titleText);
  const genericPath = /\/(?:internships?|jobs?|careers?|search|job-search|job-listings?|open-positions)\/?$/i.test(path);
  // Distinguish true posting identifiers from a broad /jobs/<keyword> search slug.
  const looksPostingUrl = hasSpecificJobUrl(url) || JOB_ID_PARAM.test(url) || isAtsSpecificRoleUrl(url);
  const contentSignals = SPECIFIC_JOB_TEXT.test(text) || /\b(requisition\s*(?:id|number)|job\s*(?:id|number))\s*[:#-]/i.test(text);
  const boardHost = AGGREGATOR_HOSTS.test(host);
  const genericBoard = GENERIC_BOARD_TITLE.test(titleText) || /today(?:'|’)s top \d+|new .* jobs added daily|browse hundreds of openings|open roles\)/i.test(`${titleText} ${snippet}`);
  const titleHasEmployerMarker = (/\bhiring\b/i.test(titleText) && /\b(?:at|in)\s+[A-Z]/.test(titleText))
    || /\b(?:intern|analyst|scientist|engineer|developer|researcher|associate|designer|manager)\b.*\bat\s+[A-Z][A-Za-z0-9&.' -]{1,60}(?:\s*[—–-]\s*[^|]{2,60})?(?:\s*\|\s*LinkedIn(?: Jobs)?)?$/i.test(titleText);
  const titleLooksSpecific = (BOARD_POSTING_TITLE.test(titleText) || titleHasEmployerMarker || specificRoleTitle) && !genericBoard && !genericTitle && specificRoleTitle;
  const postingBodySignals = /\b(?:posted\s+(?:\d|today|yesterday)|apply for .{4,} at .{2,}|job title:|responsibilities|qualifications|day-to-day responsibilities|internship role|full-time internship role)\b/i.test(text);
  const contentLooksSpecific = specificRoleTitle && (contentSignals || postingBodySignals) && !genericBoard;

  // Individual-opening classification requires a specific role title plus page
  // evidence. A generic program/openings title is never upgraded solely because
  // its body contains generic headings such as “Responsibilities” or “Qualifications”.
  if (page && looksPostingUrl && titleLooksSpecific && (contentSignals || postingBodySignals) && !genericBoard) return "individual_job";
  if (page && boardHost && titleLooksSpecific && (contentSignals || postingBodySignals)) return "individual_job";
  if (page && !boardHost && titleLooksSpecific && contentSignals && !genericPath) return "individual_job";
  if (boardHost) return "job_board_or_aggregator";
  if (page && contentLooksSpecific && !genericPath) return "individual_job";
  if (/\b(internship|internships|careers|early career|open positions|search open jobs|talent community)\b/i.test(`${title}\n${text.slice(0, 1800)}`)) return "careers_or_program_page";
  return "general_source_page";
}

function isGenericOpeningTitle(title) {
  const value = clean(title);
  const segments = value.split(/\s*(?:\||—|–|::)\s*/);
  const core = clean(segments[0] || value);
  const roleProgramOrOpeningsTitle = /\b(?:internship|intern)\s+(?:program|programme|openings?|opportunities|positions|roles)\b/i.test(core);
  return GENERIC_OPENING_TITLE.test(core) || GENERIC_OPENING_TITLE.test(value) || roleProgramOrOpeningsTitle
    || /^(?:internships?|internship openings?|careers?|jobs?|open positions|open roles)\s+(?:at|for)\s+.+$/i.test(value);
}

function hasSpecificJobUrl(value) {
  let u;
  try { u = new URL(value); } catch { return false; }
  const path = decodeURIComponent(u.pathname).toLowerCase();
  // Canonical social-board listing IDs and explicit numeric requisition routes.
  if (/\/jobs?\/view\/\d{5,}(?:\/|$)/i.test(path)) return true;
  if (/\/jobs?\/\d{4,}(?:\/|$)/i.test(path)) return true;
  if (/\/jobs?\/[^/]{3,}[-_]\d{4,}(?:\/|$)/i.test(path)) return true;
  if (/\/(?:job|position|requisition|vacancy)\/[^/]{2,}\/(?:r?\d{3,}|[a-f0-9-]{16,})(?:\/|$)/i.test(path)) return true;
  if (/\/(?:careers?|opportunities)\/[^/]{4,}[-_]\d{4,}(?:\/|$)/i.test(path)) return true;
  // Greenhouse commonly uses /<tenant>/jobs/<numeric-id>; Lever/Ashby use UUIDs.
  if (/(?:^|\.)greenhouse\.io$/i.test(u.hostname) && /\/jobs\/\d{4,}(?:\/|$)/i.test(path)) return true;
  if (/(?:^|\.)lever\.co$/i.test(u.hostname) && /\/[^/]+\/[a-f0-9-]{20,}(?:\/|$)/i.test(path)) return true;
  if (/(?:^|\.)ashbyhq\.com$/i.test(u.hostname) && /\/[^/]+\/[a-f0-9-]{20,}(?:\/|$)/i.test(path)) return true;
  if (/(?:^|\.)myworkdayjobs\.com$/i.test(u.hostname) && /\/job\/[^/]+\/[^/]+_r[0-9a-z-]+(?:\/|$)/i.test(path)) return true;
  return JOB_ID_PARAM.test(u.href);
}

function inferApplicationLink(page, sourceUrl, sourceType) {
  if (!page) return null;
  const sourcePageUrl = safeHttpUrl(page.finalUrl || sourceUrl);
  if (!sourcePageUrl) return null;
  const source = canonicalUrl(sourcePageUrl);
  const details = page.linkDetails?.length
    ? page.linkDetails
    : (page.links || []).map(url => ({ url, label: "", origin: "TinyFish links array" }));
  const mergedDetails = normalizeLinkDetails(details, page.text || "");
  const scored = mergedDetails.map(item => ({
    link: safeHttpUrl(item.url),
    labelText: clean(item.label),
    score: scoreApplicationLink(item.url, source, sourceType, item.label),
    kind: classifyApplicationLinkKind(item.url, item.label),
    origin: item.origin || "TinyFish links array"
  })).filter(item => item.link && item.score > 0)
    .sort((a, b) => b.score - a.score);

  const acceptable = scored.find(item => item.score >= 2 && item.kind !== "unrelated_link");
  if (acceptable && (acceptable.score >= 5 || sourceType !== "individual_job")) {
    const basis = acceptable.kind === "direct_apply_link"
      ? (acceptable.labelText ? `Link labelled “${acceptable.labelText.slice(0, 80)}” in fetched source` : "URL contains an explicit apply/application route signal")
      : acceptable.kind === "specific_role_page"
        ? (isAtsSpecificRoleUrl(acceptable.link) ? "Specific external employer/ATS role URL" : "Specific role-like URL")
        : acceptable.kind === "filtered_careers_search"
          ? "Careers URL contains role/level filter parameters"
          : "Related careers URL found on fetched page";
    return {
      url: acceptable.link,
      kind: acceptable.kind,
      label: applicationLinkLabel(acceptable.kind),
      basis,
      note: acceptable.kind === "direct_apply_link"
        ? `${basis}. The destination was not click-tested; confirm the role and destination before submitting personal information.`
        : acceptable.kind === "specific_role_page"
          ? "A specific role page was identified; an explicit application action was not established from the link evidence. Confirm the role status and apply route on that page."
          : acceptable.kind === "filtered_careers_search"
            ? "A careers search link with a role/level filter was found; it may lead to multiple vacancies rather than one confirmed opening."
            : "This is a related careers page, not a verified direct application endpoint."
    };
  }
  if (sourceType === "individual_job") {
    const sourceKind = classifyApplicationLinkKind(sourcePageUrl);
    if (sourceKind === "specific_role_page") {
      return {
        url: sourcePageUrl,
        kind: "specific_role_page",
        label: applicationLinkLabel("specific_role_page"),
        basis: isAtsSpecificRoleUrl(sourcePageUrl) ? "Fetched source URL is a specific employer/ATS role route" : "Fetched source URL is a specific job-posting route",
        note: "The fetched source itself appears to be a specific job page. No separate direct application destination was established from its outgoing links; confirm the application route and vacancy status on that page."
      };
    }
    return {
      url: sourcePageUrl,
      kind: "role_page_fallback",
      label: applicationLinkLabel("role_page_fallback"),
      basis: "Fetched source page URL; no stronger application link evidence found",
      note: "No direct application URL could be established from the fetched links. Open the role page and confirm its current status and application route."
    };
  }
  return null;
}

function classifyApplicationLinkKind(link, label = "") {
  let u;
  try { u = new URL(link); } catch { return "unrelated_link"; }
  if (!safeHttpUrl(link) || SOCIAL_HOSTS.test(u.hostname)) return "unrelated_link";
  const path = u.pathname.toLowerCase();
  const full = `${u.hostname}${u.pathname}${u.search}`.toLowerCase();
  const applyLabel = /^(?:apply(?: now| here| for (?:this|the) job)?|submit application|start application|apply to this job|begin application)$/i.test(clean(label));
  const explicitApply = /(?:^|\/)(?:apply|application|jobapply|submit-application)(?:\/|$)/i.test(path)
    || /[?&](?:action|mode|step)=apply(?:&|$)/i.test(u.search);
  if (explicitApply || applyLabel) return "direct_apply_link";
  if (hasSpecificJobUrl(link) || isAtsSpecificRoleUrl(link)) return "specific_role_page";
  if (/\/(?:careers?|jobs?|internships?|search)\/?$/i.test(path)
      && /[?&](?:seniority|level|role|team|category|query|keyword)=/i.test(u.search)) return "filtered_careers_search";
  if (/career|jobs?|position|requisition|opening|vacanc|intern|opportunit/i.test(full)) return "careers_page";
  return "unrelated_link";
}

function applicationLinkLabel(kind) {
  const labels = {
    direct_apply_link: "Direct application link",
    specific_role_page: "Specific role page",
    filtered_careers_search: "Filtered careers search",
    careers_page: "Related careers page",
    role_page_fallback: "Role page (direct apply link not found)"
  };
  return labels[kind] || "Open source";
}

function scoreApplicationLink(link, source, sourceType, label = "") {
  let u;
  try { u = new URL(link); } catch { return 0; }
  if (!safeHttpUrl(link) || canonicalUrl(link) === source || SOCIAL_HOSTS.test(u.hostname)) return 0;
  const path = u.pathname.toLowerCase();
  const kind = classifyApplicationLinkKind(link, label);
  if (kind === "unrelated_link") return 0;
  let score = 0;
  if (kind === "direct_apply_link") score += 10;
  if (kind === "specific_role_page") score += 8;
  if (kind === "filtered_careers_search") score += 4;
  if (kind === "careers_page") score += 2;
  if (isAtsSpecificRoleUrl(link)) score += 2;
  const genericLanding = /\/(?:careers?|jobs?|internships?|search)\/?$/i.test(path);
  const filteredCareerSearch = kind === "filtered_careers_search";
  if (genericLanding && !filteredCareerSearch && kind !== "direct_apply_link") score = Math.min(score, 1);
  if (sourceType === "individual_job" && score > 0) score += 1;
  return score;
}

function isAtsHost(hostnameValue) {
  const host = String(hostnameValue || "").toLowerCase().replace(/^www\./, "");
  const domains = [
    "greenhouse.io", "greenhouse.com", "lever.co", "ashbyhq.com", "myworkdayjobs.com",
    "smartrecruiters.com", "jobvite.com", "icims.com", "workable.com", "oraclecloud.com",
    "successfactors.com", "successfactors.eu", "taleo.net", "clearcompany.com", "bamboohr.com",
    "recruitee.com", "teamtailor.com", "dayforcehcm.com"
  ];
  return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

function isAtsSpecificRoleUrl(value) {
  let u;
  try { u = new URL(value); } catch { return false; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!isAtsHost(host)) return false;
  return hasSpecificJobUrl(value);
}

function assessPreferenceFit(record, prefs, match) {
  const requestedLevel = clean(prefs.seniority).toLowerCase();
  const title = clean(record.title);
  const blob = `${title}\n${record.snippet || ""}\n${record.text || ""}`;
  const titleHasInternship = /\b(intern(ship)?|co-?op|student placement)\b/i.test(title);
  const bodyHasInternship = /\b(intern(ship)?|co-?op|student placement)\b/i.test(`${record.snippet || ""} ${record.text || ""}`);
  const explicitSenior = /\b(portfolio manager|senior|mid[- ]senior|director|head of|principal|staff engineer|lead researcher|vice president|vp|chief|manager)\b/i.test(title);
  let seniority = "not_requested";
  if (["intern", "internship"].includes(requestedLevel)) {
    seniority = titleHasInternship ? "confirmed_in_title" : explicitSenior ? "mismatch" : bodyHasInternship ? "context_only" : "unconfirmed";
  } else if (requestedLevel && requestedLevel !== "any") {
    seniority = new RegExp(`\\b${escapeRegExp(requestedLevel)}\\b`, "i").test(blob) ? "mentioned_in_source" : "unconfirmed";
  }
  const preferred = clean(prefs.location).toLowerCase();
  const actual = clean(record.location).toLowerCase();
  const locationMismatch = match.reasons.some(reason => /^Location mismatch:/i.test(reason));
  const location = !preferred ? "not_requested" : locationMismatch ? "mismatch" : actual ? "matched_or_compatible" : "unconfirmed";
  const roleTitleHit = match.reasons.some(reason => /^Role terms in title:/i.test(reason));
  const roleContextHit = match.reasons.some(reason => /^Role terms found only in page context:/i.test(reason));
  const role = roleTitleHit ? "title_match" : roleContextHit ? "context_match" : "weak_or_missing";
  const preferenceMismatch = seniority === "mismatch" || location === "mismatch";
  let category;
  let label;
  if (preferenceMismatch) {
    category = "preference_mismatch";
    label = seniority === "mismatch" ? "Seniority mismatch" : "Location mismatch";
  } else if (role === "weak_or_missing") {
    category = "low_match";
    label = "Role match is weak";
  } else if (["intern", "internship"].includes(requestedLevel) && !titleHasInternship) {
    category = "review_seniority";
    label = seniority === "context_only" ? "Internship mentioned in page, not title" : "Internship level unconfirmed";
  } else if (match.score >= 70) {
    category = "strong_match";
    label = "Strong match";
  } else if (match.score >= 45) {
    category = "potential_match";
    label = "Potential match";
  } else {
    category = "low_match";
    label = "Low match";
  }
  const reasons = [];
  if (seniority === "mismatch") reasons.push("Title indicates a senior/managerial role rather than an internship.");
  else if (seniority === "context_only") reasons.push("Internship evidence appears in the page body, not the title.");
  else if (seniority === "unconfirmed" && ["intern", "internship"].includes(requestedLevel)) reasons.push("The title does not establish an internship level.");
  if (location === "mismatch") reasons.push("Explicit work location conflicts with the selected location.");
  else if (location === "unconfirmed") reasons.push("Work location was not established in the inspected evidence.");
  if (role === "context_match") reasons.push("Requested role terms appear in page context rather than the title.");
  if (role === "weak_or_missing") reasons.push("Requested role terms were not established.");
  return { category, label, role, seniority, location, reasons };
}

function inferDeadline(text) {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function inferEligibility(text) {
  // Keep actual requirement statements, not section headings or whole paragraphs.
  // TinyFish markdown can leave headings wrapped in ** / ## markers.
  const headingOnly = /^(?:eligibility|eligible candidates|minimum qualifications|required qualifications|qualifications|required qualifications and skills|requirements|candidate requirements|what you(?:'|’)ll need|what we(?:'|’)re looking for|who you are|required skills|basic qualifications|preferred qualifications|education|work authorization|visa sponsorship|must have)\s*[:.\-]*$/i;
  const eligibilitySignal = /\b(eligible candidates|must be enrolled|currently enrolled|currently pursuing|bachelor(?:'s|’s)? degree|master(?:'s|’s)? degree|undergraduate student|graduate student|work authorization|visa sponsorship|right to work|must have|you must be|applicants must|students pursuing|degree in|years of relevant experience|minimum of \d+|at least \d+|pursuing a degree|enrolled in a degree|graduating in|expected graduation|citizenship|security clearance|eligible to work)\b/i;
  const lines = String(text || "").split(/\n+/).map(raw => raw
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/^\s*[-*•]+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/[`_~]/g, "")
    .replace(/\s+/g, " ").trim()).filter(Boolean);
  const candidates = [];
  for (let line of lines) {
    // Strip a heading prefix if the actual requirement follows it on the same line.
    line = line.replace(/^(?:eligibility|minimum qualifications|required qualifications|basic qualifications|qualifications required|requirements)\s*[:\-]\s*/i, "").trim();
    if (!line || headingOnly.test(line) || line.length < 20 || line.length > 320) continue;
    if (!eligibilitySignal.test(line)) continue;
    // Reject labels ending in punctuation and other heading-shaped fragments.
    if (/^(?:eligibility|qualifications|required qualifications|requirements|education)\s*[:.\-]*$/i.test(line)) continue;
    candidates.push(line);
  }
  const unique = [...new Set(candidates)];
  return unique.slice(0, 4).join(" ").slice(0, 600) || null;
}

function inferLocation(text, preferred) {
  return inferLocationEvidence([{ label: "Inspected text", text }], preferred).value;
}

function inferLocationEvidence(sources, preferred) {
  // Prefer the page title and search snippet to incidental location mentions in
  // long descriptions. Generic board feeds are passed title-only by the caller.
  for (const source of sources) {
    const value = String(source.text || "");
    for (const pattern of CITY_PATTERNS) {
      const match = value.match(pattern);
      if (match?.[1]) return { value: match[1], source: source.label, excerpt: evidenceLine(value, match[1]) };
    }
  }
  const pref = clean(preferred);
  if (pref) {
    for (const source of sources) {
      if (new RegExp(`\\b${escapeRegExp(pref)}\\b`, "i").test(source.text || "")) {
        return { value: pref, source: source.label, excerpt: evidenceLine(source.text, pref) };
      }
    }
  }
  return { value: null, source: "not established", excerpt: null };
}

function makeFieldEvidence({ result, page, title, company, companyEvidence, locationInfo, eligibility, match, fitAssessment, applicationLink }) {
  const fetchedTitleIsUsable = Boolean(page?.title && usableTitle(page.title, result.title, result.url) === title);
  const seniority = fitAssessment?.seniority || "unconfirmed";
  const titleHasInternship = /\b(intern(ship)?|co-?op|student placement)\b/i.test(title);
  const senioritySource = titleHasInternship || seniority === "mismatch"
    ? (fetchedTitleIsUsable ? "Fetched page title" : "Search result title")
    : /\b(intern(ship)?|co-?op|student placement)\b/i.test(result.snippet || "")
      ? "Search result snippet"
      : /\b(intern(ship)?|co-?op|student placement)\b/i.test(page?.text || "") ? "Fetched page text" : "not established";
  let roleSource = "not established";
  let roleExcerpt = null;
  if (match.reasons.some(reason => /^Role terms in title:/i.test(reason))) {
    roleSource = fetchedTitleIsUsable ? "Fetched page title" : "Search result title";
    roleExcerpt = title;
  } else if (match.reasons.some(reason => /^Role terms found only in page context:/i.test(reason))) {
    const snippetHasRole = (result.snippet || "").length > 0 && match.reasons.some(reason => {
      if (!/^Role terms found only in page context:/i.test(reason)) return false;
      const terms = reason.split(":").slice(1).join(":").split(",").map(clean).filter(Boolean);
      return terms.some(term => result.snippet.toLowerCase().includes(term));
    });
    roleSource = snippetHasRole ? "Search result snippet" : "Fetched page text";
    roleExcerpt = snippetHasRole ? result.snippet : evidenceLine(page?.text || "", /quant|research|engineer|developer|data science|scientist|intern/i);
  }
  const seniorityText = senioritySource === "Fetched page title" || senioritySource === "Search result title"
    ? title : senioritySource === "Search result snippet" ? result.snippet : senioritySource === "Fetched page text" ? page?.text : "";
  return {
    title: { value: title, source: fetchedTitleIsUsable ? "Fetched page title" : "Search result title or URL fallback" },
    company: { value: company || null, source: companyEvidence?.source || "not established", excerpt: companyEvidence?.excerpt || null },
    roleMatch: { status: fitAssessment?.role || "unknown", source: roleSource, excerpt: roleExcerpt ? String(roleExcerpt).slice(0, 240) : null },
    location: { value: locationInfo.value || null, source: locationInfo.source, excerpt: locationInfo.excerpt || null },
    seniority: { status: seniority, source: senioritySource, excerpt: seniorityText ? evidenceLine(seniorityText, /intern(ship)?|co-?op|student placement|portfolio manager|senior|manager|director|principal|graduate|entry.level/i) : null },
    eligibility: { source: eligibility ? "Fetched page text" : "not established", excerpt: eligibility || null },
    applicationLink: {
      kind: applicationLink?.kind || "not_found",
      url: applicationLink?.url || null,
      source: applicationLink ? applicationLink.basis : "No qualifying application link found in the fetched page links/text"
    }
  };
}

function evidenceLine(text, patternOrTerm) {
  const lines = String(text || "").split(/\n+/).map(clean).filter(Boolean);
  const regex = patternOrTerm instanceof RegExp ? patternOrTerm : new RegExp(escapeRegExp(String(patternOrTerm)), "i");
  return lines.find(line => regex.test(line))?.slice(0, 240) || (String(text || "").slice(0, 240) || null);
}

function inferRoleType(text) {
  if (/\b(remote|work from home|anywhere)\b/i.test(text)) return "Remote (source-mentioned)";
  if (/\bhybrid\b/i.test(text)) return "Hybrid (source-mentioned)";
  if (/\b(co-op|cooperative education)\b/i.test(text)) return "Co-op";
  if (/\bintern(ship)?\b/i.test(text)) return "Internship (source-mentioned)";
  if (/\bgraduate|new grad|early career\b/i.test(text)) return "Graduate / early career";
  return null;
}

function inferAvailabilitySignal(text) {
  if (!text) return "not_established";
  if (/\b(no longer accepting applications|applications? (?:are )?closed|position (?:has been|is) filled|job (?:has been|is) closed|requisition is no longer available|posting has expired|vacancy closed)\b/i.test(text)) return "closed_signal_detected";
  return "not_established";
}

function inferCompanyEvidence(host, title, siteName = "", snippet = "", text = "") {
  const cleanHost = String(host || "").replace(/^www\./, "").toLowerCase();
  if (AGGREGATOR_HOSTS.test(cleanHost)) {
    const titleCompany = companyFromBoardTitle(title, siteName || cleanHost);
    if (titleCompany) return { value: titleCompany, source: "Employer parsed from job-board title", excerpt: clean(title).slice(0, 240) };
    const boardName = ({ linkedin: "LinkedIn", indeed: "Indeed", glassdoor: "Glassdoor", naukri: "Naukri", internshala: "Internshala", foundit: "Foundit", instahyre: "Instahyre", unstop: "Unstop" })[cleanHost.split(".").slice(-2, -1)[0]];
    if (boardName) return { value: boardName, source: "Job-board hostname; hiring company not established", excerpt: cleanHost };
  }
  const atsHosted = isAtsHost(cleanHost);
  const known = { qualcomm: "Qualcomm", microsoft: "Microsoft", google: "Google", amazon: "Amazon", amazonjobs: "Amazon", apple: "Apple", intuit: "Intuit", cisco: "Cisco", nvidia: "NVIDIA", nvidiajobs: "NVIDIA", adobe: "Adobe", oracle: "Oracle", intel: "Intel", ibm: "IBM", meta: "Meta", uber: "Uber", tesla: "Tesla", samsung: "Samsung", accenture: "Accenture", flipkart: "Flipkart", atlassian: "Atlassian", ubercareers: "Uber", wellsfargo: "Wells Fargo", goldmansachs: "Goldman Sachs", bloomberg: "Bloomberg", jpmorgan: "JPMorgan Chase", broadcom: "Broadcom", arm: "Arm", amd: "AMD", qualtrics: "Qualtrics" };
  // Do not treat a hosting/ATS platform as the hiring company. Known employer
  // domains remain authoritative when the tenant itself belongs to that employer.
  if (!atsHosted) {
    for (const [domain, name] of Object.entries(known)) {
      if (cleanHost === `${domain}.com` || cleanHost.startsWith(`${domain}.`) || cleanHost.endsWith(`.${domain}.com`)) {
        return { value: name, source: "Recognized employer hostname", excerpt: cleanHost };
      }
    }
  }
  const contextualEmployer = companyFromEvidenceText(snippet, "Search result snippet") || companyFromEvidenceText(text, "Fetched page text");
  if (contextualEmployer) return contextualEmployer;
  if (atsHosted) {
    return { value: null, source: "ATS hosting domain only; hiring company not established in title, snippet, or fetched text", excerpt: null };
  }
  const fromTitle = clean(title).match(/\|\s*([^|]+)$/);
  if (fromTitle?.[1] && !isBoardBrand(fromTitle[1]) && !isGenericOpeningTitle(fromTitle[1])) {
    return { value: fromTitle[1].trim(), source: "Employer-like suffix in source title; verify on original page", excerpt: clean(title).slice(0, 240) };
  }
  const parts = cleanHost.split(".");
  const root = parts.length >= 3 && ["co", "com", "org", "gov", "ac"].includes(parts.at(-2)) ? parts.at(-3) : (parts.length >= 2 ? parts.at(-2) : parts[0]);
  const value = root ? root.charAt(0).toUpperCase() + root.slice(1) : null;
  return { value, source: value ? "Inferred from the non-ATS source hostname; verify on original page" : "not established", excerpt: value ? cleanHost : null };
}

function companyFromEvidenceText(text, source) {
  const lines = String(text || "").split(/\n+/).map(clean).filter(Boolean).slice(0, 80);
  const badNames = /^(?:the|this|our|we|software|machine learning|engineering|internship|intern|job|position|role|strong|must|required|qualifications|responsibilities|about|location|apply|looking|join|work|team|company|employer|organization|experience|candidates?)$/i;
  for (const line of lines) {
    const labeled = line.match(/\b(?:hiring company|company|employer|organization)\s*[:—–-]\s*([A-Z][A-Za-z0-9&.'’\-]*(?:\s+[A-Z][A-Za-z0-9&.'’\-]*){0,4})/);
    if (labeled && !badNames.test(labeled[1])) return { value: clean(labeled[1]).replace(/[.,;:]+$/, ""), source, excerpt: line.slice(0, 240) };
    // High-precision sentence pattern: “Glean is the Work AI platform …”. It
    // avoids inferring the ATS vendor from an ATS-hosted URL.
    const declarative = line.match(/\b([A-Z][A-Za-z0-9&.'’\-]*(?:\s+[A-Z][A-Za-z0-9&.'’\-]*){0,2})\s+[Ii]s\s+(?:[Tt]he|[Aa]n?)\b/);
    if (declarative && !badNames.test(declarative[1]) && !/\b(Engineer|Intern|Internship|Researcher|Analyst|Manager|Scientist|Developer|Qualifications|Responsibilities)\b/i.test(declarative[1])) {
      return { value: clean(declarative[1]).replace(/[.,;:]+$/, ""), source, excerpt: line.slice(0, 240) };
    }
    const possessive = line.match(/\b([A-Z][A-Za-z0-9&.'’\-]*(?:\s+[A-Z][A-Za-z0-9&.'’\-]*){0,2})(?:'s|’s)\s+(?:mission|platform|careers|team|company|organization)\b/);
    if (possessive && !badNames.test(possessive[1]) && !/\b(Engineer|Intern|Internship|Researcher|Analyst|Manager|Scientist|Developer)\b/i.test(possessive[1])) {
      return { value: clean(possessive[1]), source, excerpt: line.slice(0, 240) };
    }
  }
  return null;
}

function companyFromBoardTitle(title, siteName) {
  const value = clean(title).replace(/\s*[|–—-]\s*(LinkedIn(?: Jobs)?|Indeed|Glassdoor|Naukri|Internshala|Foundit|Unstop)\s*$/i, "").trim();
  const hiring = value.match(/^(.{2,80}?)\s+hiring\s+.{4,}?(?:\s+at\s+|\s+in\s+).+$/i);
  if (hiring && !isBoardBrand(hiring[1])) return hiring[1].trim();
  const at = value.match(/\bat\s+([A-Z][A-Za-z0-9&.' -]{1,60}?)(?:\s+[—–-]\s+.*)?$/);
  if (at && !isBoardBrand(at[1])) return at[1].trim();
  const parts = value.split(/\s+[|–—-]\s+/).map(clean).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts.at(-1);
    if (!isBoardBrand(last) && !JOB_WORDS.test(last)) return last;
    const first = parts[0];
    if (!isBoardBrand(first) && !JOB_WORDS.test(first)) return first;
  }
  return null;
}
function isBoardBrand(value) { return /^(LinkedIn|Indeed|Glassdoor|Naukri|Internshala|Foundit|Unstop|Instahyre)$/i.test(clean(value)); }

function makeEvidence(result, page, sourceType, error) {
  if (error) return `Fetch failed (${error}); this result is based on search metadata only.`;
  if (!page) return `Search result only: ${result.title}. The page was not fetched, so the opening is unverified.`;
  const signals = [];
  if (hasSpecificJobUrl(result.url)) signals.push("specific job URL pattern");
  if (SPECIFIC_JOB_TEXT.test(page.text)) signals.push("job-description language in fetched text");
  if (result.discoveredFrom) signals.push("found by following a relevant link from another fetched page");
  if (sourceType === "individual_job") return `Fetched page inspected as an individual-opening candidate (${signals.join("; ") || "title/content signals"}). Confirm current availability and eligibility on the application page.`;
  return `Fetched page is classified as ${sourceType.replaceAll("_", " ")}, not a verified individual vacancy.`;
}

function scoreMatch(record, prefs) {
  const titleBlob = clean(record.title).toLowerCase();
  const contextBlob = `${record.snippet || ""} ${record.text || ""}`.toLowerCase();
  const blob = `${titleBlob} ${contextBlob}`;
  let score = 0;
  const reasons = [];
  const role = clean(prefs.role).toLowerCase();
  if (role) {
    const terms = role.split(/\s+/).filter(term => term.length > 2 && !["internship", "internships", "entry", "level"].includes(term));
    const titleHits = terms.filter(term => titleBlob.includes(term));
    const contextOnlyHits = terms.filter(term => !titleBlob.includes(term) && contextBlob.includes(term));
    if (titleHits.length) {
      score += Math.min(35, Math.round(35 * titleHits.length / Math.max(1, terms.length)));
      reasons.push(`Role terms in title: ${titleHits.join(", ")}`);
    } else if (contextOnlyHits.length) {
      score += Math.min(10, contextOnlyHits.length * 3);
      reasons.push(`Role terms found only in page context: ${contextOnlyHits.join(", ")}`);
    } else reasons.push("Requested role terms not found in title or inspected text");
  }
  const keywords = clean(prefs.keywords).split(/[,;\n]+/).map(term => term.trim().toLowerCase()).filter(Boolean);
  const keywordHits = keywords.filter(keyword => blob.includes(keyword));
  if (keywords.length) {
    if (keywordHits.length) { score += Math.min(30, keywordHits.length * 10); reasons.push(`Keyword match: ${keywordHits.join(", ")}`); }
    else reasons.push("No requested keywords found");
  }
  const preferredLocation = clean(prefs.location);
  const location = preferredLocation.toLowerCase();
  if (location) {
    const actualLocation = clean(record.location).toLowerCase();
    const remote = /\b(remote|anywhere|work from home)\b/i.test(`${record.title || ""} ${record.snippet || ""} ${record.text || ""}`);
    const aliases = locationAliases(location);
    const actualMatches = actualLocation && aliases.some(alias => actualLocation.includes(alias));
    const broadIndiaMatch = location === "india" && /\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|new delhi|delhi|gurugram|gurgaon|chennai|noida|jaipur|pilani|kolkata|ahmedabad)\b/i.test(actualLocation);
    if (actualMatches || broadIndiaMatch) { score += 20; reasons.push(`Location matched: ${record.location || preferredLocation}`); }
    else if (actualLocation && !remote && !locationsMayOverlap(location, actualLocation)) {
      score -= 18;
      reasons.push(`Location mismatch: ${record.location} vs preferred ${preferredLocation}`);
    } else if (remote) { score += 8; reasons.push("Source mentions remote/anywhere work; location compatibility is unconfirmed"); }
    else if (blob.includes(location)) { score += 10; reasons.push(`Preferred location mentioned, but actual work location is unconfirmed`); }
    else reasons.push("Preferred location not established in inspected text");
  }
  const seniority = clean(prefs.seniority).toLowerCase();
  if (seniority && seniority !== "any") {
    const titleIntern = /\b(intern(ship)?|co-?op|student placement)\b/i.test(titleBlob);
    const explicitSeniorTitle = /\b(portfolio manager|senior|mid[- ]senior|director|head of|principal|staff engineer|lead researcher|vice president|vp)\b/i.test(titleBlob);
    if (seniority === "intern" || seniority === "internship") {
      if (titleIntern) {
        score += 10;
        reasons.push("Internship level supported by title");
      } else if (explicitSeniorTitle) {
        score -= 25;
        reasons.push("Seniority mismatch: title indicates a senior/managerial role, not an internship");
      } else {
        score -= 15;
        reasons.push("Internship level not established in the job title");
      }
    } else if (blob.includes(seniority) || (seniority === "student" && /intern|undergraduate|student/.test(blob))) {
      score += 10;
      reasons.push(`Seniority/level text matched: ${prefs.seniority}`);
    } else reasons.push("Requested level not explicitly found");
  }
  const visa = clean(prefs.visa).toLowerCase();
  if (visa && visa !== "no preference") {
    const visaHit = visa === "sponsorship needed"
      ? /visa sponsorship|sponsor visa|sponsorship available|sponsorship required/.test(blob)
      : visa === "visa sponsorship"
        ? /visa sponsorship|sponsorship available|sponsor visa/.test(blob)
        : /authorized to work|work authorization|right to work|eligible to work/.test(blob);
    if (visaHit) { score += 5; reasons.push("Work-authorisation terms found; verify eligibility directly"); }
    else reasons.push("Visa/work-authorisation compatibility not established");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function locationAliases(location) {
  const aliasMap = {
    india: ["india"],
    "united states": ["united states", "usa", "u.s.", "us"],
    usa: ["united states", "usa", "u.s.", "us"],
    "united kingdom": ["united kingdom", "uk", "britain", "england"],
    uk: ["united kingdom", "uk", "britain", "england"],
    bengaluru: ["bengaluru", "bangalore"],
    bangalore: ["bengaluru", "bangalore"],
    gurugram: ["gurugram", "gurgaon"],
    gurgaon: ["gurugram", "gurgaon"],
    delhi: ["delhi", "new delhi"]
  };
  return aliasMap[location] || [location];
}
function locationsMayOverlap(preferred, actual) {
  const prefAliases = locationAliases(preferred);
  const actualAliases = locationAliases(actual);
  return prefAliases.some(a => actualAliases.some(b => a === b || a.includes(b) || b.includes(a)));
}

function usableTitle(pageTitle, searchTitle, url) {
  const page = clean(pageTitle);
  if (page && !/^(careers?|jobs?|job search|home|welcome|search results?)\s*[|:-]?$/i.test(page) && !isGenericOpeningTitle(page)) return page;
  const searched = clean(searchTitle);
  if (searched && searched !== "Untitled search result" && !isGenericOpeningTitle(searched)) return searched;
  if (page) return page;
  if (searched && searched !== "Untitled search result") return searched;
  return titleFromUrl(url) || "Discovered career page";
}

function titleFromUrl(value) {
  try {
    const u = new URL(value);
    const slug = decodeURIComponent(u.pathname.split("/").filter(Boolean).at(-1) || "");
    if (!slug || /^(careers?|jobs?|search|internships?|open-positions?)$/i.test(slug)) return "";
    const cleaned = slug.replace(/\.(?:html?|aspx?)$/i, "").replace(/[-_]+/g, " ").replace(/\b\d{4,}\b/g, "").replace(/\s+/g, " ").trim();
    return cleaned ? cleaned.replace(/\b[a-z]/g, ch => ch.toUpperCase()).slice(0, 140) : "";
  } catch { return ""; }
}

function isCareerRelatedUrl(link) {
  try {
    const u = new URL(link);
    return !SOCIAL_HOSTS.test(u.hostname) && (isAtsSpecificRoleUrl(link) || /career|jobs?|intern|apply|position|opening|requisition|opportunit/i.test(`${u.hostname}${u.pathname}${u.search}`));
  } catch { return false; }
}

function dedupe(items) {
  const out = [];
  const indexByKey = new Map();
  for (const item of items) {
    const titleKey = normal(item.title);
    const companyKey = normal(item.company);
    const locationKey = normal(item.location);
    // Exact title + company + location is a useful cross-board identity key.
    // Keep distinct locations separate; fall back to canonical URL if identity
    // fields are incomplete rather than merging uncertain records.
    const identityKey = titleKey && companyKey
      ? `identity:${titleKey}|${companyKey}|${locationKey}`
      : `url:${canonicalUrl(item.sourceUrl)}`;
    if (!indexByKey.has(identityKey)) {
      indexByKey.set(identityKey, out.length);
      out.push(item);
      continue;
    }
    const index = indexByKey.get(identityKey);
    out[index] = mergeDuplicateOpportunity(out[index], item);
  }
  return out;
}

function mergeDuplicateOpportunity(first, next) {
  const firstScore = Number(first.matchScore) || 0;
  const nextScore = Number(next.matchScore) || 0;
  const preferred = nextScore > firstScore ? next : first;
  const other = preferred === first ? next : first;
  const result = { ...other, ...preferred };
  // A duplicate source can contribute useful link or eligibility evidence even
  // if it has a slightly lower relevance score.
  if (other.applicationLinkKind === "direct_apply_link" && preferred.applicationLinkKind !== "direct_apply_link") {
    for (const key of ["applicationUrl", "applicationLinkKind", "applicationLinkLabel", "applicationLinkNote", "applicationLinkBasis"]) result[key] = other[key];
    if (result.fieldEvidence && other.fieldEvidence?.applicationLink) result.fieldEvidence.applicationLink = other.fieldEvidence.applicationLink;
  }
  if (!result.eligibility && other.eligibility) {
    result.eligibility = other.eligibility;
    if (result.fieldEvidence && other.fieldEvidence?.eligibility) result.fieldEvidence.eligibility = other.fieldEvidence.eligibility;
  }
  if (!result.deadline && other.deadline) result.deadline = other.deadline;
  result.evidence = [...new Set([first.evidence, next.evidence].filter(Boolean))].join(" Duplicate source evidence: ");
  result.duplicateSourceCount = (first.duplicateSourceCount || 1) + (next.duplicateSourceCount || 1);
  return result;
}
function dedupeSources(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = canonicalUrl(item.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return null;
    return u.href;
  } catch { return null; }
}
function canonicalUrl(value) {
  const safe = safeHttpUrl(value);
  if (!safe) return "";
  const u = new URL(safe);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/$/, "");
  return u.toString();
}
function hostname(value) { try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; } }
function clean(value) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""; }
function cleanMultiline(value) { return typeof value === "string" ? value.replace(/\r/g, "").split(/\n+/).map(line => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n").trim() : ""; }
function normal(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function stableId(value) { let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return `cs-${(h >>> 0).toString(16)}`; }
