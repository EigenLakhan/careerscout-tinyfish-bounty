import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchResults,
  fetchResults,
  fetchErrors,
  discoverFollowupUrls,
  makeDiscoveredSearchPayload,
  mergeFetchPayloads,
  mergeSearchPayloads,
  normalizeSources,
  buildSearchQueries,
  selectInitialSearchResults
} from './normalize.js';

const search = { provider: 'TinyFish Search', data: { results: [
  { position: 1, site_name: 'www.qualcomm.com', title: 'Internships and Early Career Opportunities | India', url: 'https://www.qualcomm.com/company/careers/internships-and-early-career-opportunities/india', snippet: 'Internship opportunities in India' },
  { position: 2, site_name: 'in.linkedin.com', title: 'Software Engineer Intern Jobs in India (302 Open Roles)', url: 'https://in.linkedin.com/jobs/software-engineer-intern-jobs', snippet: 'Search jobs' },
  { position: 3, site_name: 'www.glassdoor.co.in', title: 'Software engineer internship jobs in India', url: 'https://www.glassdoor.co.in/Job/india-software-engineer-internship-jobs-SRCH_IL.0,5_IN115_KO6,34.htm', snippet: 'Search jobs' }
] } };
const fetch = { provider: 'TinyFish Fetch', data: { results: [
  { url: 'https://www.qualcomm.com/company/careers/internships-and-early-career-opportunities/india', final_url: 'https://www.qualcomm.com/company/careers/internships-and-early-career-opportunities/india', title: 'Internships and Early Career Opportunities | India | Qualcomm', description: 'Internship program in India', text: 'Eligibility\nMust be enrolled in a Bachelors/Masters/PhD degree in CSE, ECE, EE, or CS.\nHiring timeline\nJuly: positions are opened for applicants\nDecember: positions are closed\nSearch open internships', links: [
    'https://careers.qualcomm.com/careers?seniority=Intern&pid=446700567832&domain=qualcomm.com&sort_by=relevance',
    'https://www.qualcomm.com/company/careers',
    'https://www.linkedin.com/company/qualcomm/',
    'https://www.qualcomm.com/products',
    'https://www.qualcomm.com/images/logo.png'
  ] }
], errors: [
  { url: 'https://in.linkedin.com/jobs/software-engineer-intern-jobs', error: 'bot_blocked' },
  { url: 'https://www.glassdoor.co.in/Job/india-software-engineer-internship-jobs-SRCH_IL.0,5_IN115_KO6,34.htm', error: 'bot_blocked' }
] } };

const prefs = { role: 'software engineering internship', location: 'India', keywords: 'C++, Python', seniority: 'Student', visa: 'No preference' };

test('parses actual TinyFish Search response shape', () => {
  assert.equal(searchResults(search).length, 3);
  assert.equal(searchResults(search)[0].siteName, 'www.qualcomm.com');
  assert.equal(searchResults(search)[1].position, 2);
});

test('parses actual TinyFish Fetch response shape', () => {
  assert.equal(fetchResults(fetch).length, 1);
  assert.match(fetchResults(fetch)[0].text, /Eligibility/);
  assert.equal(fetchErrors(fetch).length, 2);
});

test('keeps generic careers pages separate from vacancy candidates and retains bot-block errors', () => {
  const result = normalizeSources(search, fetch, prefs);
  assert.equal(result.opportunities.length, 0);
  assert.equal(result.sources.length, 3);
  assert.equal(result.sources.find(source => source.company === 'LinkedIn').error, 'bot_blocked');
  const qualcomm = result.sources.find(source => source.company === 'Qualcomm');
  assert.equal(qualcomm.sourceType, 'careers_or_program_page');
  assert.ok(qualcomm.applicationUrl?.startsWith('https://careers.qualcomm.com/'));
  assert.equal(qualcomm.status, 'page_checked_source_only');
});

test('discovers relevant careers links but rejects social and static assets', () => {
  const urls = discoverFollowupUrls(fetch, searchResults(search).map(row => row.url), 5);
  assert.ok(urls.some(row => row.url.startsWith('https://careers.qualcomm.com/careers?')));
  assert.ok(!urls.some(row => row.url.includes('linkedin.com/company')));
  assert.ok(!urls.some(row => row.url.endsWith('logo.png')));
  assert.ok(!urls.some(row => row.url.includes('qualcomm.com/products')));
});

