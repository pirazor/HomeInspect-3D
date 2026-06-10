# HomeInspect-3D

Static web UI for a **home-inspection 3D reconstruction** proof-of-concept. Upload a
handful of sparse room photos and get an interactive 3D point cloud in the browser.

## Files
- **`index.html`** — the entire single-page app (a three.js point-cloud viewer, no build
  step). It POSTs the photos to a serverless GPU API and renders the returned `.glb`.
  The API endpoint is set in `API_BASE` near the top of the `<script type="module">` block.
- **`demo/`** — sample inspection photos loaded by the "Use demo photos" button.

## Deploy
It's a plain static site — serve the folder as-is (any static host, or import this repo
into bolt.new / Netlify / Vercel / GitHub Pages). No backend is bundled here; the GPU
reconstruction runs behind the `API_BASE` URL.

> For production, lock the API's CORS `allow_origins` to this site's domain.

---

A non-commercial research proof-of-concept. Created by **Dr. Enes Karaaslan**
(enes@connectedwise.com). Model weights licensed under
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).
