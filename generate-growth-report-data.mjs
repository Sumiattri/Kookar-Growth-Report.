import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const GROWTH_URL = process.env.GROWTH_SUPABASE_URL || 'https://rdzknsixdanuwligzxsx.supabase.co';
const GROWTH_KEY = process.env.GROWTH_SUPABASE_SERVICE_ROLE_KEY || process.env.GROWTH_SUPABASE_KEY || '';
const LIVE_URL = process.env.LIVE_SUPABASE_URL || 'https://oqhygqxpxpdjtvaahwxk.supabase.co';
const LIVE_KEY = process.env.LIVE_SUPABASE_SERVICE_ROLE_KEY || process.env.LIVE_SUPABASE_KEY || '';
const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || await readEnv('META_ADS_ACCESS_TOKEN');
const META_ACCOUNT = process.env.META_AD_ACCOUNT_ID || 'act_708364765436163';
if (!GROWTH_KEY) throw new Error('Missing GROWTH_SUPABASE_SERVICE_ROLE_KEY');
if (!LIVE_KEY) throw new Error('Missing LIVE_SUPABASE_SERVICE_ROLE_KEY');
const OUTPUT_PATH = process.env.GROWTH_REPORT_OUTPUT || 'public/data.json';
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const HISTORY_START_IST = process.env.GROWTH_REPORT_START_IST || '2026-05-01 00:00:00';
const CUTOFF_IST = process.env.GROWTH_REPORT_CUTOFF_IST || '2026-05-19 14:57:32';

