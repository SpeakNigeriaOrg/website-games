/* Speak Nigeria — shared interactions
   Vendored copy of website/assets/main.js (see assets/_tokens.css in
   this same folder for why - separate deploy, no shared build step).
   Only the mobile-menu toggle at the bottom is actually needed on this
   page - the greeting-rotator and scroll-reveal IIFEs above both
   null-check their target elements and no-op harmlessly here, so the
   whole file is vendored as-is rather than hand-trimmed. */

/* -----------------------------------------------------------
   Rotating greeting under the big Yoruba welcome.
   NOTE FOR TEE: Yoruba, Igbo, and Hausa below are correct.
   The last three are placeholders — please confirm the
   correct "welcome/hello" with a native speaker before launch.
   ----------------------------------------------------------- */
const GREETINGS = [
  { word: "Ẹ káàb" + "o" + "\u0323" + "\u0300", lang: "Yoruba" },   // Uses an explicit decomposed sequence so the dot-below and grave stay attached to the same letter
  { word: "Nnọọ", lang: "Igbo" },   // Uses direct Unicode characters for the dot-below + ogonek-style mark
  { word: "Barka da zuwa", lang: "Hausa" },   // ✓ verified
  { word: "Obọkhian", lang: "Bini" },   // Uses direct Unicode characters for the dot-below mark
  { word: "Í bó sá",           lang: "Ijaw"   },   // ⚠ verify
  { word: "Emedi",       lang: "Efik"   },   // ✓ verified
];

(function greetingRotator() {
  const big = document.querySelector("[data-greeting]");
  const sub = document.querySelector("[data-greeting-sub]");
  if (!big && !sub) return;
  let i = 0;
  const render = () => {
    if (big) big.textContent = GREETINGS[i].word;
    if (sub) sub.textContent = `Welcome in ${GREETINGS[i].lang}`;
  };
  render();
  if (big) big.style.transition = "opacity .3s ease";
  if (sub) sub.style.transition = "opacity .3s ease";
  setInterval(() => {
    i = (i + 1) % GREETINGS.length;
    if (big) big.style.opacity = 0;
    if (sub) sub.style.opacity = 0;
    setTimeout(() => {
      render();
      if (big) big.style.opacity = 1;
      if (sub) sub.style.opacity = 1;
    }, 300);
  }, 3000);
})();

/* Scroll reveal */
(function reveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length || !("IntersectionObserver" in window)) {
    items.forEach(el => el.classList.add("in")); return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  items.forEach(el => io.observe(el));
})();

/* Mobile menu */
(function mobileMenu() {
  const btn = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".mobile-menu");
  if (!btn || !menu) return;
  btn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
})();
