/* Games landing page: the "let me know when the games reach my language" form in #help.

   Sends to the main site's Apps Script web app (website repo, apps-script/inquiry-form.gs) as form=interest - the
   same handler as the "Register interest" form on speaknigeria.org/courses.html - so a signup lands as a row in the
   sheet's "Language interest" tab, the team is emailed and the person gets a confirmation. That handler requires
   name, email, a language and an interest; the interest is fixed here as INTEREST so these rows can be told apart.

   Only a stored signup counts: outbound_form_click {form: 'notify', language} - a PostHog event and a Google Ads
   conversion via track.js - fires once the script answers ok, never on a click or a failed attempt. */
(function notifyForm() {
  const form = document.getElementById("notify");
  if (!form || !window.fetch) return;

  const INTEREST = "Games in my language";
  const SOURCE = "Signed up on games.speaknigeria.org";

  const language = form.elements.language;
  const other = form.elements.other_language;
  const otherField = form.querySelector(".lp-notify-other");
  const status = form.querySelector(".lp-notify-status");
  const button = form.querySelector("button[type=submit]");
  const FALLBACK = 'Sorry, that didn\'t send. Please try again, or email <a href="mailto:hello@speaknigeria.org?subject=Games%20in%20my%20language">hello@speaknigeria.org</a>.';

  // The script drops anything sent within 3 seconds of this, as bot-speed.
  let started = 0;
  form.addEventListener("focusin", () => { if (!started) started = Date.now(); });

  function say(text, isHtml) {
    if (isHtml) status.innerHTML = text;
    else status.textContent = text;
  }

  language.addEventListener("change", () => {
    const isOther = language.value === "other";
    otherField.hidden = !isOther;
    other.required = isOther;
    if (isOther) other.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.elements.name.value.trim();
    const email = form.elements.email;
    if (!language.value) { say("Please choose a language."); language.focus(); return; }
    if (language.value === "other" && !other.value.trim()) { say("Please tell us which language."); other.focus(); return; }
    if (!name) { say("Please tell us your name."); form.elements.name.focus(); return; }
    if (!email.value.trim() || !email.checkValidity()) { say("Please enter a valid email address."); email.focus(); return; }

    const option = language.options[language.selectedIndex];
    const data = new URLSearchParams({
      form: "interest",
      name,
      email: email.value.trim(),
      interests: INTEREST,
      message: SOURCE,
      website: form.elements.website.value,
      started: String(started || Date.now())
    });
    if (language.value === "other") data.set("other_language", other.value.trim());
    else data.set("languages", option.dataset.sheet || option.text);

    button.disabled = true;
    say("Sending…");
    let ok = false;
    try {
      const res = await fetch(form.dataset.endpoint, { method: "POST", body: data });
      const out = await res.json();
      ok = out.ok === true;
    } catch (err) {
      ok = false;
    }

    if (!ok) {
      button.disabled = false;
      say(FALLBACK, true);
      return;
    }

    if (typeof window.snTrack === "function") {
      window.snTrack("outbound_form_click", { form: "notify", language: language.value });
    }
    const langName = language.value === "other" ? other.value.trim() : option.text;
    form.querySelector(".lp-notify-fields").hidden = true;
    say(`Thank you! We've emailed you a confirmation, and we'll let you know when the games are ready in ${langName}.`);
  });
})();
