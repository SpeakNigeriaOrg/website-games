// Authoring flow: pick a story (= folder of images), add scenes, click
// objects to segment them with SAM, accept/label each mask, write the
// instruction + after-description text, save. The server owns all file IO.

const $ = (id) => document.getElementById(id);

const SMALL_TARGET_FRACTION = 0.06; // bbox under 6% of the image's smaller
                                    // dimension ≈ under a kid-friendly 44px
                                    // touch target on a typical phone.

let storyId = null;
let story = null;
let images = [];
let sceneIndex = -1;
let pending = { points: [], labels: [], polygons: [] };
let busy = false;

// --- bootstrapping ---------------------------------------------------------

async function init() {
  const res = await fetch("/api/stories");
  const data = await res.json();
  for (const s of data.stories) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.id + (s.hasJson ? " ✓" : " (new)");
    $("story-select").appendChild(opt);
  }
  $("story-select").addEventListener("change", (e) => e.target.value && openStory(e.target.value));
  $("story-title").addEventListener("input", (e) => { story.title = e.target.value; markDirty(); });
  $("story-title-en").addEventListener("input", (e) => { story.titleEnglish = e.target.value; markDirty(); });
  $("scene-instruction").addEventListener("input", (e) => { currentScene().instruction.yo = e.target.value; markDirty(); });
  $("scene-after").addEventListener("input", (e) => { currentScene().after.yo = e.target.value; markDirty(); });
  $("add-scene-select").addEventListener("change", (e) => {
    if (e.target.value) addScene(e.target.value);
    e.target.value = "";
  });
  $("accept-btn").addEventListener("click", acceptPending);
  $("reset-btn").addEventListener("click", resetPending);
  $("delete-scene-btn").addEventListener("click", deleteScene);
  $("save-btn").addEventListener("click", saveStory);
  $("preview-toggle").addEventListener("change", (e) => {
    resetPending();
    $("stage").classList.toggle("preview", e.target.checked);
  });
  $("overlay").addEventListener("click", onOverlayClick);
}

async function openStory(id) {
  storyId = id;
  const [storyRes, imagesRes] = await Promise.all([
    fetch(`/api/story/${id}`),
    fetch(`/api/images/${id}`),
  ]);
  story = await storyRes.json();
  images = (await imagesRes.json()).images;
  for (const scene of story.scenes) {
    scene.instruction = scene.instruction || { yo: "", audio: null };
    scene.after = scene.after || { yo: "", audio: null };
    scene.segments = scene.segments || [];
  }
  $("story-title").value = story.title || "";
  $("story-title-en").value = story.titleEnglish || "";
  $("story-fields").hidden = false;
  $("scene-section").hidden = false;
  $("save-section").hidden = false;
  $("toolbar").hidden = false;
  const addSel = $("add-scene-select");
  addSel.length = 1;
  for (const img of images) {
    const opt = document.createElement("option");
    opt.value = opt.textContent = img;
    addSel.appendChild(opt);
  }
  renderSceneList();
  if (story.scenes.length) selectScene(0);
  else {
    sceneIndex = -1;
    $("scene-editor").hidden = true;
    $("stage").hidden = true;
    $("empty-msg").hidden = false;
    $("empty-msg").textContent = "Add a scene from the image list on the left.";
  }
}

// --- scenes ----------------------------------------------------------------

const currentScene = () => story.scenes[sceneIndex];

function addScene(filename) {
  const probe = new Image();
  probe.onload = () => {
    const base = filename.replace(/\.[^.]+$/, "");
    let id = base;
    for (let n = 2; story.scenes.some((s) => s.id === id); n++) id = `${base}-${n}`;
    story.scenes.push({
      id,
      image: `${storyId}/${filename}`,
      width: probe.naturalWidth,
      height: probe.naturalHeight,
      instruction: { yo: "", audio: null },
      after: { yo: "", audio: null },
      segments: [],
    });
    markDirty();
    renderSceneList();
    selectScene(story.scenes.length - 1);
  };
  probe.src = `/media/${storyId}/${filename}`;
}