test('a specific LinkedIn job page may qualify while a LinkedIn search page remains an aggregator', () => {
  const listingSearch = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'www.linkedin.com', title: 'Software Engineer Intern at Acme | LinkedIn', url: 'https://www.linkedin.com/jobs/view/4293812345', snippet: 'Software Engineer Intern at Acme in Bengaluru' },
    { position: 2, site_name: 'www.linkedin.com', title: 'Software Engineer Intern Jobs in India', url: 'https://www.linkedin.com/jobs/software-engineer-intern-jobs', snippet: 'Browse hundreds of openings' }
  ] } };
  const listingFetch = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://www.linkedin.com/jobs/view/4293812345', final_url: 'https://www.linkedin.com/jobs/view/4293812345', title: 'Software Engineer Intern at Acme | LinkedIn', description: 'Software Engineer Intern', text: 'Job description\nResponsibilities\nWhat you’ll do\nQualifications\nApply by 15 November 2026\nLocation: Bengaluru', links: ['https://jobs.acme.com/job/123/apply'] }
  ], errors: [{ url: 'https://www.linkedin.com/jobs/software-engineer-intern-jobs', error: 'bot_blocked' }] } };
  const result = normalizeSources(listingSearch, listingFetch, { ...prefs, keywords: 'Python' });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].company, 'Acme');
  assert.equal(result.opportunities[0].location, 'Bengaluru');
  assert.equal(result.opportunities[0].deadline, '15 November 2026');
  assert.equal(result.opportunities[0].applicationUrl, 'https://jobs.acme.com/job/123/apply');
  assert.equal(result.sources.some(source => source.sourceType === 'job_board_or_aggregator'), true);
});

test('follows multiple levels, creates source provenance, and merges synthetic leads', () => {
  const firstBatch = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://company.example/careers', final_url: 'https://company.example/careers', title: 'Careers', text: 'Internship opportunities', links: ['https://company.example/jobs/software-engineer-intern-12345', 'https://company.example/about'] }
  ], errors: [] } };
  const discovered = discoverFollowupUrls(firstBatch, ['https://company.example/careers'], 5);
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].parentUrl, 'https://company.example/careers');
  const synthetic = makeDiscoveredSearchPayload(discovered, 100);
  const merged = mergeSearchPayloads(search, synthetic);
  const syntheticRow = searchResults(merged).find(row => row.url.includes('software-engineer-intern-12345'));
  assert.equal(syntheticRow.discoveredFrom, 'https://company.example/careers');
  assert.match(syntheticRow.title, /Software Engineer Intern/);
});

test('deduplicates redirects and drops stale errors when the same source succeeds', () => {
  const payload = mergeFetchPayloads(
    { provider: 'TinyFish Fetch', data: { results: [], errors: [{ url: 'https://example.com/job/123', error: 'temporary_error' }] } },
    { provider: 'TinyFish Fetch', data: { results: [{ url: 'https://example.com/job/123', final_url: 'https://example.com/job/123?utm_source=test', title: 'Job', text: 'Responsibilities', links: [] }], errors: [] } }
  );
  assert.equal(fetchResults(payload).length, 1);
  assert.equal(fetchErrors(payload).length, 0);
});

test('does not treat generic /jobs or /careers pages as individual jobs', () => {
  const genericSearch = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'jobs.example.com', title: 'Software Engineer Intern Jobs', url: 'https://jobs.example.com/jobs/', snippet: 'Search openings' }
  ] } };
  const genericFetch = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://jobs.example.com/jobs/', final_url: 'https://jobs.example.com/jobs/', title: 'Software Engineer Intern Jobs', text: 'Job description and responsibilities overview. Browse job listings.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(genericSearch, genericFetch, prefs);
  assert.equal(result.opportunities.length, 0);
  assert.equal(result.sources.length, 1);
});

test('detects explicit closed signals without claiming other pages are open', () => {
  const closedSearch = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'jobs.example.com', title: 'Software Engineer Intern at Example', url: 'https://jobs.example.com/job/software-engineer-intern-12345', snippet: 'Internship role' }
  ] } };
  const closedFetch = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://jobs.example.com/job/software-engineer-intern-12345', final_url: 'https://jobs.example.com/job/software-engineer-intern-12345', title: 'Software Engineer Intern at Example', text: 'Job description. Responsibilities. This position has been filled.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(closedSearch, closedFetch, prefs);
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].availabilitySignal, 'closed_signal_detected');
});