async function readEnv(key) {
  try {
    const env = await fs.readFile('.env', 'utf8');
    return env.split('\n').find((line) => line.startsWith(`${key}=`))?.split('=').slice(1).join('=').trim() || '';
  } catch {
    return '';
  }
}
const toUtc = (istString) => new Date(istString.replace(' ', 'T') + '+05:30').toISOString();
const toIst = (iso) => iso ? new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) : '';
const norm = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);
const pathFromUrl = (url) => { try { return (new URL(url).pathname || '/').toLowerCase().replace(/\/+$/, '') || '/'; } catch { return ''; } };
const variantOf = (lead) => { const pagePath = pathFromUrl(lead?.landing_page_url); return pagePath === '/' ? 'root' : pagePath ? pagePath.slice(1) : (lead?.landing_variant || '(unknown)'); };
const adIdOf = (lead) => lead?.ad_id || lead?.utm_content || '';
const adNameOf = (lead) => lead?.ad_name || lead?.utm_term || (adIdOf(lead) ? '(ad name missing)' : 'Direct / Organic');
const sourceTypeOf = (lead) => adIdOf(lead) ? 'Paid Ad' : 'Direct / Organic Site';
const cohortOfVariant = (variant) => variant === 'landing2' ? 'Paid Cohort' : variant === 'landing5' ? 'Free Cohort' : 'Other';
const directBucketOfVariant = (variant) => variant === 'landing2' ? 'Direct to landing2 (paid)' : variant === 'landing5' ? 'Direct to landing5 (free)' : `Direct to ${variant}`;
const dayIst = (iso) => toIst(iso).slice(0, 10);
const empty = () => ({ spend: 0, impressions: 0, clicks: 0, leads: 0, q1: 0, q2: 0, q3: 0, details: 0, wa: 0, ob: 0, obDone: 0 });
const addLead = (target, lead) => { target.leads += 1; if (lead.has_cook) target.q1 += 1; if (lead.age_range) target.q2 += 1; if (lead.family_type || lead.qualified_at) target.q3 += 1; if (lead.completed_registration_at || (lead.native_state && lead.diet_preference)) target.details += 1; if (lead.whatsapp_redirected_at) target.wa += 1; };
const enrich = (row) => ({ ...row, q1Rate: row.leads ? row.q1 / row.leads : null, waRate: row.leads ? row.wa / row.leads : null, obRate: row.leads ? row.ob / row.leads : null, costPerOb: row.ob ? row.spend / row.ob : null });
const ensure = (map, key, seed) => { if (!map.has(key)) map.set(key, structuredClone(seed)); return map.get(key); };
async function fetchAll(client, table, select, gte, lt) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(select).gte('created_at', gte).lt('created_at', lt).order('created_at', { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
function dateRangeFromRows(leads, onboardings) {
  const dates = [...leads.map((lead) => dayIst(lead.created_at)), ...onboardings.map((ob) => dayIst(ob.created_at))].filter(Boolean).sort();
  return { minDate: dates[0] || '', maxDate: dates.at(-1) || '' };
}
async function fetchMetaDaily(since, until) {
  const byDateAd = new Map();
  if (!META_TOKEN) return { byDateAd, error: 'Missing META_ADS_ACCESS_TOKEN' };
  let url = `https://graph.facebook.com/v21.0/${META_ACCOUNT}/insights?level=ad&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,clicks,date_start&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=500&access_token=${META_TOKEN}`;
  while (url) {
    const json = await (await fetch(url)).json();
    if (json.error) return { byDateAd, error: json.error.message };
    for (const row of json.data || []) {
      byDateAd.set(`${row.date_start}::${row.ad_id}`, {
        date: row.date_start,
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        adset_name: row.adset_name,
        campaign_name: row.campaign_name,
        spend: Number(row.spend || 0),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.inline_link_clicks || row.clicks || 0),
      });
    }
    url = json.paging?.next || null;
  }
  return { byDateAd, error: null };
}

const growth = createClient(GROWTH_URL, GROWTH_KEY);
const live = createClient(LIVE_URL, LIVE_KEY);
const startUtc = toUtc(HISTORY_START_IST);
const endUtc = new Date().toISOString();
const leadSelect = 'id,created_at,phone_number,name,landing_variant,landing_page_url,has_cook,age_range,family_type,native_state,diet_preference,qualified_at,completed_registration_at,whatsapp_redirected_at,onboarding_booked_at,onboarding_booking_status,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,utm_content,utm_source,utm_medium,utm_campaign,utm_term,fbclid';
const leads = await fetchAll(growth, 'landing_page_leads', leadSelect, startUtc, endUtc);
const onboardings = (await fetchAll(live, 'onboardings', 'phone_number,created_at,date_time,is_booked,is_onboarding_done,onboarding_status,onboarding_type,house_id,meet_link', startUtc, endUtc)).filter((ob) => ob.is_booked);
const leadsByPhone = new Map();
for (const lead of leads) {
  const phone = norm(lead.phone_number);
  if (!phone) continue;
  if (!leadsByPhone.has(phone)) leadsByPhone.set(phone, []);
  leadsByPhone.get(phone).push(lead);
}
for (const leadList of leadsByPhone.values()) leadList.sort((a, b) => a.created_at.localeCompare(b.created_at));
const matchedObs = onboardings.map((ob) => {
  const leadList = leadsByPhone.get(norm(ob.phone_number)) || [];
  const lead = leadList.filter((item) => item.created_at <= ob.created_at).at(-1) || leadList[0] || null;
  return { ob, lead };
});
const range = dateRangeFromRows(leads, onboardings);
const meta = await fetchMetaDaily(range.minDate, range.maxDate || range.minDate);
const adLeadCountsByDate = new Map();
for (const lead of leads.filter((item) => sourceTypeOf(item) === 'Paid Ad')) {
  const key = `${dayIst(lead.created_at)}::${adIdOf(lead)}`;
  adLeadCountsByDate.set(key, (adLeadCountsByDate.get(key) || 0) + 1);
}
const adRowsMap = new Map();
const directRowsMap = new Map();
const cohortRowsMap = new Map();
const dailyRowsMap = new Map();
for (const lead of leads) {
  const date = dayIst(lead.created_at);
  const variant = variantOf(lead);
  const cohort = cohortOfVariant(variant);
  const source = sourceTypeOf(lead);
  if (source === 'Paid Ad') {
    const adId = adIdOf(lead);
    const adKey = `${date}::${cohort}::${variant}::${adId}`;
    addLead(ensure(adRowsMap, adKey, { date, cohort, variant, ad_id: adId, ad_name: adNameOf(lead), adset_name: lead.adset_name || '', campaign_name: lead.campaign_name || lead.utm_campaign || '', ...empty() }), lead);
    addLead(ensure(cohortRowsMap, `${date}::${cohort}`, { date, cohort, ...empty() }), lead);
  } else {
    const bucket = directBucketOfVariant(variant);
    addLead(ensure(directRowsMap, `${date}::${bucket}`, { date, bucket, variant, ...empty() }), lead);
  }
}
for (const row of meta.byDateAd.values()) {
  const matching = [...adRowsMap.values()].filter((item) => item.date === row.date && item.ad_id === row.ad_id);
  const totalLeads = matching.reduce((sum, item) => sum + item.leads, 0) || adLeadCountsByDate.get(`${row.date}::${row.ad_id}`) || 0;
  for (const item of matching) {
    const share = totalLeads ? item.leads / totalLeads : 0;
    item.spend += row.spend * share; item.impressions += Math.round(row.impressions * share); item.clicks += Math.round(row.clicks * share);
    const cohort = ensure(cohortRowsMap, `${row.date}::${item.cohort}`, { date: row.date, cohort: item.cohort, ...empty() });
    cohort.spend += row.spend * share; cohort.impressions += Math.round(row.impressions * share); cohort.clicks += Math.round(row.clicks * share);
  }
}
const bookingRows = [];
for (const { ob, lead } of matchedObs) {
  if (!lead) continue;
  const date = dayIst(ob.created_at);
  const variant = variantOf(lead);
  const cohort = cohortOfVariant(variant);
  const source = sourceTypeOf(lead);
  if (source === 'Paid Ad') {
    const adId = adIdOf(lead);
    const adRow = ensure(adRowsMap, `${date}::${cohort}::${variant}::${adId}`, { date, cohort, variant, ad_id: adId, ad_name: adNameOf(lead), adset_name: lead.adset_name || '', campaign_name: lead.campaign_name || lead.utm_campaign || '', ...empty() });
    adRow.ob += 1; if (ob.is_onboarding_done) adRow.obDone += 1;
    const cohortRow = ensure(cohortRowsMap, `${date}::${cohort}`, { date, cohort, ...empty() });
    cohortRow.ob += 1; if (ob.is_onboarding_done) cohortRow.obDone += 1;
  } else {
    const bucket = directBucketOfVariant(variant);
    const directRow = ensure(directRowsMap, `${date}::${bucket}`, { date, bucket, variant, ...empty() });
    directRow.ob += 1; if (ob.is_onboarding_done) directRow.obDone += 1;
  }
  bookingRows.push({ date, booked_at_ist: toIst(ob.created_at), source_type: source, cohort, variant, ad_id: adIdOf(lead) || 'NO_AD', ad_name: adNameOf(lead), ob_done: Boolean(ob.is_onboarding_done), phone_last4: norm(ob.phone_number).slice(-4) });
}
for (const row of [...cohortRowsMap.values(), ...directRowsMap.values()]) {
  const key = `${row.date}::${row.cohort || row.bucket}`;
  const daily = ensure(dailyRowsMap, key, { date: row.date, label: row.cohort || row.bucket, ...empty() });
  for (const metric of Object.keys(empty())) daily[metric] += row[metric] || 0;
}
const payload = {
  generated_at_ist: toIst(new Date().toISOString()),
  history_start_ist: HISTORY_START_IST,
  cutoff_ist: CUTOFF_IST,
  min_date: range.minDate,
  max_date: range.maxDate,
  meta_error: meta.error,
  cohort_rows: [...cohortRowsMap.values()].map(enrich),
  ad_rows: [...adRowsMap.values()].map(enrich),
  direct_rows: [...directRowsMap.values()].map(enrich),
  daily_rows: [...dailyRowsMap.values()].map(enrich),
  booking_rows: bookingRows,
};
await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ output: OUTPUT_PATH, generated_at_ist: payload.generated_at_ist, min_date: payload.min_date, max_date: payload.max_date, ad_rows: payload.ad_rows.length, direct_rows: payload.direct_rows.length, bookings: payload.booking_rows.length, meta_error: payload.meta_error }, null, 2));
