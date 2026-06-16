# HomeInspect-3D

Turn an **exterior walkaround video** of a building into a 3D point-cloud reconstruction, a building **footprint with per-floor plans**, and a photorealistic **Gaussian-splat** render.

This repo is the **static web demo** (built with Vite + React + three.js). The demo is pre-generated and loads entirely from static assets — it makes **no backend calls and uses no GPU on load**. Live reconstruction of your own video runs on a serverless Modal GPU backend, invoked only when you upload a video and click *Generate*.

## Deploy (static hosting)
Serve the repo root as-is: `index.html` + `assets/` + `demo/`. No build step required.

## Demo assets
The Gaussian-splat `demo/scene.ply` (~177 MB) exceeds GitHub's 100 MB-per-file limit, so it is **not** committed here. Upload it to the host's `demo/` directory separately for the splat panel to display; everything else (video, point cloud, floor plans) is included.

---
Research proof-of-concept · Dr. Enes Karaaslan · <enes@connectedwise.com>