test('recognizes fetched individual job pages embedded in LinkedIn-style search results', () => {
  const rows = [
    { title: 'MediNex Workforce hiring Applied Data Science Intern (Python, Statistics, Visualisation) in India | LinkedIn', company: 'MediNex Workforce', url: 'https://www.linkedin.com/jobs/view/1234567890', location: 'India' },
    { title: 'The India Prosperity Initiative hiring Decision Scientist Intern in Gurugram, Haryana, India | LinkedIn', company: 'The India Prosperity Initiative', url: 'https://www.linkedin.com/jobs/view/1234567891', location: 'Gurugram' },
    { title: 'Data Science Intern | Entry Level | Fresher | Python / Data Analysis | Remote at Skillzenloop — India | LinkedIn Jobs', company: 'Skillzenloop', url: 'https://www.linkedin.com/jobs/view/1234567892', location: 'India' }
  ];
  const searchPayload = { provider: 'TinyFish Search', data: { results: rows.map((r, i) => ({ position: i + 1, site_name: 'in.linkedin.com', title: r.title, url: r.url, snippet: `Posted today. Apply for this internship in ${r.location}.` })) } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: rows.map(r => ({ url: r.url, final_url: r.url, title: r.title, text: `Posted today. Job Title: ${r.title}. Responsibilities include analysis. Qualifications required. Apply for this job. Location: ${r.location}.`, links: [`https://jobs.example.com/job/${r.company.toLowerCase().replace(/[^a-z]+/g, '-')}-apply`] })), errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'data science intern', location: 'India', keywords: 'Python, statistics', seniority: 'Intern', visa: 'No preference' });
  assert.equal(result.opportunities.length, 3);
  assert.ok(result.opportunities.some(job => job.company === 'MediNex Workforce'));
  assert.ok(result.opportunities.some(job => job.company === 'The India Prosperity Initiative'));
  assert.ok(result.opportunities.some(job => job.company === 'Skillzenloop'));
});

test('penalizes explicit geographic mismatch instead of awarding a misleading high score', () => {
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'www.gresearch.com', title: 'Quant Research Internship | G-Research', url: 'https://www.gresearch.com/careers/quant-research-internship-12345', snippet: 'Quant research internship in London' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://www.gresearch.com/careers/quant-research-internship-12345', final_url: 'https://www.gresearch.com/careers/quant-research-internship-12345', title: 'Quant Research Internship | G-Research', text: 'Job description. Responsibilities. Qualifications. Location: London. Apply for this job.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'quant research internship', location: 'India', keywords: 'finance, machine learning', seniority: 'Intern', visa: 'No preference' });
  assert.equal(result.opportunities.length, 1);
  assert.ok(result.opportunities[0].matchScore < 50, `expected location mismatch to lower score, got ${result.opportunities[0].matchScore}`);
  assert.ok(result.opportunities[0].matchReasons.some(reason => reason.includes('Location mismatch')));
});

test('does not promote generic LinkedIn job-board landing pages based on their broad title', () => {
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'in.linkedin.com', title: '539 Quantitative Internship jobs in India', url: 'https://in.linkedin.com/jobs/quantitative-internship-jobs', snippet: "Today's top 539 Quantitative Internship jobs in India. New jobs added daily." }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://in.linkedin.com/jobs/quantitative-internship-jobs', final_url: 'https://in.linkedin.com/jobs/quantitative-internship-jobs', title: '539 Quantitative Internship jobs in India', text: 'Today’s top 539 Quantitative Internship jobs in India. New jobs added daily. Browse hundreds of openings.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'quant internship', location: 'India', keywords: '', seniority: 'Intern', visa: 'No preference' });
  assert.equal(result.opportunities.length, 0);
  assert.equal(result.sources[0].sourceType, 'job_board_or_aggregator');
});


