// The one place any of the three sites talks to an analytics service.
//
// Written once here and copied verbatim into ~/Dev/website and
// ~/Dev/website-games by copy-to-siblings.mjs. Edit this file, never a copy.
//
// Call sites know two things: the name of the event and its properties. They
// do not know what PostHog is. Swapping tools later touches this file and
// nothing else, which is the entire reason it exists.
//
// A classic script, not a module, because two of the three sites load their
// JavaScript with a plain <script src>. Defines window.snAnalytics and
// window.snTrack.
//
// Load consent.js before this file.
(function () {
  'use strict';

  // Write-only, and designed to be public: it ships in the page source of three
  // public websites. The key that must never appear here is a personal API key
  // (phx_), which reads the whole account.
  var PROJECT_KEY = 'phc_rJ3SDcxjBM7gWPMoK5NaBZKQKzmXq93WG6M2CNhU2uXb';
  var API_HOST = 'https://us.i.posthog.com';
  var ASSET_HOST = 'https://us-assets.i.posthog.com';

  // The Google Ads tag. Google's own instructions say to paste its snippet into
  // the head of every page; we deliberately do not, for two reasons.
  //
  // Consent: under basic consent mode nothing may load before an answer, and a
  // snippet in the head loads immediately. Here it is fetched only after
  // snConsent.ready resolves true.
  //
  // Paint: on the dictionary, test/paint-budget.test.mjs fails the build if
  // anything heavy is requested before the largest paint. init() takes a
  // waitFor promise for exactly this - see afterPaint() in public/app.js.
  var ADS_ID = 'AW-18342577340';

  var VALID_SITES = ['yorubadict', 'games', 'speaknigeria'];

  var queue = [];
  var ready = false;
  var adsReady = false;
  var refused = false;
  var commonProps = {};
  var site = null;

  // Events fired before the tag is ready are queued, not dropped. There is a
  // real gap to cover: consent resolution is a network round trip, and on the
  // dictionary the tag also waits for the largest paint. A reader can search
  // and open three words inside that window.
  //
  // The queue is bounded. If consent is refused the events are discarded
  // rather than held, and if something goes wrong badly enough that the tag
  // never loads, we would rather lose events than grow an array forever.
  var QUEUE_LIMIT = 100;

  function flush() {
    for (var i = 0; i < queue.length; i++) {
      window.posthog.capture(queue[i].name, queue[i].props);
      conversion(queue[i].name, queue[i].props);
    }
    queue = [];
  }

  function track(name, props) {
    if (refused) return;

    var payload = { site: site };
    var key;
    for (key in commonProps) {
      if (Object.prototype.hasOwnProperty.call(commonProps, key)) payload[key] = commonProps[key];
    }
    for (key in props) {
      if (Object.prototype.hasOwnProperty.call(props, key)) payload[key] = props[key];
    }

    if (ready) {
      window.posthog.capture(name, payload);
      // PostHog records what happened; this tells Ads it happened. Both, or
      // neither - a conversion Ads knows about but PostHog does not is a number
      // with nothing behind it to explain.
      conversion(name, payload);
      return;
    }
    if (queue.length < QUEUE_LIMIT) queue.push({ name: name, props: payload });
  }

  // Conversion labels, filled in as each conversion action is created in the
  // Google Ads console. Each is the part after the slash in a send_to value.
  // An event with no label here fires nothing rather than guessing.
  // Keyed by EVENT name, valued with the label of the Google Ads conversion
  // action it should report. Fill one in and that event starts converting; no
  // call site changes, because track() checks this map on every event.
  //
  // An event absent from here reports nothing rather than guessing, which is
  // the state of the six still waiting for their labels.
  var CONVERSION_LABELS = {
    building_block_followed: 'nhWLCM-i0fEcELyJtqpE',
    level_complete: 'jDNDCKO40fEcELyJtqpE',
    // Fires only when the search had results - see CONVERSION_WHEN below.
    search_settled: 'N_yXCJq40fEcELyJtqpE',
    sense_chosen: 'Zo2ZCMyi0fEcELyJtqpE',
    game_opened: 'v-PSCJ240fEcELyJtqpE',
    share_link_created: 'D-Y1CKa40fEcELyJtqpE',
    outbound_form_click: 'yjufCKC40fEcELyJtqpE'
  };

  // Events that convert only sometimes. A search that found nothing is not a
  // success, so search_settled reports a conversion only when it had results.
  var CONVERSION_WHEN = {
    search_settled: function (props) { return props.resultCount > 0; }
  };

  function loadAds() {
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ADS_ID;
      script.async = true;
      // A failure to load the Ads tag must not stop PostHog, so this resolves
      // either way rather than rejecting.
      script.onload = function () {
        window.gtag('js', new Date());
        // Cross-domain measurement across all three sites.
        //
        // The attribution cookie the Ads tag sets cannot cross a registrable
        // domain, and yorubadict.com is one while speaknigeria.org and
        // games.speaknigeria.org are another. Without this, someone who clicks
        // an ad onto the dictionary and then follows one of its nine links to
        // the games arrives there as an unattributed visitor, and a conversion
        // they complete is credited to nobody.
        //
        // Naming the domains here makes gtag decorate links between them with
        // the click id, so the journey survives the hop. It is the same problem
        // ANALYTICS.md notes for PostHog, where cross_subdomain_cookie covers
        // the speaknigeria.org pair and the dictionary needs help.
        window.gtag('config', ADS_ID, {
          linker: {
            domains: ['yorubadict.com', 'speaknigeria.org', 'games.speaknigeria.org']
          }
        });
        adsReady = true;
        resolve();
      };
      script.onerror = function () { resolve(); };
      document.head.appendChild(script);
    });
  }

  /**
   * Report a conversion to Google Ads. Called alongside track(), never instead
   * of it: PostHog records what happened, this tells Ads that it happened.
   *
   * Silent when the event has no label yet, which is the state of every one of
   * them until its conversion action exists in the console.
   */
  function conversion(name, props) {
    var label = CONVERSION_LABELS[name];
    if (!label || !adsReady || refused) return;
    var when = CONVERSION_WHEN[name];
    if (when && !when(props || {})) return;
    window.gtag('event', 'conversion', { send_to: ADS_ID + '/' + label });
  }

  function loadPostHog(options) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = ASSET_HOST + '/static/array.js';
      script.async = true;
      script.onload = function () {
        if (!window.posthog) return reject(new Error('posthog did not define itself'));

        var config = {
          api_host: API_HOST,
          // Off deliberately, and not as a cost measure. Autocapture keys on CSS
          // selectors and DOM position, and both entry-render.js and the games
          // rebuild their markup with innerHTML on every render, so the
          // selectors are not stable across renders. See ANALYTICS.md §5.
          autocapture: false,
          // Every site reports pageviews itself. The dictionary has to, because
          // it is an SPA and the default reports one view for a visit that read
          // twenty entries.
          capture_pageview: false,
          capture_pageleave: true,
          disable_session_recording: true
        };

        var key;
        for (key in options) {
          if (Object.prototype.hasOwnProperty.call(options, key)) config[key] = options[key];
        }

        window.posthog.init(PROJECT_KEY, config);
        resolve();
      };
      script.onerror = function () { reject(new Error('posthog failed to load')); };
      document.head.appendChild(script);
    });
  }

  /**
   * @param {string} siteName  one of VALID_SITES. Becomes the `site` property
   *   on every event, which is what makes one project readable as three sites.
   * @param {object} [opts]
   * @param {Promise} [opts.waitFor]  resolved when the page is done with the
   *   network. The dictionary passes its largest-contentful-paint gate here;
   *   the other two pass nothing. See ANALYTICS.md §5 and app.js.
   * @param {object} [opts.commonProps]  properties added to every event from
   *   this site. The games pass contentVersion here.
   * @param {object} [opts.posthog]  overrides merged into posthog.init config.
   * @param {boolean} [opts.ads=true]  load the Google Ads tag. The game pages
   *   pass false: games.speaknigeria.org is played by children, which puts
   *   COPPA in scope, and its narrow "support for internal operations"
   *   exception covers analytics but NOT advertising. See
   *   events.schema.json's childDirectedConstraint. The games LANDING page
   *   keeps the tag - it is the adult-facing page, and game_opened is the
   *   conversion - so this is per-page rather than per-site.
   */
  function init(siteName, opts) {
    opts = opts || {};

    if (VALID_SITES.indexOf(siteName) === -1) {
      throw new Error('site must be one of ' + VALID_SITES.join(', ') + ', got ' + siteName);
    }
    site = siteName;
    commonProps = opts.commonProps || {};

    var gates = [window.snConsent.ready];
    if (opts.waitFor) {
      // A gate that never resolves must not silently disable analytics
      // forever, so it is bounded. Ten seconds is far past any real paint.
      gates.push(Promise.race([
        opts.waitFor,
        new Promise(function (r) { setTimeout(r, 10000); })
      ]));
    }

    return Promise.all(gates)
      .then(function (results) {
        if (results[0] !== true) {
          refused = true;
          queue = [];
          return;
        }
        var tasks = [
          loadPostHog(opts.posthog || {}).then(function () {
            ready = true;
            flush();
          })
        ];
        // Not on a page a child plays - see the ads option on init above.
        if (opts.ads !== false) tasks.push(loadAds());
        return Promise.all(tasks);
      })
      .catch(function () {
        // A failure to load analytics is never a failure of the page. Drop the
        // queue and carry on: nothing above this line is worth showing a
        // reader an error over.
        refused = true;
        queue = [];
      });
  }

  window.snAnalytics = { init: init, track: track, conversion: conversion };
  window.snTrack = track;
  window.snConversion = conversion;
})();
