// Deep links to a level, and the share control that produces them.
//
// Neither game touched the address bar before this, so there was no way to
// send anyone a particular level - and the thing a teacher actually wants is
// to hand a class one level, not the site. Traffic here is teacher-driven and
// bursty for exactly that reason.
//
// The URL carries the category and the level id:
//
//   /tones/?level=Tone%20Pattern%20(high-high)%20%E2%80%94%20speaker3&from=share
//
// levelId rather than an index, because the index moves whenever the levels are
// reorganised - which the git history says is routine - and a link that quietly
// opens a different level than it did last week is worse than one that fails.
// If the id is gone, the playlist opens at its first level instead.
//
// Load after game-events.js and before app.js.
(function () {
    'use strict';

    var game = null;

    function params() {
        try {
            return new URLSearchParams(window.location.search);
        } catch (err) {
            return new URLSearchParams('');
        }
    }

    // Built by the game once its levels exist, so the link names a level that
    // is really there.
    function shareUrl(level) {
        var url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('category', level.category);
        url.searchParams.set('level', level.levelId);
        // Its own campaign parameter, so plays that arrive from a shared link
        // are countable without any cross-domain work.
        url.searchParams.set('from', 'share');
        return url.toString();
    }

    window.snShare = {
        /**
         * The level a shared link asked for, or null. Called by the game after
         * its data is loaded, with every level it could offer.
         */
        requested: function (gameName, allLevels) {
            game = gameName;
            var p = params();
            var wanted = p.get('level');
            if (!wanted) return null;

            var match = null;
            for (var i = 0; i < allLevels.length; i++) {
                if (allLevels[i].levelId === wanted) { match = allLevels[i]; break; }
            }

            if (window.snTrack) {
                window.snTrack('share_link_opened', {
                    levelId: wanted,
                    // A link to a level that no longer exists still tells us
                    // the link was opened, which is the thing being measured.
                    resolved: Boolean(match)
                });
            }
            return match ? { level: match, category: p.get('category') || match.category } : null;
        },

        /**
         * Wire the share button. getLevel returns the level to share right now,
         * so the button always names whatever is on screen.
         */
        init: function (gameName, getLevel) {
            game = gameName;
            var button = document.getElementById('share-btn');
            if (!button) return;

            button.addEventListener('click', function () {
                var level = getLevel();
                if (!level) return;
                var url = shareUrl(level);

                function done(method) {
                    if (window.snTrack) {
                        window.snTrack('share_link_created', {
                            levelId: level.levelId,
                            category: level.category,
                            method: method
                        });
                    }
                    if (typeof showToast === 'function') showToast('Link copied', 'info', 1600);
                }

                // The share sheet where there is one, the clipboard otherwise.
                // Note that neither can tell us whether anyone received it: the
                // Web Share API resolves the same whether the person sent the
                // link or dismissed the sheet. A share click is observable; a
                // share is not.
                if (navigator.share) {
                    navigator.share({ title: document.title, url: url })
                        .then(function () { done('share-sheet'); })
                        .catch(function () { /* dismissed - not a share */ });
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url)
                        .then(function () { done('clipboard'); })
                        .catch(function () { window.prompt('Copy this link', url); done('prompt'); });
                    return;
                }
                window.prompt('Copy this link', url);
                done('prompt');
            });
        }
    };
})();