test('classifies specific LinkedIn card-style postings even when URL is a non-canonical search route', () => {
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'in.linkedin.com', title: 'Data Science Intern | Entry Level | Fresher | Python / Data Analysis | Remote at Skillzenloop — India | LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/search/?currentJobId=4293812345', snippet: 'Apply for Data Science Intern at Skillzenloop in India.' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://www.linkedin.com/jobs/search/?currentJobId=4293812345', final_url: 'https://www.linkedin.com/jobs/search/?currentJobId=4293812345', title: 'Data Science Intern | Entry Level | Fresher | Python / Data Analysis | Remote at Skillzenloop — India | LinkedIn Jobs', text: 'Apply for Data Science Intern at Skillzenloop in India. Full-time Internship role. See responsibilities, qualifications, and similar jobs on LinkedIn.', links: ['https://www.linkedin.com/jobs/view/4293812345/'] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'data science intern', location: 'India', keywords: 'Python', seniority: 'Intern', visa: 'No preference' });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].company, 'Skillzenloop');
  assert.equal(result.opportunities[0].sourceType, 'individual_job');
});

test('does not infer a random city from a generic aggregator result feed', () => {
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'in.linkedin.com', title: '539 Quantitative Internship jobs in India', url: 'https://in.linkedin.com/jobs/quantitative-internship-jobs', snippet: 'Popular listings in Pune, Bengaluru and Hyderabad.' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://in.linkedin.com/jobs/quantitative-internship-jobs', final_url: 'https://in.linkedin.com/jobs/quantitative-internship-jobs', title: '539 Quantitative Internship jobs in India', text: 'Pune Bengaluru Hyderabad. Browse hundreds of openings.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'quant internship', location: 'India', keywords: '', seniority: 'Intern', visa: 'No preference' });
  assert.ok(!result.sources[0].matchReasons.some(reason => /Location matched: (Pune|Bengaluru|Hyderabad)/i.test(reason)));
});


test('preserves eligibility line boundaries and does not surface the entire job description as eligibility', () => {
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'jobs.example.com', title: 'Quant Research Intern at Example', url: 'https://jobs.example.com/job/quant-research-intern-12345', snippet: 'Internship in India' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://jobs.example.com/job/quant-research-intern-12345', final_url: 'https://jobs.example.com/job/quant-research-intern-12345', title: 'Quant Research Intern at Example', text: 'About the role\nWe build quantitative trading strategies.\nEligibility\nMust be currently enrolled in a Bachelor’s or Master’s degree.\nResponsibilities\nAnalyze market data and build models.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'quant research internship', location: 'India', keywords: 'market data', seniority: 'Intern', visa: 'No preference' });
  assert.match(result.opportunities[0].eligibility, /currently enrolled/i);
  assert.doesNotMatch(result.opportunities[0].eligibility, /We build quantitative trading strategies|Analyze market data/);
});

test('scores the title over incidental body mentions and penalizes a manager role for internship preference', () => {
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'www.example.com', title: 'Portfolio Manager at Example', url: 'https://www.example.com/jobs/portfolio-manager-12345', snippet: 'Quantitative finance' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://www.example.com/jobs/portfolio-manager-12345', final_url: 'https://www.example.com/jobs/portfolio-manager-12345', title: 'Portfolio Manager at Example', text: 'Job description\nResponsibilities include quantitative research.\nOur company also hires interns in other teams.\nQualifications required: 5 years of experience.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'quant research internship', location: 'India', keywords: 'finance', seniority: 'Intern', visa: 'No preference' });
  assert.equal(result.opportunities.length, 1);
  assert.ok(result.opportunities[0].matchReasons.some(reason => /seniority mismatch/i.test(reason)));
  assert.ok(result.opportunities[0].matchScore < 50, `expected low fit score, got ${result.opportunities[0].matchScore}`);
});

test('eligibility extraction skips markdown headings and retains substantive requirements', () => {
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'jobs.example.com', title: 'Quant Research Intern at Example', url: 'https://jobs.example.com/job/quant-research-intern-12345', snippet: 'Quant research internship' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://jobs.example.com/job/quant-research-intern-12345', final_url: 'https://jobs.example.com/job/quant-research-intern-12345', title: 'Quant Research Intern at Example', text: '### Required Qualifications**\nEligibility\n- Must be currently enrolled in a Bachelor’s or Master’s degree in mathematics, computer science, or a related field.\n- Applicants must have strong Python skills.\nResponsibilities\nAnalyze market data and prototype strategies.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { ...prefs, role: 'quant research internship', seniority: 'Intern' });
  const eligibility = result.opportunities[0].eligibility;
  assert.match(eligibility, /currently enrolled/i);
  assert.match(eligibility, /Applicants must have strong Python skills/i);
  assert.doesNotMatch(eligibility, /Required Qualifications|^Eligibility$/i);
  assert.doesNotMatch(eligibility, /Analyze market data|prototype strategies/i);
});

