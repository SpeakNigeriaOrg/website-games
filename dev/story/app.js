// --- GLOBAL CONFIGURATION ---
// Image (and eventually audio) bytes live in R2, not this deploy, same as
// the phonics game. During local development `python3 -m http.server
// --directory dev` serves this game on :8000 with the working images
// reachable at /story-media/, so the port check keeps local play (including
// phone-over-LAN testing) pointed at local files. Story JSON always ships
// same-origin (stories.json + stories/<id>.json).
const IS_LOCAL = location.port === "8000";
const BASE_URL = IS_LOCAL ? "/story-media/" : "https://gamemedia.speaknigeria.org/story/";
// ----------------------------

let storiesIndex = [];
let currentStory = null;
let sceneIndex = 0;
let foundIds = new Set();
let isTransitioning = false;

let toastTimeout = null;
function showToast(text, variant = "info", duration = 1400) {
    const el = document.getElementById("toast");
    clearTimeout(toastTimeout);
    el.textContent = text;
    el.className = "show " + variant;
    if (duration) {
        toastTimeout = setTimeout(() => el.classList.remove("show"), duration);
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch((err) => {
            console.warn("Fullscreen request failed or unsupported:", err);
        });
    } else {
        document.exitFullscreen?.();
    }
}

// --- SOUNDS ---
// Same synthesized approach as the phonics game (no sound assets): a lazy
// singleton AudioContext playing short sine notes. playDing is note-for-note
// the phonics correct-answer chime; the womp is its gentler, descending
// wrong-tap cousin; the fanfare marks finishing a story.
let chimeAudioCtx = null;
function playChime(freqs, { gain = 0.25, noteGap = 0.12 } = {}) {
    try {
        chimeAudioCtx = chimeAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        chimeAudioCtx.resume?.();
        const now = chimeAudioCtx.currentTime;
        freqs.forEach((freq, i) => {
            const osc = chimeAudioCtx.createOscillator();
            const gainNode = chimeAudioCtx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const start = now + i * noteGap;
            gainNode.gain.setValueAtTime(0, start);
            gainNode.gain.linearRampToValueAtTime(gain, start + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
            osc.connect(gainNode).connect(chimeAudioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.32);
        });
    } catch (err) {
        console.warn("Could not play chime:", err);
    }
}
const playDing = () => playChime([660, 880]);
const playWomp = () => playChime([330, 262], { gain: 0.16 });
const playFanfare = () => playChime([523, 659, 784, 1047]);

// --- STORY PICKER ---
async function init() {
    try {
        const res = await fetch("stories.json");
        storiesIndex = (await res.json()).stories;
    } catch (err) {
        document.querySelector("#story-menu h2").textContent = "Could not load stories.";
        console.error(err);
        return;
    }
    const cards = document.getElementById("story-cards");
    cards.innerHTML = "";
    for (const story of storiesIndex) {
        const card = document.createElement("button");
        card.className = "story-card";
        const cover = document.createElement("img");
        cover.src = BASE_URL + story.cover;
        cover.alt = "";
        const title = document.createElement("span");
        title.className = "story-title";
        title.lang = "yo";
        title.textContent = story.title || story.id;
        const meta = document.createElement("span");
        meta.className = "story-meta";
        meta.textContent = story.titleEnglish
            ? `${story.titleEnglish} · ${story.sceneCount} scenes`
            : `${story.sceneCount} scenes`;
        card.append(cover, title, meta);
        card.addEventListener("click", () => startStory(story.id));
        cards.appendChild(card);
    }
}

function showStoryMenu() {
    document.getElementById("start-overlay").style.display = "flex";
    document.getElementById("congrats").hidden = true;
}

async function startStory(storyId) {
    const res = await fetch(`stories/${storyId}.json`);
    currentStory = await res.json();
    document.getElementById("start-overlay").style.display = "none";
    replayStory();
}

function replayStory() {
    sceneIndex = 0;
    document.getElementById("congrats").hidden = true;
    document.getElementById("instruction-bar").hidden = false;
    document.getElementById("stage").hidden = false;
    loadScene();
}

// --- SCENE LIFECYCLE ---
const currentScene = () => currentStory.scenes[sceneIndex];

function loadScene() {
    const scene = currentScene();
    foundIds = new Set();
    isTransitioning = false;
    document.getElementById("after-sheet").hidden = true;
    document.getElementById("instruction-text").textContent = scene.instruction.yo;
    updateCounter();

    const img = document.getElementById("scene-img");
    img.onload = renderOverlay;
    img.src = BASE_URL + scene.image;

    // Warm the next scene's image so the story advances without a visible load.
    const next = currentStory.scenes[sceneIndex + 1];
    if (next) new Image().src = BASE_URL + next.image;
}

function renderOverlay() {
    const scene = currentScene();
    const svg = document.getElementById("overlay");
    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${scene.width} ${scene.height}`);
    for (const seg of scene.segments) {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.dataset.segId = seg.id;
        for (const ring of seg.polygons) {
            const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            poly.setAttribute(
                "points",
                ring.map(([x, y]) => `${x * scene.width},${y * scene.height}`).join(" ")
            );
            group.appendChild(poly);
        }
        svg.appendChild(group);
    }
    // A scene with no targets is a plain story beat: no taps to wait for.
    if (targetCount() === 0) sceneComplete();
}

const targetCount = () => currentScene().segments.filter((s) => s.target).length;

function updateCounter() {
    const counter = document.getElementById("found-counter");
    counter.innerHTML = "";
    const total = currentStory ? targetCount() : 0;
    if (total < 2) return; // a lone dot reads as clutter, not progress
    currentScene().segments.filter((s) => s.target).forEach((seg) => {
        const dot = document.createElement("span");
        dot.className = "dot" + (foundIds.has(seg.id) ? " filled" : "");
        counter.appendChild(dot);
    });
}

// --- TAP HANDLING ---
document.getElementById("stage").addEventListener("click", (event) => {
    if (isTransitioning || !currentStory) return;
    if (!document.getElementById("after-sheet").hidden) return;
    const group = event.target.closest("g[data-seg-id]");
    const seg = group && currentScene().segments.find((s) => s.id === group.dataset.segId);

    if (seg && seg.target) {
        if (foundIds.has(seg.id)) return; // already found: inert, no penalty
        foundIds.add(seg.id);
        group.classList.add("found");
        playDing();
        updateCounter();
        if (foundIds.size === targetCount()) sceneComplete();
    } else {
        // Decoy segment or background: gentle sound + ripple, no penalty.
        playWomp();
        showRipple(event);
    }
});

function showRipple(event) {
    const scene = currentScene();
    const svg = document.getElementById("overlay");
    const rect = svg.getBoundingClientRect();
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", ((event.clientX - rect.left) / rect.width) * scene.width);
    circle.setAttribute("cy", ((event.clientY - rect.top) / rect.height) * scene.height);
    circle.setAttribute("r", scene.width * 0.02);
    circle.setAttribute("class", "ripple");
    svg.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
}

// --- SCENE / STORY COMPLETION ---
function sceneComplete() {
    isTransitioning = true;
    const scene = currentScene();
    // Short beat so the last found-highlight registers before the sheet.
    setTimeout(() => {
        if (scene.after && scene.after.yo) {
            document.getElementById("after-text").textContent = scene.after.yo;
            document.getElementById("after-sheet").hidden = false;
        } else {
            nextScene();
        }
    }, 700);
}

function nextScene() {
    sceneIndex++;
    if (sceneIndex < currentStory.scenes.length) {
        loadScene();
    } else {
        showCongrats();
    }
}

function showCongrats() {
    document.getElementById("instruction-bar").hidden = true;
    document.getElementById("stage").hidden = true;
    document.getElementById("after-sheet").hidden = true;
    document.getElementById("congrats").hidden = false;
    playFanfare();
}

init();
