import { useCallback, useEffect, useRef, useState } from "react";
import PointCloudViewer from "./PointCloudViewer.jsx";
import SplatViewer from "./SplatViewer.jsx";
import FootprintViewer from "./FootprintViewer.jsx";
import * as api from "./api.js";

// React doesn't render the `muted` attribute, which blocks Chrome's autoplay
// policy — force it (and play) imperatively so the demo always plays on load.
function AutoVideo({ src, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    };
    tryPlay();
    v.addEventListener("canplay", tryPlay);
    return () => v.removeEventListener("canplay", tryPlay);
  }, [src]);
  return <video ref={ref} src={src} autoPlay muted loop playsInline {...rest} />;
}

function Led({ status }) {
  return <span className={"led " + (status || "")} title={status} />;
}

function Idle({ mark, children }) {
  return (
    <div className="idle">
      <span className="mark">{mark}</span>
      {children}
    </div>
  );
}

// Running overlay: teal scanline + elapsed seconds.
function Scan({ label }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return (
    <div className="scan">
      <span>{label}</span>
      <small>T+{mm}:{ss} · serverless GPU</small>
    </div>
  );
}

function Meter({ value, label }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="meter">
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

// Labeled connector: names the artifact each stage hands to the next.
function Flow({ label, running, done }) {
  return (
    <div className={"flow" + (running ? " active" : "") + (done ? " done" : "")}>
      <span className="what">{label}</span>
      <div className="track"><span className="pulse" /></div>
    </div>
  );
}

const fmt = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : String(n);

export default function App() {
  const [mode, setMode] = useState("demo");
  const [video, setVideo] = useState(null);            // { url, file }
  const [jobId, setJobId] = useState(null);
  const [recon, setRecon] = useState({ status: "idle", floors: [] });
  const [splat, setSplat] = useState({ status: "idle" });
  const [focus, setFocus] = useState(null);            // 'video'|'cloud'|'plan'|'splat'

  const loadDemo = useCallback(async () => {
    try {
      const d = await api.loadDemo();
      setMode("demo");
      setVideo({ url: d.video, file: null });
      setJobId("demo");
      setRecon({
        status: "ready",
        glbUrl: d.pointcloud,
        floors: (d.footprint && d.footprint.floors) || [],
        meta: d.meta || {},
      });
      setSplat({ status: "ready", url: d.splat, meta: d.meta || {} });
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { loadDemo(); }, [loadDemo]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setFocus(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPickFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setMode("live");
    setVideo({ url: URL.createObjectURL(f), file: f });
    setJobId(null);
    setRecon({ status: "idle", floors: [] });
    setSplat({ status: "idle" });
    setFocus(null);
    e.target.value = "";
  }

  async function ensureJob() {
    if (jobId && jobId !== "demo") return jobId;
    const { job_id } = await api.uploadVideo(video.file);
    setJobId(job_id);
    return job_id;
  }

  // ONE pass: point cloud + footprint together.
  async function generate() {
    setRecon({ status: "running", floors: [] });
    try {
      const id = await ensureJob();
      const r = await api.reconstruct(id);
      setRecon({
        status: "ready",
        glbUrl: r.glb_url || api.artifactUrl(id, "reconstruction.glb"),
        floors: (r.footprint && r.footprint.floors) || [],
        meta: { frames: r.n_frames, points: r.n_points, glb_mb: r.glb_mb },
      });
    } catch (e) {
      console.error(e);
      setRecon({ status: "error", floors: [] });
    }
  }

  async function generateRender() {
    setSplat({ status: "running" });
    try {
      const r = await api.render(jobId);
      setSplat({
        status: "ready",
        url: r.ply_url || api.artifactUrl(jobId, "scene.ply"),
        meta: { gaussians: r.n_gaussians, ply_mb: r.ply_mb },
      });
    } catch (e) {
      console.error(e);
      setSplat({ status: "error" });
    }
  }

  const isDemo = mode === "demo";
  const reconReady = recon.status === "ready";
  const rm = recon.meta || {};
  const sm = splat.meta || {};
  const ground = recon.floors[0];
  const upper = recon.floors[1];

  const focusBody = {
    video: video && <AutoVideo src={video.url} controls />,
    cloud: recon.glbUrl && <PointCloudViewer url={recon.glbUrl} />,
    plan: recon.floors.length > 0 && <FootprintViewer floors={recon.floors} animate={false} />,
    splat: splat.url && <SplatViewer url={splat.url} />,
  };
  const focusTitle = {
    video: "01 · Input — walkaround video",
    cloud: "02 · Reconstruction — metric point cloud",
    plan: "02 · Reconstruction — floor plans",
    splat: "03 · Render — gaussian splat",
  };
  const focusPaper = focus === "plan";

  return (
    <div className="app">
      {/* ── masthead ── */}
      <header className="masthead">
        <h1>HomeInspect <em>3D</em></h1>
        <span className="sep">/</span>
        <span className="sub">Exterior survey — video to digital twin</span>
        <span className={"badge" + (isDemo ? "" : " live")}>{isDemo ? "demo" : "your video"}</span>
        <span className="spacer" />
        <button className="primary" onClick={() => document.getElementById("vid").click()}>
          Upload video
        </button>
        <input id="vid" type="file" accept="video/*,.mp4,.mov" onChange={onPickFile} />
        <button onClick={loadDemo}>Reset to demo</button>
      </header>

      {/* ── instructions ── */}
      <section className="intro">
        <h2>How it works</h2>
        <p>
          Upload an exterior walkaround video of a building. The pipeline reconstructs a
          metric 3D point cloud, extracts the building footprint and per-floor plans, and
          generates a photorealistic, interactive 3D render — in two steps. Or explore the
          pre-generated sample below.
        </p>
      </section>

      {/* ── horizontal pipeline ── */}
      <main className="pipeline">
        {/* 01 — input */}
        <section className="panel p1">
          <div className="phead">
            <span className="pno">01</span>
            <div className="ptitle">
              <b>Input</b>
              <small>Exterior walkaround video</small>
            </div>
            <span className="spacer" />
            <Led status={video ? "ready" : ""} />
          </div>
          <div className="pbody">
            <div className="subview">
              <div className="sublabel">
                source
                <span className="spacer" />
                {video && <button className="expand" onClick={() => setFocus("video")} title="Expand">⛶</button>}
              </div>
              <div className="viewport">
                {video
                  ? <AutoVideo src={video.url} />
                  : <Idle mark="▣">no video</Idle>}
              </div>
            </div>
          </div>
          <div className="pfoot">
            <span className="hint">{isDemo ? "Sample · 2:20 exterior walkaround" : "Your upload"}</span>
          </div>
        </section>

        <Flow label={rm.frames ? `${rm.frames} frames` : "frames"}
              running={recon.status === "running"} done={reconReady} />

        {/* 02 — reconstruction: cloud + plans, ONE generate */}
        <section className="panel p2">
          <div className="phead">
            <span className="pno">02</span>
            <div className="ptitle">
              <b>Reconstruction</b>
              <small>3D Reconstruction and Mapping</small>
            </div>
            <span className="spacer" />
            <Led status={recon.status} />
          </div>
          <div className="pbody">
            <div className="subview">
              <div className="sublabel">
                point cloud · building only
                <span className="spacer" />
                {reconReady && <button className="expand" onClick={() => setFocus("cloud")} title="Expand">⛶</button>}
              </div>
              <div className="viewport">
                {recon.status === "running" && <Scan label="Reconstructing" />}
                {recon.status === "error" && <div className="errmsg">reconstruction failed<br />see console</div>}
                {recon.status === "idle" && <Idle mark="◧">awaiting generate</Idle>}
                {reconReady && recon.glbUrl && <PointCloudViewer url={recon.glbUrl} />}
              </div>
            </div>
            <div className="subview">
              <div className="sublabel">
                floor plans · both stories
                <span className="spacer" />
                {reconReady && recon.floors.length > 0 &&
                  <button className="expand" onClick={() => setFocus("plan")} title="Expand">⛶</button>}
              </div>
              <div className="viewport paper">
                {recon.status === "running" && <Scan label="Drafting plans" />}
                {recon.status === "idle" && <Idle mark="⌗">generated with the cloud</Idle>}
                {reconReady && (recon.floors.length
                  ? <FootprintViewer floors={recon.floors} />
                  : <Idle mark="⌗">no footprint found</Idle>)}
              </div>
            </div>
          </div>
          <div className="pfoot">
            <div className="meters">
              <Meter value={rm.points && fmt(rm.points)} label="points" />
              <Meter value={recon.floors.length || null} label={recon.floors.length === 1 ? "story" : "stories"} />
              <Meter value={ground && ground.area_m2} label="m² ground" />
              <Meter value={upper && upper.area_m2} label="m² upper" />
            </div>
            <span className="spacer" />
            {isDemo
              ? <span className="hint">Pregenerated — upload to run live</span>
              : <button className="primary" disabled={!video || recon.status === "running"} onClick={generate}>
                  {recon.status === "running" ? "Working…" : "Generate"}
                </button>}
          </div>
        </section>

        <Flow label="frames + poses"
              running={splat.status === "running"} done={splat.status === "ready"} />

        {/* 03 — render */}
        <section className="panel p3">
          <div className="phead">
            <span className="pno">03</span>
            <div className="ptitle">
              <b>Render</b>
              <small>Feed forward Gaussian Splat</small>
            </div>
            <span className="spacer" />
            <Led status={splat.status} />
          </div>
          <div className="pbody">
            <div className="subview">
              <div className="sublabel">
                photoreal · interactive
                <span className="spacer" />
                {splat.status === "ready" && <button className="expand" onClick={() => setFocus("splat")} title="Expand">⛶</button>}
              </div>
              <div className="viewport">
                {splat.status === "running" && <Scan label="Splatting" />}
                {splat.status === "error" && <div className="errmsg">render failed<br />see console</div>}
                {splat.status === "idle" && <Idle mark="✦">run reconstruction first</Idle>}
                {splat.status === "ready" && splat.url && <SplatViewer url={splat.url} />}
              </div>
            </div>
          </div>
          <div className="pfoot">
            <div className="meters">
              <Meter value={sm.gaussians && fmt(sm.gaussians)} label="gaussians" />
              <Meter value={sm.ply_mb && sm.ply_mb + " MB"} label="scene" />
            </div>
            <span className="spacer" />
            {isDemo
              ? <span className="hint">Pregenerated</span>
              : <button className="primary" disabled={!reconReady || splat.status === "running"} onClick={generateRender}>
                  {splat.status === "running" ? "Working…" : "Generate render"}
                </button>}
          </div>
        </section>
      </main>

      {/* ── focus lightbox ── */}
      {focus && focusBody[focus] && (
        <div className="focus" onClick={(e) => { if (e.target === e.currentTarget) setFocus(null); }}>
          <div className="frame">
            <div className="bar">
              {focusTitle[focus]}
              <span className="spacer" />
              <button className="expand" onClick={() => setFocus(null)}>✕ esc</button>
            </div>
            <div className={"viewport" + (focusPaper ? " paper" : "")}>{focusBody[focus]}</div>
          </div>
        </div>
      )}

      {/* ── acknowledgment + disclaimer (centered, under the pipeline) ── */}
      <footer className="colophon">
        <span className="sig">
          Dr. Enes Karaaslan · <a href="mailto:enes@connectedwise.com">enes@connectedwise.com</a>
        </span>
        <span className="disclaimer">
          Research proof-of-concept. A production prototype would require model fine-tuning on real
          inspection photography.
        </span>
      </footer>
    </div>
  );
}