function selectScene(i) {
  sceneIndex = i;
  resetPending();
  const scene = currentScene();
  $("scene-editor").hidden = false;
  $("scene-label").textContent = scene.id;
  $("scene-instruction").value = scene.instruction.yo;
  $("scene-after").value = scene.after.yo;
  $("empty-msg").hidden = true;
  $("stage").hidden = false;
  const img = $("scene-img");
  img.onload = renderOverlay;
  img.src = `/media/${scene.image}`;
  renderSceneList();
  renderSegmentList();
}

function deleteScene() {
  if (!confirm(`Delete scene "${currentScene().id}" and its segments?`)) return;
  story.scenes.splice(sceneIndex, 1);
  markDirty();
  renderSceneList();
  if (story.scenes.length) selectScene(Math.max(0, sceneIndex - 1));
  else openStory(storyId);
}

function renderSceneList() {
  const ul = $("scene-list");
  ul.innerHTML = "";
  story.scenes.forEach((scene, i) => {
    const li = document.createElement("li");
    li.className = i === sceneIndex ? "active" : "";
    const thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.src = `/media/${scene.image}`;
    const name = document.createElement("span");
    name.textContent = `${i + 1}. ${scene.id} (${scene.segments.length} seg)`;
    li.append(thumb, name);
    li.addEventListener("click", () => selectScene(i));
    ul.appendChild(li);
  });
}

// --- segmentation ----------------------------------------------------------

function onOverlayClick(event) {
  if (busy || sceneIndex < 0) return;
  if ($("stage").classList.contains("preview")) return previewTap(event);
  const scene = currentScene();
  const rect = $("overlay").getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * scene.width);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * scene.height);
  pending.points.push([x, y]);
  pending.labels.push(event.shiftKey ? 0 : 1);
  requestSegment();
}