test('labels a direct apply URL distinctly from careers pages and fallback role pages', () => {
  const rows = [
    { position: 1, site_name: 'jobs.example.com', title: 'Quant Research Intern at Example', url: 'https://jobs.example.com/job/quant-research-intern-12345' },
    { position: 2, site_name: 'jobs.other.com', title: 'Quant Research Intern at Other', url: 'https://jobs.other.com/job/quant-research-intern-56789' }
  ];
  const searchPayload = { provider: 'TinyFish Search', data: { results: rows.map(row => ({ ...row, snippet: 'Quant research internship in India' })) } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: rows[0].url, final_url: rows[0].url, title: rows[0].title, text: 'Job description\nResponsibilities\nQualifications required. Location: Bengaluru.', links: [
      'https://jobs.example.com/careers',
      'https://apply.example.com/job/quant-research-intern-12345/apply'
    ] },
    { url: rows[1].url, final_url: rows[1].url, title: rows[1].title, text: 'Job description\nResponsibilities\nQualifications required. Location: Bengaluru.', links: [
      'https://www.linkedin.com/company/other',
      'javascript:alert(1)',
      'https://jobs.other.com/careers'
    ] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { ...prefs, role: 'quant research internship', location: 'India', seniority: 'Intern' });
  const direct = result.opportunities.find(job => job.company === 'Example');
  const fallback = result.opportunities.find(job => job.company === 'Other');
  assert.equal(direct.applicationUrl, 'https://apply.example.com/job/quant-research-intern-12345/apply');
  assert.equal(direct.applicationLinkKind, 'direct_apply_link');
  assert.equal(direct.applicationLinkLabel, 'Direct application link');
  assert.equal(fallback.applicationLinkKind, 'specific_role_page');
  assert.match(fallback.applicationLinkNote, /specific job page/i);
  assert.equal(result.summary.withDirectApplyLinks, 1);
  assert.equal(result.summary.withSpecificRolePages, 1);
});

test('assigns fit categories for confirmed internships, unconfirmed seniority, and explicit mismatch', () => {
  const rows = [
    { title: 'Quant Research Intern at Alpha', url: 'https://jobs.example.com/job/quant-research-intern-12345', location: 'Bengaluru', text: 'Internship. Quantitative research using Python and finance data.' },
    { title: 'Quantitative Researcher at Beta', url: 'https://jobs.example.com/job/quantitative-researcher-12345', location: 'Bengaluru', text: 'Quantitative research using Python and finance data. Job description. Responsibilities.' },
    { title: 'Portfolio Manager at Gamma', url: 'https://jobs.example.com/job/portfolio-manager-12345', location: 'Bengaluru', text: 'Quantitative research and finance. Job description. Responsibilities.' },
    { title: 'Quant Research Intern at Delta', url: 'https://jobs.example.com/job/quant-research-intern-54321', location: 'London', text: 'Internship. Quantitative research using Python and finance data.' }
  ];
  const searchPayload = { provider: 'TinyFish Search', data: { results: rows.map((row, index) => ({ position: index + 1, site_name: 'jobs.example.com', title: row.title, url: row.url, snippet: `${row.title} in ${row.location}` })) } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: rows.map(row => ({ url: row.url, final_url: row.url, title: row.title, text: `${row.text}\nLocation: ${row.location}\nQualifications required.`, links: [] })), errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'quant research internship', location: 'India', keywords: 'Python, finance', seniority: 'Intern', visa: 'No preference' });
  const alpha = result.opportunities.find(job => job.title.includes('Alpha'));
  const beta = result.opportunities.find(job => job.title.includes('Beta'));
  const gamma = result.opportunities.find(job => job.title.includes('Gamma'));
  const delta = result.opportunities.find(job => job.title.includes('Delta'));
  assert.equal(alpha.fitAssessment.seniority, 'confirmed_in_title');
  assert.ok(['strong_match', 'potential_match'].includes(alpha.fitAssessment.category));
  assert.equal(beta.fitAssessment.category, 'review_seniority');
  assert.equal(gamma.fitAssessment.category, 'preference_mismatch');
  assert.equal(delta.fitAssessment.category, 'preference_mismatch');
  assert.ok(result.summary.preferenceMismatches >= 2);
  assert.ok(result.summary.needsReview >= 1);
});

