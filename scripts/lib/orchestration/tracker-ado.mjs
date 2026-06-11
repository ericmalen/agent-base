// tracker-ado.mjs — Azure DevOps adapter for tracker-sync (F3, DD-14).
// Zero-dependency REST via global fetch (Node ≥ 20), deliberately NOT an MCP
// server: must run headless in the F4 pipelines. Pure helpers (exported,
// unit-tested) build every request payload; the thin IO functions at the
// bottom only fetch.
//
// Env contract: ADO_ORG, ADO_PROJECT, AZURE_DEVOPS_PAT (PAT is env-only —
// validateTrackerSyncConfig rejects credential-looking config keys).

import { DEFAULT_STATE_MAPS } from './tracker-sync.mjs';

const API = '7.1';

export function adoAuthHeader(pat) {
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
}

export function buildWiql(project) {
  return {
    query:
      `Select [System.Id] From WorkItems ` +
      `Where [System.TeamProject] = '${project.replace(/'/g, "''")}' ` +
      `And [System.WorkItemType] <> 'Test Case' Order By [System.Id]`,
  };
}

// Raw work item (REST workitems response) → normalization contract.
// Unknown states map to state null — computeSyncPlan skips them and the CLI
// reports, so a Scrum-template repo degrades to a warning, not a crash.
export function normalizeAdoItem(workItem, stateMap = 'basic') {
  const map = DEFAULT_STATE_MAPS.ado[stateMap];
  const raw = workItem.fields?.['System.State'];
  const state = Object.entries(map).find(([, v]) => v === raw)?.[0] ?? null;
  return {
    externalId: `AB#${workItem.id}`,
    title: workItem.fields?.['System.Title'] ?? `work item ${workItem.id}`,
    state,
    rawState: raw ?? null,
    url: workItem._links?.html?.href ?? null,
  };
}

// Status update → JSON-Patch document for PATCH workitems/{id}.
export function buildStatePatch(to, stateMap = 'basic') {
  return [{ op: 'add', path: '/fields/System.State', value: DEFAULT_STATE_MAPS.ado[stateMap][to] }];
}

export function workItemIdFromRef(ref) {
  const m = ref.match(/^AB#(\d+)$/);
  return m ? Number(m[1]) : null;
}

// ── thin IO (no unit tests — verified live, DD-9) ───────────────────────────

function baseUrl(org, project) {
  return `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis`;
}

async function adoFetch(url, pat, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: adoAuthHeader(pat),
      'Content-Type': init.contentType ?? 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`ADO ${init.method ?? 'GET'} ${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

// List + normalize all work items in the project.
export async function listItems({ org, project, pat, stateMap = 'basic' }) {
  const wiql = await adoFetch(`${baseUrl(org, project)}/wit/wiql?api-version=${API}`, pat, {
    method: 'POST',
    body: JSON.stringify(buildWiql(project)),
  });
  const ids = (wiql.workItems ?? []).map((w) => w.id);
  if (ids.length === 0) return [];
  const items = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = await adoFetch(
      `${baseUrl(org, project)}/wit/workitems?ids=${ids.slice(i, i + 200).join(',')}&api-version=${API}`,
      pat,
    );
    items.push(...batch.value.map((w) => normalizeAdoItem(w, stateMap)));
  }
  return items;
}

// Apply one status update: set state, then comment when present.
export async function pushUpdate({ org, project, pat, stateMap = 'basic' }, update) {
  const id = workItemIdFromRef(update.externalId);
  if (id === null) throw new Error(`not an ADO ref: ${update.externalId}`);
  await adoFetch(`${baseUrl(org, project)}/wit/workitems/${id}?api-version=${API}`, pat, {
    method: 'PATCH',
    contentType: 'application/json-patch+json',
    body: JSON.stringify(buildStatePatch(update.to, stateMap)),
  });
  if (update.comment) {
    await adoFetch(
      `${baseUrl(org, project)}/wit/workItems/${id}/comments?api-version=${API}-preview.3`,
      pat,
      { method: 'POST', body: JSON.stringify({ text: update.comment }) },
    );
  }
}
