import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Metric point-cloud viewer. Bounding-sphere camera fit: the model is always
// dead-center and fills the frame. Slow auto-orbit until the user takes over.
export default function PointCloudViewer({ url }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!url || !ref.current) return;
    const container = ref.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50, 1, 0.001, 2000);
    const ctl = new OrbitControls(cam, renderer.domElement);
    ctl.enableDamping = true;
    ctl.autoRotate = true;            // demo "plays" on load
    ctl.autoRotateSpeed = 0.7;
    const stopSpin = () => { ctl.autoRotate = false; };
    renderer.domElement.addEventListener("pointerdown", stopSpin, { once: true });
    renderer.domElement.addEventListener("wheel", stopSpin, { once: true, passive: true });
    let raf, disposed = false;

    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      if (w && h && (renderer.domElement.width !== w || renderer.domElement.height !== h)) {
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
    };

    new GLTFLoader().load(url, (g) => {
      if (disposed) return;
      scene.add(g.scene);
      g.scene.updateMatrixWorld(true);

      // ROBUST fit: a min/max bounding box is dragged around by a handful of
      // stray points; frame the 2-98 percentile point mass instead.
      const xs = [], ys = [], zs = [];
      const v = new THREE.Vector3();
      g.scene.traverse((o) => {
        if (o.isPoints) {
          const a = o.geometry.attributes.position;
          const stride = Math.max(1, Math.floor(a.count / 60000));
          for (let i = 0; i < a.count; i += stride) {
            v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
            xs.push(v.x); ys.push(v.y); zs.push(v.z);
          }
        }
      });
      const pct = (arr, p) => {
        const s = Float64Array.from(arr).sort();
        return s[Math.min(s.length - 1, Math.floor(s.length * p))];
      };
      const lo = [pct(xs, 0.02), pct(ys, 0.02), pct(zs, 0.02)];
      const hi = [pct(xs, 0.98), pct(ys, 0.98), pct(zs, 0.98)];
      const center = new THREE.Vector3(
        (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
      const radius = 0.5 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
      const d = radius * 2;

      g.scene.traverse((o) => {
        if (o.isPoints) {
          o.material.size = THREE.MathUtils.clamp(d * 0.003, 0.02, 0.12);
          o.material.sizeAttenuation = true;
          o.material.vertexColors = true;
          o.material.needsUpdate = true;
        }
      });

      // camera at a TRUE pedestrian eye height: 1.8m above the detected
      // ground (the cloud is metric). The orbit then circles at that height,
      // like walking around the house.
      const fov = (cam.fov * Math.PI) / 180;
      const groundY = lo[1];
      const eyeY = groundY + 1.8;
      const dist = (radius / Math.sin(fov / 2)) * 1.15;
      const dirH = new THREE.Vector3(0.6, 0, 0.8).normalize();
      ctl.target.copy(center);
      cam.position.set(center.x + dirH.x * dist, eyeY, center.z + dirH.z * dist);
      cam.near = dist / 100;
      cam.far = dist * 20;
      cam.updateProjectionMatrix();

      // LEVEL sightline (target at eye height): vertical lines stay parallel
      // — no keystone ("wider at top"). The building's height is framed with
      // a lens shift (projection view-offset), the tilt-shift technique.
      ctl.target.y = eyeY;
      // center on the STRUCTURE (walls/roof), not the ground apron — near-
      // field ground points project far below frame and drag the box down
      const structural = [];
      for (let i = 0; i < xs.length; i++) {
        if (ys[i] > groundY + 0.6) structural.push(i);
      }
      const idxs = structural.length > 500 ? structural : xs.map((_, i) => i);
      const measure = () => {
        cam.lookAt(ctl.target);
        cam.updateMatrixWorld(true);
        const nx = [], ny = [];
        for (const i of idxs) {
          v.set(xs[i], ys[i], zs[i]).project(cam);
          nx.push(v.x); ny.push(v.y);
        }
        return {
          x0: pct(nx, 0.02), x1: pct(nx, 0.98),
          y0: pct(ny, 0.02), y1: pct(ny, 0.98),
        };
      };
      // orbit-aware fit: the view auto-rotates, and corner-on azimuths
      // project taller/lower than the starting one. Frame the UNION of the
      // projected boxes across a full revolution so it never drifts out.
      const refine = () => {
        const dNow = cam.position.distanceTo(ctl.target);
        let Y0 = 1e9, Y1 = -1e9, SPAN = 0;
        for (let k = 0; k < 12; k++) {
          const az = (k / 12) * Math.PI * 2;
          cam.position.set(
            ctl.target.x + Math.sin(az) * dNow, eyeY,
            ctl.target.z + Math.cos(az) * dNow);
          const b = measure();
          Y0 = Math.min(Y0, b.y0);
          Y1 = Math.max(Y1, b.y1);
          SPAN = Math.max(SPAN, b.x1 - b.x0, b.y1 - b.y0);
        }
        // TILT the camera down (lower the look point) until the building
        // sits slightly above frame center. Camera position is untouched.
        const halfH = Math.tan(fov / 2) * dNow;
        ctl.target.y -= (0.1 - (Y0 + Y1) / 2) * halfH;
        // zoom so the worst-case azimuth fills 85% (distance only, same height)
        const newDist = dNow * (SPAN / 1.7);
        cam.position.set(
          ctl.target.x + dirH.x * newDist, eyeY,
          ctl.target.z + dirH.z * newDist);
        cam.lookAt(ctl.target);
        cam.updateProjectionMatrix();
      };
      requestAnimationFrame(() => { resize(); refine(); refine(); });
    }, undefined, (e) => console.error("GLB load:", e));

    const loop = () => {
      raf = requestAnimationFrame(loop);
      resize();
      ctl.update();
      renderer.render(scene, cam);
    };
    loop();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ctl.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [url]);
  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
}