test('does not produce an application URL from an unsafe or unrelated social link', () => {
  const url = 'https://jobs.example.com/job/quant-research-intern-12345';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'jobs.example.com', title: 'Quant Research Intern at Example', url, snippet: 'Quant research internship in India' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Quant Research Intern at Example', text: 'Job description. Responsibilities. Qualifications required.', links: ['javascript:alert(1)', 'https://www.linkedin.com/company/example/', 'mailto:jobs@example.com'] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { ...prefs, role: 'quant research internship', seniority: 'Intern' });
  assert.equal(result.opportunities[0].applicationUrl, url);
  assert.equal(result.opportunities[0].applicationLinkKind, 'specific_role_page');
});


test('builds distinct standard and expanded search strategies with role, location, and level context', () => {
  const standard = buildSearchQueries({ role: 'quant research internship', location: 'India', keywords: 'C++, finance', seniority: 'Intern', searchBreadth: 'standard' });
  const expanded = buildSearchQueries({ role: 'quant research internship', location: 'India', keywords: 'C++, finance', seniority: 'Intern', searchBreadth: 'expanded' });
  assert.equal(standard.length, 1);
  assert.equal(expanded.length, 3);
  assert.equal(new Set(expanded.map(item => item.query.toLowerCase())).size, 3);
  assert.match(expanded[0].query, /India/);
  assert.match(expanded[1].query, /individual job posting/i);
  assert.match(expanded[2].query, /greenhouse|lever|ashby|workday/i);
  assert.ok(expanded.every(item => item.query.length <= 400));
});

test('selects initial Fetch targets across query variants and prefers distinct hosts', () => {
  const first = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'linkedin.com', title: 'LinkedIn A', url: 'https://www.linkedin.com/jobs/view/100001' },
    { position: 2, site_name: 'indeed.com', title: 'Indeed B', url: 'https://www.indeed.com/viewjob?jk=abcdef' },
    { position: 3, site_name: 'qualcomm.com', title: 'Qualcomm careers', url: 'https://www.qualcomm.com/careers/internships' }
  ] } };
  const second = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'linkedin.com', title: 'LinkedIn duplicate', url: 'https://www.linkedin.com/jobs/view/100001?utm_source=search' },
    { position: 2, site_name: 'greenhouse.io', title: 'Greenhouse role', url: 'https://boards.greenhouse.io/acme/jobs/12345' },
    { position: 3, site_name: 'workday.com', title: 'Workday role', url: 'https://acme.myworkdayjobs.com/en-US/External/job/Quant-Intern/R123' }
  ] } };
  const selected = selectInitialSearchResults([first, second], 4);
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map(item => new URL(item.url).hostname)).size, 4);
  assert.equal(selected.filter(item => item.url.includes('/jobs/view/100001')).length, 1);
});

