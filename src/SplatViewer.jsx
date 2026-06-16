import { useEffect, useRef } from "react";

// 3D Gaussian Splatting viewer (mkkellogg). Loaded dynamically so it only
// initializes when a splat is actually shown. Auto-orbits until interaction.
// Default camera = the first input camera (origin, +z forward in the model's
// frame) — guaranteed to look at the subject from a real captured viewpoint.
export default function SplatViewer({ url, up = [0, -1, 0], pos = [0, 0, 0], look = [0, 0, 1] }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!url || !ref.current) return;
    // Give the library its OWN child element so React never fights it over
    // the same DOM node on unmount (the source of the removeChild error).
    const container = ref.current;
    const host = document.createElement("div");
    host.style.cssText = "width:100%;height:100%";
    container.appendChild(host);

    let viewer = null, disposed = false;
    (async () => {
      const GS = await import("@mkkellogg/gaussian-splats-3d");
      if (disposed) return;
      viewer = new GS.Viewer({
        rootElement: host,
        sharedMemoryForWorkers: false,           // no COOP/COEP headers needed
        cameraUp: up,
        initialCameraPosition: pos,
        initialCameraLookAt: look,
        useBuiltInControls: true,
      });
      try {
        await viewer.addSplatScene(url, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: true,
          progressiveLoad: false,
        });
        if (disposed) return;
        viewer.start();
        // demo "plays" on load: slow orbit until the user grabs the scene
        if (viewer.controls) {
          viewer.controls.autoRotate = true;
          viewer.controls.autoRotateSpeed = 0.6;
          const stop = () => { if (viewer && viewer.controls) viewer.controls.autoRotate = false; };
          host.addEventListener("pointerdown", stop, { once: true });
          host.addEventListener("wheel", stop, { once: true, passive: true });
        }
      } catch (e) {
        console.error("splat load:", e);
      }
    })();
    return () => {
      disposed = true;
      try { viewer && viewer.stop && viewer.stop(); } catch (e) {}
      // dispose() is async and its .finally removes its canvas; swallow the
      // rejection if the node is already detached.
      try {
        const p = viewer && viewer.dispose && viewer.dispose();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
      // remove our own host node (no-op if the library already cleared it)
      try { if (host.parentNode === container) container.removeChild(host); } catch (e) {}
    };
  }, [url]);
  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
}
