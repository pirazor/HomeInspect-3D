// Backend API (the Modal CPU gateway). The deployed gateway cold-starts the
// GPU functions on demand. Demo mode reads /demo assets directly and never
// touches this. Override at build time with VITE_API_BASE if redeployed.
export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE) ||
  "https://enes-43896--homeinspect3d-gateway.modal.run";

export async function loadDemo() {
  const r = await fetch("/demo/demo.json");
  if (!r.ok) throw new Error("demo manifest missing");
  return r.json();
}

async function postJSON(path, body) {
  const r = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}

export async function uploadVideo(file) {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const r = await fetch(API_BASE + "/upload", { method: "POST", body: fd });
  if (!r.ok) throw new Error("upload failed");
  return r.json(); // { job_id }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Long GPU jobs are spawned server-side (returns a call_id) and polled here.
// A held-open request would exceed Modal's ~150s web limit and get redirected
// (breaking CORS), so we never wait synchronously on the backend.
async function runJob(path, body, { interval = 5000, timeoutMs = 20 * 60 * 1000 } = {}) {
  const { call_id } = await postJSON(path, body);          // spawn -> call_id
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(`${API_BASE}${path}/${call_id}`);
    if (r.status === 202) { await sleep(interval); continue; }  // still running
    if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
    return r.json();
  }
  throw new Error("job timed out");
}

// One pass: metric point cloud + building footprint together.
export const reconstruct = (jobId) => runJob("/reconstruct", { job_id: jobId });
// Separate pass: feed-forward gaussian splat (AnySplat).
export const render = (jobId) => runJob("/render", { job_id: jobId });

export const artifactUrl = (jobId, name) => `${API_BASE}/artifact/${jobId}/${name}`;
