# HomeInspect-3D

Turn an **exterior walkaround video** of a building into a 3D point-cloud reconstruction, a building **footprint with per-floor plans**, and a photorealistic **Gaussian-splat** render.

**Vite + React + three.js** web UI. The demo loads entirely from static `/demo` assets — it makes **no backend calls and uses no GPU on page load**. Live reconstruction of your own video runs on a serverless Modal GPU backend, invoked only when you upload a video and click *Generate*.

## Develop
```bash
npm install
npm run dev        # http://localhost:5174
```

## Build & deploy (Hostinger / any static host)
```bash
npm install
npm run build      # outputs static site to dist/
```
Serve `dist/`. Override the backend gateway URL at build time with `VITE_API_BASE`.

## Demo assets
`public/demo/scene.ply` (~177 MB Gaussian splat) exceeds GitHub's 100 MB-per-file limit and is **not** committed. Place it in `public/demo/` before building (or upload it to the host's `demo/` folder) for the splat panel to display; everything else (video, point cloud, floor plans) is included.

---
Research proof-of-concept · Dr. Enes Karaaslan · <enes@connectedwise.com>