test('uses Markdown Apply anchor text as link evidence even when URL path is not named apply', () => {
  const url = 'https://company.example/jobs/quant-research-intern-12345';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'company.example', title: 'Quant Research Intern at Acme', url, snippet: 'Internship in India' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Quant Research Intern at Acme', text: 'Job description\nResponsibilities\n[Apply Now](https://apply.example.com/forms/12345)', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { ...prefs, role: 'quant research internship', location: 'India', seniority: 'Intern' });
  assert.equal(result.opportunities[0].applicationUrl, 'https://apply.example.com/forms/12345');
  assert.equal(result.opportunities[0].applicationLinkKind, 'direct_apply_link');
  assert.match(result.opportunities[0].applicationLinkBasis, /Apply Now/i);
  assert.equal(result.summary.withDirectApplyLinks, 1);
});

test('prioritizes a specific ATS role URL during bounded link discovery', () => {
  const page = { provider: 'TinyFish Fetch', data: { results: [
    { url: 'https://company.example/careers', final_url: 'https://company.example/careers', title: 'Careers', text: 'Explore our internships.', links: [
      'https://company.example/about',
      'https://jobs.lever.co/acme/2edc34e9-1234-4567-89ab-123456789012',
      'https://company.example/careers'
    ] }
  ], errors: [] } };
  const results = discoverFollowupUrls(page, ['https://company.example/careers'], 5);
  assert.equal(results.length, 1);
  assert.match(results[0].url, /jobs\.lever\.co/);
});

test('includes field-level source evidence for title, location, seniority, eligibility, and application route', () => {
  const url = 'https://jobs.example.com/job/quant-research-intern-54321';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'jobs.example.com', title: 'Quant Research Intern at Example — Bengaluru, India', url, snippet: 'Quant research internship in Bengaluru, India' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Quant Research Intern at Example — Bengaluru, India', text: 'Eligibility\nMust be enrolled in a Bachelor degree.\nResponsibilities\nBuild quantitative models.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { ...prefs, role: 'quant research internship', location: 'India', seniority: 'Intern' });
  const evidence = result.opportunities[0].fieldEvidence;
  assert.equal(evidence.title.source, 'Fetched page title');
  assert.equal(evidence.location.value, 'Bengaluru');
  assert.match(evidence.location.source, /title/i);
  assert.equal(evidence.seniority.status, 'confirmed_in_title');
  assert.match(evidence.eligibility.excerpt, /Must be enrolled/i);
  assert.equal(evidence.applicationLink.kind, 'specific_role_page');
});

test('deduplicates exact same-company, same-location openings across source URLs and keeps stronger link evidence', () => {
  const linkedinUrl = 'https://www.linkedin.com/jobs/view/44556677';
  const employerUrl = 'https://jobs.acme.com/job/quant-research-intern-12345';
  const title = 'Quant Research Intern at Acme';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'www.linkedin.com', title, url: linkedinUrl, snippet: 'Quant Research Intern in Bengaluru' },
    { position: 2, site_name: 'jobs.acme.com', title, url: employerUrl, snippet: 'Quant Research Intern in Bengaluru' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url: linkedinUrl, final_url: linkedinUrl, title, text: 'Job description\nLocation: Bengaluru\nInternship in quantitative research.', links: [] },
    { url: employerUrl, final_url: employerUrl, title, text: 'Job description\nLocation: Bengaluru\nInternship in quantitative research.\n[Apply](https://apply.acme.com/forms/12345)', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { ...prefs, role: 'quant research internship', location: 'India', keywords: 'finance', seniority: 'Intern' });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].duplicateSourceCount, 2);
  assert.equal(result.opportunities[0].applicationLinkKind, 'direct_apply_link');
  assert.equal(result.summary.withDirectApplyLinks, 1);
});


test('rejects non-HTTP and credential-bearing URLs in Search results', () => {
  const payload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, title: 'Unsafe', url: 'https://user:password@example.com/jobs/intern-12345' },
    { position: 2, title: 'Script URL', url: 'javascript:alert(1)' },
    { position: 3, title: 'Safe role', url: 'https://jobs.example.com/job/quant-intern-12345' }
  ] } };
  const parsed = searchResults(payload);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'Safe role');
});

