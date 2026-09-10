// Game analytics: the events, and the state needed to describe them.
//
// All three games get the same treatment, so the counting lives here rather
// than in three app.js files that would drift. The call sites stay one-liners.
//
// Event and property names come from analytics/events.schema.json, which is
// the contract shared with the other two repos. A property spelled levelId
// here is levelId everywhere; a site that emits level_id silently drops out of
// every cross-property query.
//
// Load order in index.html: consent.js, track.js, this, then app.js.
(function () {
    'use strict';

    var game = null;          // 'phonics' | 'tones' | 'vocab'
    var contentVersion = null;

    // Per-word state. attemptNumber and the timer belong here rather than in
    // either game, because both need them and neither should keep its own copy.
    var wordShownAt = 0;
    var attemptNumber = 0;
    var wordsAttempted = 0;
    var currentLevelId = null;
    var levelStartedAt = 0;
    var levelWrongCount = 0;
    var playlistStarted = false;

    // A stamp for the vocabulary and level data this session ran against.
    //
    // sessions.json, vocab.json and syllables.json carry no version marker, and
    // the level ids are display strings that embed a level NUMBER - "Level 3:
    // Body Parts (Ẹ̀yà Ara) — speaker1". Reorganising the levels, which the git
    // history shows is routine, can therefore reuse an id for different words.
    // Without a stamp those two runs merge into one series that looks
    // continuous and is not. With it, every query can segment on content.
    //
    // FNV-1a over the level ids and word ids: cheap, stable, and it changes
    // exactly when the content does.
    function stamp(gameData) {
        var text = '';
        for (var i = 0; i < gameData.length; i++) {
            text += gameData[i].levelId + '|';
            var words = gameData[i].words || [];
            for (var j = 0; j < words.length; j++) {
                text += (typeof words[j] === 'string' ? words[j] : words[j].id) + ',';
            }
        }
        var hash = 2166136261;
        for (var k = 0; k < text.length; k++) {
            hash ^= text.charCodeAt(k);
            hash = (hash * 16777619) >>> 0;
        }
        return hash.toString(16);
    }

    // The games name their syllable array differently - phonics builds a word
    // from targetSyllables, tones shows bareSyllables with the tones stripped
    // off, and vocab carries targetSyllables purely so this count is
    // truthful - so it is read through here rather than assuming either shape.
    function syllableCount(word) {
        var list = word.targetSyllables || word.bareSyllables || [];
        return list.length;
    }

    // The word's tone shape, e.g. "mid-high-low". Survives a complete
    // vocabulary replacement, so "which tone shapes are hard" stays answerable
    // across content changes where "which words are hard" does not.
    function tonePattern(word) {
        return (word && word.targetTones) ? word.targetTones.join('-') : '';
    }

    function send(name, props) {
        if (!window.snTrack) return;
        props = props || {};
        props.game = game;
        window.snTrack(name, props);
    }

    window.snGame = {
        // Called once, as soon as the level data is parsed.
        start: function (gameName, gameData) {
            game = gameName;
            contentVersion = stamp(gameData);

            window.snAnalytics.init('games', {
                commonProps: { contentVersion: contentVersion },
                // No Google Ads tag on a page a child plays. COPPA treats
                // cookies as personal information on a child-directed site,
                // and its "support for internal operations" exception covers
                // basic analytics but not advertising. The games LANDING page
                // keeps the tag - it is the adult-facing page, and game_opened
                // is the conversion - which is why this is set here, in the
                // file only the game pages load, rather than per-site.
                //
                // Until 2026-09 the tag DID load here: track.js called
                // loadAds() unconditionally. Verified in production before the
                // fix - gtag/js?id=AW-... was requested on /phonics/, /tones/
                // and /vocab/. Do not remove this without re-reading
                // events.schema.json's childDirectedConstraint.
                ads: false,
                posthog: {
                    // Same registrable domain as speaknigeria.org and
                    // gamemedia.speaknigeria.org, so a visitor is one person
                    // across all three at no cost.
                    cross_subdomain_cookie: true,
                    // Session replay is OFF, and this is the one place it
                    // would have been most useful.
                    //
                    // These games are played by children in Speak Nigeria's
                    // classes - the courses page says ages 5 to 17. Recording
                    // a child's session is not something to switch on because
                    // the data would be interesting, and it is a poor fit for
                    // COPPA's narrow "support for internal operations"
                    // exception, which is what lets a child-directed site use
                    // analytics identifiers at all.
                    //
                    // Do not turn this on without advice. answer_checked
                    // already carries what the replays were wanted for.
                    disable_session_recording: true
                }
            });

            send('$pageview', { path: location.pathname });

            // Ends a level that was in progress. pagehide only, never
            // visibilitychange: these are played in classrooms, where a teacher
            // switching tabs is normal and is not abandonment.
            window.addEventListener('pagehide', function () {
                if (currentLevelId === null) return;
                send('level_abandoned', {
                    levelId: currentLevelId,
                    wordsAttempted: wordsAttempted
                });
            });
        },

        playlistSelected: function (category, levelCount) {
            send('playlist_selected', { category: category, levelCount: levelCount });
        },

        levelLoaded: function (level, speaker) {
            currentLevelId = level.levelId;
            levelStartedAt = Date.now();
            levelWrongCount = 0;
            wordsAttempted = 0;

            if (!playlistStarted) {
                playlistStarted = true;
                send('game_start', {
                    category: level.category,
                    levelId: level.levelId,
                    speaker: speaker
                });
            }
        },

        levelComplete: function (level) {
            send('level_complete', {
                levelId: level.levelId,
                category: level.category,
                wordCount: level.words.length,
                durationMs: Date.now() - levelStartedAt,
                totalWrong: levelWrongCount
            });
        },

        wordShown: function (word, level) {
            wordShownAt = Date.now();
            attemptNumber = 0;
            wordsAttempted++;

            send('word_shown', {
                levelId: level.levelId,
                word: word.id,
                syllableCount: syllableCount(word),
                tonePattern: tonePattern(word),
                speaker: word.speaker
            });
        },

        // extras carries the per-game detail: expectedTones/chosenTones/
        // wrongIndexes for tones, expectedSyllables/submittedQueue for
        // phonics, chosenWord/choiceCount for vocab.
        answer: function (word, level, correct, extras) {
            attemptNumber++;
            if (!correct) levelWrongCount++;

            var props = {
                levelId: level.levelId,
                word: word.id,
                correct: correct,
                attemptNumber: attemptNumber,
                msSinceWordShown: Date.now() - wordShownAt,
                speaker: word.speaker,
                syllableCount: syllableCount(word)
            };
            for (var key in extras) {
                if (Object.prototype.hasOwnProperty.call(extras, key)) props[key] = extras[key];
            }
            send('answer_checked', props);
        },

        hint: function (kind) {
            send('hint_used', { kind: kind });
        },

        audio: function (word, scope, syllableIndex) {
            var props = { word: word.id, scope: scope, speaker: word.speaker };
            if (typeof syllableIndex === 'number') props.syllableIndex = syllableIndex;
            send('audio_replayed', props);
        },

        skipped: function (word, level) {
            send('word_skipped', {
                levelId: level.levelId,
                word: word.id,
                attemptsBeforeSkip: attemptNumber
            });
        },

        back: function () {
            send('word_back', {});
        },

        fullscreen: function (on) {
            send('fullscreen_toggled', { on: on });
        },

        // Attempts on the current word, for a caller that needs to bound how
        // often it reports. Phonics uses it: its queue slides, so once full
        // every further tap is another full-and-wrong state.
        attempts: function () { return attemptNumber; }
    };
})();