async function requestSegment() {
  busy = true;
  $("stage").classList.add("busy");
  $("pending-box").hidden = false;
  $("pending-status").textContent = "Segmenting…";
  renderOverlay();
  try {
    const res = await fetch("/api/segment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: currentScene().image,
        points: pending.points,
        labels: pending.labels,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    pending.polygons = data.polygons;
    const scene = currentScene();
    const tooSmall =
      Math.min(data.bbox_frac[0] * scene.width, data.bbox_frac[1] * scene.height) <
      SMALL_TARGET_FRACTION * Math.min(scene.width, scene.height);
    $("pending-status").textContent = pending.polygons.length
      ? `Mask found (${pending.points.length} point${pending.points.length > 1 ? "s" : ""}). ` +
        `Click adds, shift-click removes.` +
        (tooSmall ? " ⚠ Small target — may be hard to tap on a phone." : "")
      : "No mask — try clicking closer to the object's centre.";
  } catch (err) {
    $("pending-status").textContent = `Segmentation failed: ${err.message}`;
  } finally {
    busy = false;
    $("stage").classList.remove("busy");
    renderOverlay();
  }
}

function acceptPending() {
  if (!pending.polygons.length) return;
  const scene = currentScene();
  let n = scene.segments.length + 1;
  while (scene.segments.some((s) => s.id === `seg-${n}`)) n++;
  scene.segments.push({
    id: `seg-${n}`,
    label: $("pending-label").value.trim() || `segment ${n}`,
    target: $("pending-target").checked,
    polygons: pending.polygons,
  });
  $("pending-label").value = "";
  $("pending-target").checked = true;
  markDirty();
  resetPending();
  renderSceneList();
}

function resetPending() {
  pending = { points: [], labels: [], polygons: [] };
  $("pending-box").hidden = true;
  renderOverlay();
  renderSegmentList();
}

// --- overlay rendering ------------------------------------------------------

function renderOverlay() {
  const svg = $("overlay");
  svg.innerHTML = "";
  if (sceneIndex < 0) return;
  const scene = currentScene();
  svg.setAttribute("viewBox", `0 0 ${scene.width} ${scene.height}`);
  for (const seg of scene.segments) {
    for (const ring of seg.polygons) {
      svg.appendChild(makePolygon(ring, scene, seg.target ? "seg-target" : "seg-decoy", seg));
    }
  }
  for (const ring of pending.polygons) {
    svg.appendChild(makePolygon(ring, scene, "seg-pending"));
  }
  pending.points.forEach(([x, y], i) => {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", scene.width * 0.007);
    dot.setAttribute("class", pending.labels[i] ? "pt-pos" : "pt-neg");
    svg.appendChild(dot);
  });
}

function makePolygon(ring, scene, className, seg) {
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  poly.setAttribute("points", ring.map(([x, y]) => `${x * scene.width},${y * scene.height}`).join(" "));
  poly.setAttribute("class", className);
  if (seg) poly.dataset.segId = seg.id;
  return poly;
}

// Preview mode mirrors the game's hit-testing: transparent SVG polygons with
// pointer events. A tap that lands on a polygon flashes; background does not.
function previewTap(event) {
  const poly = event.target.closest("polygon");
  if (!poly) return;
  const seg = currentScene().segments.find((s) => s.id === poly.dataset.segId);
  const cls = seg && seg.target ? "flash-hit" : "flash-miss";
  for (const p of $("overlay").querySelectorAll(`[data-seg-id="${poly.dataset.segId}"]`)) {
    p.classList.remove("flash-hit", "flash-miss");
    void p.getBBox(); // restart the animation
    p.classList.add(cls);
  }
}

// --- segment list ------------------------------------------------------------

function segmentBBox(seg, scene) {
  const xs = seg.polygons.flat().map(([x]) => x * scene.width);
  const ys = seg.polygons.flat().map(([, y]) => y * scene.height);
  return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function renderSegmentList() {
  const ul = $("segment-list");
  ul.innerHTML = "";
  if (sceneIndex < 0) return;
  const scene = currentScene();
  scene.segments.forEach((seg, i) => {
    const li = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = seg.target ? "#1a7a4a" : "#999";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = `${seg.id}: ${seg.label}`;
    name.title = seg.target ? "tap target" : "decoy (not a target)";
    li.append(swatch, name);
    if (segmentBBox(seg, scene) < SMALL_TARGET_FRACTION * Math.min(scene.width, scene.height)) {
      const warn = document.createElement("span");
      warn.className = "warn";
      warn.textContent = "⚠ small";
      warn.title = "Under ~6% of the image — hard to tap on a phone";
      li.appendChild(warn);
    }
    const toggle = document.createElement("button");
    toggle.textContent = seg.target ? "target" : "decoy";
    toggle.addEventListener("click", () => { seg.target = !seg.target; markDirty(); renderOverlay(); renderSegmentList(); });
    const del = document.createElement("button");
    del.textContent = "✕";
    del.addEventListener("click", () => { scene.segments.splice(i, 1); markDirty(); renderOverlay(); renderSegmentList(); renderSceneList(); });
    li.append(toggle, del);
    li.addEventListener("mouseenter", () => highlightSegment(seg.id, true));
    li.addEventListener("mouseleave", () => highlightSegment(seg.id, false));
    ul.appendChild(li);
  });
}

function highlightSegment(segId, on) {
  for (const p of $("overlay").querySelectorAll(`[data-seg-id="${segId}"]`)) {
    p.classList.toggle("seg-hover", on);
  }
}

// --- saving -------------------------------------------------------------------

function markDirty() {
  $("save-status").textContent = "Unsaved changes";
}

async function saveStory() {
  const res = await fetch(`/api/story/${storyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(story),
  });
  const data = await res.json();
  $("save-status").textContent = data.saved ? `Saved → ${data.saved}` : `Save failed: ${data.error}`;
}

init();