test('keeps failed search variants explicit in the backend response contract and preserves per-field evidence', () => {
  const url = 'https://jobs.example.com/job/quant-research-intern-12345';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'jobs.example.com', title: 'Quant Research Intern at Example', url, snippet: 'Internship in India' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Quant Research Intern at Example', text: 'Location: Bengaluru, India\nEligibility\nMust be enrolled in a degree program.\nResponsibilities\nBuild research tools.\n[Apply Now](https://apply.example.com/123)', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'quant research internship', location: 'India', keywords: 'research', seniority: 'Intern' });
  const job = result.opportunities[0];
  assert.equal(job.fitAssessment.seniority, 'confirmed_in_title');
  assert.equal(job.fieldEvidence.applicationLink.kind, 'direct_apply_link');
  assert.match(job.fieldEvidence.eligibility.excerpt, /Must be enrolled/i);
  assert.equal(job.applicationUrl, 'https://apply.example.com/123');
});

test('extracts the employer from evidence on ATS-hosted pages instead of labeling the ATS as the company', () => {
  const url = 'https://job-boards.greenhouse.io/gleanwork/jobs/4012745005';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'job-boards.greenhouse.io', title: 'Software Engineer, Machine Learning', url,
      snippet: 'Glean is the Work AI platform that helps everyone work smarter with AI. Strong coding skills (Python, Go, Java, C++). This role is in person in Bangalore.' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Software Engineer, Machine Learning',
      text: 'Job description\nResponsibilities\nBuild software for the Work AI platform. Qualifications required.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'software engineering internship', location: 'India', keywords: 'Python, C++', seniority: 'Student', visa: 'No preference' });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].company, 'Glean');
  assert.equal(result.opportunities[0].fieldEvidence.company.source, 'Search result snippet');
  assert.match(result.opportunities[0].fieldEvidence.company.excerpt, /Glean is the Work AI platform/i);
  assert.notEqual(result.opportunities[0].company, 'Greenhouse');
});

test('does not classify a generic Internship Openings page as an individual vacancy based on generic qualifications text', () => {
  const url = 'https://www.merl.com/careers/internship-openings';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'www.merl.com', title: 'Internship Openings', url,
      snippet: 'Internship openings in robotics, embodied AI, computer vision, or machine learning.' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Internship Openings',
      text: 'Internship Openings\nStrong publication record or demonstrated research potential in robotics, embodied AI, computer vision, or machine learning. Must have publications in top AI conferences.\nResponsibilities and qualifications vary by role.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'software engineering internship', location: 'India', keywords: 'Python, machine learning', seniority: 'Student', visa: 'No preference' });
  assert.equal(result.opportunities.length, 0);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].sourceType, 'careers_or_program_page');
  assert.equal(result.sources[0].title, 'Internship Openings');
});

test('does not invent an employer when the page is hosted by an ATS and no employer evidence exists', () => {
  const url = 'https://job-boards.greenhouse.io/customer/jobs/4012745006';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'job-boards.greenhouse.io', title: 'Software Engineer Intern', url,
      snippet: 'Software Engineer Intern. Responsibilities include writing and testing code.' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Software Engineer Intern',
      text: 'Job description\nResponsibilities include writing and testing code. Qualifications required.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'software engineering internship', location: 'India', keywords: 'Python', seniority: 'Intern', visa: 'No preference' });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].company, null);
  assert.match(result.opportunities[0].fieldEvidence.company.source, /ATS hosting domain only/i);
});

test('does not label a broad job-board search URL as a specific role page', () => {
  const url = 'https://jobs.acme.example/job/software-engineer-intern-12345';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'jobs.acme.example', title: 'Software Engineer Intern at Acme', url, snippet: 'Software Engineering internship in India' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Software Engineer Intern at Acme', text: 'Job description\nResponsibilities include writing software. Qualifications required.', links: [
      'https://www.linkedin.com/jobs/software-engineer-intern-jobs',
      'https://jobs.acme.example/careers'
    ] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { role: 'software engineering internship', location: 'India', keywords: 'Python', seniority: 'Intern', visa: 'No preference' });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].applicationUrl, url);
  assert.equal(result.opportunities[0].applicationLinkKind, 'specific_role_page');
  assert.doesNotMatch(result.opportunities[0].applicationLinkBasis || '', /Specific external employer\/ATS role URL/);
});


test('keeps role-prefixed internship program pages as sources rather than individual vacancies', () => {
  const url = 'https://careers.example.com/students/software-engineering-internship-program';
  const searchPayload = { provider: 'TinyFish Search', data: { results: [
    { position: 1, site_name: 'careers.example.com', title: 'Software Engineering Internship Program', url,
      snippet: 'Learn about our student internship program. Qualifications and responsibilities vary by team.' }
  ] } };
  const fetchPayload = { provider: 'TinyFish Fetch', data: { results: [
    { url, final_url: url, title: 'Software Engineering Internship Program',
      text: 'Internship program overview. Qualifications and responsibilities vary by team. Explore open positions.', links: [] }
  ], errors: [] } };
  const result = normalizeSources(searchPayload, fetchPayload, { ...prefs, role: 'software engineering internship', seniority: 'Student' });
  assert.equal(result.opportunities.length, 0);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].sourceType, 'careers_or_program_page');
});
