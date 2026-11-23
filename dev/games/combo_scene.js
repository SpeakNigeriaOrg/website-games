// A Who-does-what combination on screen (shared by Puppet Theatre and Windows): its clip where one was chosen,
// over its still, so a clip that is loading, missing or fails never leaves a blank: the still shows meanwhile and
// gets a gentle motion of its own (combo_scene.css). The clips start from their still, so the switch is seamless.
import { el } from './engine/engine.js';

const ART = new URL('./art/', import.meta.url).href;
export const artUrl = (p) => ART + p;

/** `loop`: the clip repeats (Windows); otherwise it plays once and holds its last frame (the theatre). */
export function scene(c, { loop = false } = {}) {
  const node = el('div', `scene motion-${c.motion}`, `<img class="still" src="${ART + c.still}" alt="">`);
  let video = null, zzz = null;
  if (c.video) {
    video = document.createElement('video');
    Object.assign(video, { muted: true, playsInline: true, preload: 'auto', loop, className: 'clip', src: ART + c.video });
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    video.addEventListener('playing', () => node.classList.add('video-on'));
    video.addEventListener('error', () => { video.remove(); video = null; node.classList.remove('video-on'); });
    node.appendChild(video);
  }
  const api = {
    node, combo: c,
    get hasVideo() { return !!video; },
    play() {
      node.classList.add('playing');
      if (video) { try { video.currentTime = 0; } catch {} video.play().catch(() => node.classList.remove('video-on')); }
      // asleep without a clip: z's drift up from the sleeper (the clip shows its own breathing)
      if (c.motion === 'breathe' && !video) {
        clearInterval(zzz);
        let k = 0;
        zzz = setInterval(() => {
          if (!node.isConnected || !node.classList.contains('playing')) return clearInterval(zzz);
          const z = node.appendChild(el('span', 'scene-z', 'z'));
          z.style.left = 40 + (k++ % 3) * 8 + '%';
          z.addEventListener('animationend', () => z.remove());
        }, 700);
      }
    },
    stop() {
      node.classList.remove('playing', 'video-on');
      clearInterval(zzz);
      if (video) { video.pause(); try { video.currentTime = 0; } catch {} }
    },
  };
  return api;
}
