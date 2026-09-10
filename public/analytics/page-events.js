// Pageviews and outbound clicks for a plain static page.
//
// Written once here and copied verbatim into ~/Dev/website and
// ~/Dev/website-games by copy-to-siblings.mjs. Edit this file, never a copy.
//
// Covers every page that is not one of the games: the games landing page at
// games.speaknigeria.org, and all six pages of speaknigeria.org. Those pages
// need exactly the same two things, so they get the same file rather than two
// implementations that drift.
//
// The game-link regex below must list every game. A game missing from it
// silently reports no game_opened, which is the only Google Ads conversion the
// games property has - so it fails quietly and costs attribution.
//
// Load order: consent.js, track.js, then this.
(function () {
    'use strict';

    // Where a link goes, in the terms ANALYTICS.md cares about. The enum is
    // fixed in events.schema.json - adding a value here without adding it there
    // is how a dashboard grows a category nobody can explain.
    function classify(url) {
        var host = url.hostname.replace(/^www\./, '');
        var path = url.pathname;

        if (host === 'yorubadict.com') return 'dictionary';
        if (host === 'games.speaknigeria.org') return 'games';
        if (host === 'speaknigeria.org') {
            return /courses/.test(path) ? 'courses' : 'speaknigeria';
        }
        if (/wiktionary\.org$/.test(host)) return 'wiktionary';
        return null;
    }

    // The three Google Forms on speaknigeria.org/courses.html. Course
    // enrollment, information requests and volunteer sign-ups all leave our
    // domain, so a click is the last thing we can observe - the submission
    // happens somewhere we cannot see. ANALYTICS.md §9.3 has the fix, which is
    // to bring the forms in-house, and why it is not urgent.
    function formName(url, link) {
        if (!/docs\.google\.com|forms\.gle/.test(url.hostname)) return null;
        var context = ((link.textContent || '') + ' ' + (link.getAttribute('aria-label') || '')).toLowerCase();
        if (/volunteer|get involved|join/.test(context)) return 'volunteer';
        if (/enrol|enroll|register|sign up/.test(context)) return 'enrollment';
        return 'info';
    }

    window.snPage = {
        /**
         * @param {string} site  'games' or 'speaknigeria'.
         * @param {object} [opts]
         * @param {boolean} [opts.trackGameLinks]  the games landing page sets
         *   this, so a click through to a game is reported. That is the gap
         *   between arriving and playing, which is where an ad's traffic is
         *   won or lost.
         */
        start: function (site, opts) {
            opts = opts || {};

            window.snAnalytics.init(site, {
                posthog: {
                    // speaknigeria.org, games.speaknigeria.org and
                    // gamemedia.speaknigeria.org share a registrable domain, so
                    // one visitor across all three costs nothing to see.
                    cross_subdomain_cookie: true
                }
            });

            window.snTrack('$pageview', {
                path: location.pathname,
                referrer: document.referrer || ''
            });

            // One delegated listener. Every page here is static HTML with no
            // rerendering, but delegation still beats binding each anchor: it
            // survives anything added later and costs one listener.
            document.addEventListener('click', function (event) {
                var link = event.target.closest && event.target.closest('a[href]');
                if (!link) return;

                var url;
                try {
                    url = new URL(link.href, location.href);
                } catch (err) {
                    return;
                }
                if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

                var form = formName(url, link);
                if (form) {
                    window.snTrack('outbound_form_click', { form: form });
                    return;
                }

                if (opts.trackGameLinks && url.origin === location.origin) {
                    var game = /^\/(phonics|tones|vocab)\//.exec(url.pathname);
                    if (game) {
                        window.snTrack('game_opened', { game: game[1] });
                        return;
                    }
                }

                if (url.origin === location.origin) return;

                var target = classify(url);
                if (target) window.snTrack('outbound_click', { target: target });
            });
        }
    };
})();
