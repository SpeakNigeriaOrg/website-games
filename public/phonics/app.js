// --- GLOBAL CONFIGURATION ---
// Audio/image bytes live in R2, not this deploy - publishToR2.mjs is the
// real (credential-driven, laptop-independent) automation of that upload
// step. Only vocab.json/syllables.json/sessions.json ship same-origin
// with this page (small, and their validSpeakers/validStyles are
// meaningful only if generated against the bucket's real, just-verified
// state - see that script's header).
const BASE_URL = "https://gamemedia.speaknigeria.org/";

// These can eventually be tied to a UI dropdown menu
let CURRENT_SPEAKER = "speaker1"; 
let CURRENT_IMAGE_STYLE = "cartoon"; 

// Which playlists this game offers. syllable_reinforcement is deliberately
// absent even though sessions.json still defines it. The category is supposed
// to drill the syllable bank through repetition, but measured against the
// shipped data it does the opposite: those levels carry the LARGEST banks of
// any category (about 19 buttons on screen versus 12 on a themed level) and
// the most words, so instead of repeating a few syllables they offer the
// widest choice. Only 2 of the 8 levels repeat syllables noticeably more than
// a Random level does; the other 6 are indistinguishable from Random. They
// were the long levels, not the repetitive ones. No vocabulary is lost by
// dropping them: addCoverageLevels below moves the five words that only they
// carried into Random.
const OFFERED_CATEGORIES = ["themed", "tone_pattern", "endless_practice"];

// Smallest tone-pattern set worth its own level. sessions.json's own
// tone_pattern levels used exact-sequence grouping with an effective floor of
// 4-5, giving 4 levels; the same rule at 3, applied across all three
// speakers, gives 12.
const MIN_PATTERN_WORDS = 3;

// Ceiling on how many buttons a GENERATED level may put on screen. Bank size,
// not word count, is what makes a phonics level hard - every distinct syllable
// in the level becomes a button to scan. Existing Random levels sit around 17
// buttons, so generated ones are held near that. (Upstream's own themed "Time
// & Months" reaches 28; that's its choice and isn't touched.)
const MAX_GENERATED_BANK = 20;
// ----------------------------

let gameData = [];    // every level, every category, unfiltered
let activeLevels = []; // the currently-chosen playlist's levels (see selectPlaylist)
let currentLevelIndex = 0;
let currentWordIndex = 0;

let currentLevel = null;
let currentWord = null;
let queue = [];
let maxSlots = 0;
let isTransitioning = false; 
let currentPlayingAudio = null; 

// Transient overlay message (see #toast in style.css) - replaces a
// permanently-reserved text line with something that only takes up
// space while it's actually showing something.
let toastTimeout = null;
function showToast(text, variant = 'info', duration = 1400) {
    const el = document.getElementById('toast');
    clearTimeout(toastTimeout);
    el.textContent = text;
    el.className = 'show ' + variant;
    if (duration) {
        toastTimeout = setTimeout(() => el.classList.remove('show'), duration);
    }
}

// Optional browser fullscreen - must be called directly from a user
// gesture (this button's click), browsers won't allow it otherwise.
// Note: iOS Safari on iPhone does not support the Fullscreen API for
// arbitrary page content at all (a longstanding Apple platform
// limitation, only <video> supports it there) - this will silently
// no-op on that specific browser, nothing to fix on our end for it.
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch((err) => {
            console.warn('Fullscreen request failed or unsupported:', err);
        });
    } else {
        document.exitFullscreen?.();
    }
}

document.addEventListener('fullscreenchange', () => {
    document.getElementById('fullscreen-btn')?.classList.toggle('active', !!document.fullscreenElement);
});

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Enables each playlist button once we know which categories actually
// have levels for the current data - avoids offering a playlist that
// would open into an empty game.
function initializePlaylistMenu() {
    const counts = {};
    gameData.forEach((level) => { counts[level.category] = (counts[level.category] || 0) + 1; });
    document.querySelectorAll('.playlist-btn').forEach((btn) => {
        btn.disabled = !counts[btn.dataset.category];
    });
}

// sessions.json tags every level with a real `category` field (see
// publishToR2.mjs) - this filters to just that category and starts
// play, rather than mixing all four playlists together in one
// dropdown as before.
function selectPlaylist(category) {
    activeLevels = gameData.filter((level) => level.category === category);
    if (activeLevels.length === 0) return; // shouldn't happen - button would be disabled
    document.getElementById('start-overlay').style.display = 'none';
    initializeThemeSelector();
    loadLevel(0);
}

function showPlaylistMenu() {
    document.getElementById('start-overlay').style.display = 'flex';
}

// Clicking the translucent backdrop itself (not a button inside the
// menu) dismisses it WITHOUT changing the playlist - but only once a
// game is already loaded, so the very first, mandatory choice can't be
// skipped by an accidental backdrop tap.
document.getElementById('start-overlay').addEventListener('click', (event) => {
    if (event.target.id === 'start-overlay' && currentLevel) {
        document.getElementById('start-overlay').style.display = 'none';
    }
});

async function loadGame() {
    try {
        const [wordsResponse, syllablesResponse, sessionsResponse] = await Promise.all([
            fetch('vocab.json'),
            fetch('syllables.json'),
            fetch('sessions.json')
        ]);
        
        const dictionaryWords = await wordsResponse.json();
        const dictionarySyllables = await syllablesResponse.json();
        const sessions = await sessionsResponse.json();
        
        // A level with no validSpeakers has no guaranteed-complete audio for
        // ANY speaker - previously this fell through to a hardcoded default
        // speaker and played anyway, with missing syllables silently dropped
        // from the tappable bank (console.warn only, no visible error). Skip
        // it outright instead: the exporter (exportGameContent.mjs) only
        // ever emits levels it has already verified are fully covered for
        // at least one speaker, so an empty validSpeakers here would mean
        // hand-edited/stale session data, not a normal case to paper over.
        const playableSessions = sessions.filter(session => session.validSpeakers && session.validSpeakers.length > 0);
        const skippedCount = sessions.length - playableSessions.length;
        if (skippedCount > 0) {
            console.warn(`[Unplayable Level] Skipped ${skippedCount} level(s) with no validSpeakers.`);
        }

        // Everything the generated levels need: every (speaker, word) pair that
        // is genuinely playable, gathered from all sessions regardless of
        // category. Audio validity is per-speaker and has nothing to do with
        // which playlist a word happens to be listed under.
        const wordPool = new Map();
        playableSessions.forEach(session => {
            session.validSpeakers.forEach(speaker => {
                session.words.forEach(wordId => {
                    const key = `${speaker}|${wordId}`;
                    if (wordPool.has(key)) return;
                    const word = buildWord(wordId, dictionaryWords[wordId], speaker, dictionarySyllables);
                    if (word) wordPool.set(key, word);
                });
            });
        });

        const sessionLevels = playableSessions.map(session => {
            const levelSpeaker = session.validSpeakers.includes(CURRENT_SPEAKER)
                ? CURRENT_SPEAKER
                : session.validSpeakers[0];

            const sessionWords = [];
            session.words.forEach(wordId => {
                const word = wordPool.get(`${levelSpeaker}|${wordId}`);
                if (word) sessionWords.push(word);
            });

            return {
                levelId: session.levelId,
                category: session.category,
                speaker: levelSpeaker,
                syllablePool: buildSyllablePool(sessionWords, levelSpeaker, dictionarySyllables),
                words: shuffleArray(sessionWords)
            };
        });

        // sessions.json's own tone_pattern levels are replaced wholesale by the
        // generated ones - same grouping rule, lower threshold, all three
        // speakers. The generated set is a strict superset of the four upstream
        // levels, which it reproduces.
        gameData = [
            ...sessionLevels.filter(level =>
                level.category !== 'tone_pattern' && OFFERED_CATEGORIES.includes(level.category)),
            ...buildTonePatternLevels(wordPool, dictionarySyllables)
        ];

        addCoverageLevels(gameData, wordPool, dictionarySyllables);

        initializePlaylistMenu();

    } catch (error) {
        showToast("Error loading game data.", 'error', 0); // 0 = stays until reload, this isn't transient
        console.error("Failed to load game data:", error);
    }
}

// --- LEVEL BUILDING -----------------------------------------------------
// syllables.json and vocab.json are not uniformly NFC-normalized (a handful of
// syllables are stored as a precomposed accented vowel plus a trailing
// combining dot below - "bọ́" as b + U+00F3 + U+0323 - which renders the same
// but is a different string). The two files happen to agree byte-for-byte
// today, so raw lookups work, but that's luck rather than a guarantee. These
// helpers normalize on both sides so a future data refresh can't silently
// break the syllable bank.
function normalizeSyllable(text) {
    return text.normalize("NFC");
}

function lookupSyllable(syllable, speaker, dictionarySyllables) {
    const table = dictionarySyllables[speaker];
    if (!table) return null;
    return table[syllable] || table[normalizeSyllable(syllable)] || null;
}

// One playable word for one speaker, or null.
//
// A word is only playable if it has a real image AND every one of its
// syllables has audio for this speaker. That second condition matters: the
// bank is built from the level's syllables, so a syllable with no audio simply
// has no button, and the word becomes impossible to complete. The old code
// pushed the word anyway and console.warn'd about the missing button. Verified
// against the shipped data: 0 of the words in any session fail this, so
// applying it strictly changes no existing level - it just makes the generated
// levels below safe to build.
function buildWord(wordId, wordData, speaker, dictionarySyllables) {
    const imageStyles = wordData?.imageStyles || [];
    if (!wordData) return null;

    if (imageStyles.length === 0) {
        console.error(`[Missing Image] "${wordId}" has no labeled image - excluding it.`);
        return null;
    }

    const missing = wordData.syllables.filter(s => !lookupSyllable(s, speaker, dictionarySyllables)?.audio);
    if (missing.length > 0) {
        console.error(`[Missing Syllable Audio] "${wordId}" for ${speaker} lacks ${missing.join(', ')} - excluding it (it would be unsolvable: no button).`);
        return null;
    }

    const chosenStyle = imageStyles.includes(CURRENT_IMAGE_STYLE) ? CURRENT_IMAGE_STYLE : imageStyles[0];

    return {
        id: wordId,
        targetWord: wordData.displayText,
        targetSyllables: wordData.syllables,
        targetTones: wordData.syllables.map(s => lookupSyllable(s, speaker, dictionarySyllables).tone),
        speaker,
        fullAudioUrl: `${BASE_URL}words/${speaker}/${wordId}.wav`,
        imageUrl: `${BASE_URL}images/${chosenStyle}/${wordId}.png`
    };
}

// The tappable bank for a level: every distinct syllable across its words,
// deduped, each with its audio and tone. This is the level's real difficulty -
// one button per entry.
function buildSyllablePool(words, speaker, dictionarySyllables) {
    const pool = [];
    const seen = new Set();
    words.forEach((word) => {
        word.targetSyllables.forEach((syllable) => {
            const key = normalizeSyllable(syllable);
            if (seen.has(key)) return;
            const info = lookupSyllable(syllable, speaker, dictionarySyllables);
            if (!info || !info.audio) return; // buildWord already guarantees this
            seen.add(key);
            pool.push({ text: syllable, audio: info.audio, tone: info.tone });
        });
    });
    return shuffleArray(pool);
}

// Tone Patterns, grouped by EXACT tone sequence, per speaker.
//
// Exact is the point: grouping more loosely would give bigger sets but would
// file a mid-high-low word under a level called "mid-high", and a level whose
// name doesn't describe its answers is worse than no level.
//
// This category earns its keep in phonics in a way it can't elsewhere: the
// bank is sorted into high/mid/low rows, so on a level where every word is
// low-low, every button lands in the low row and the other two rows are empty.
// The tone rule becomes something the player sees, not just hears.
//
// Grouped per speaker because a level plays one voice, and because tone is
// read from that speaker's own syllable entries.
function buildTonePatternLevels(wordPool, dictionarySyllables) {
    const groups = new Map();
    wordPool.forEach((word) => {
        const key = `${word.speaker}|${word.targetTones.join("-")}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(word);
    });

    const levels = [];
    groups.forEach((words) => {
        if (words.length < MIN_PATTERN_WORDS) return;
        const tones = words[0].targetTones;
        const speaker = words[0].speaker;
        levels.push({
            levelId: `Tone Pattern (${tones.join("-")}) — ${speaker}`,
            category: 'tone_pattern',
            speaker,
            distinctTones: new Set(tones).size,
            length: tones.length,
            syllablePool: buildSyllablePool(words, speaker, dictionarySyllables),
            words: shuffleArray(words.slice())
        });
    });

    // Easiest first: fewest distinct tones (an all-one-tone level asks the
    // player to hear no contrast at all), then fewest syllables.
    levels.sort((a, b) =>
        a.distinctTones - b.distinctTones || a.length - b.length || a.levelId.localeCompare(b.levelId));

    console.info(`[Tone Patterns] ${levels.length} generated set(s): ` +
        levels.map(l => `${l.levelId} (${l.words.length})`).join(', '));
    return levels;
}

// Makes sure every playable word actually reaches a player.
//
// Before this, 15 of the 95 playable (speaker, word) pairs appeared in no level
// at all - already recorded, already illustrated, just never listed. Speaker3
// was missing 9 words, about a quarter of what he could teach. Dropping
// syllable_reinforcement would have added a few more to that pile.
//
// Leftovers go into Random, which unlike Themed or Tone Patterns makes no claim
// about what its levels have in common. Words are appended to an existing
// Random level for the same speaker only while that keeps its bank under
// MAX_GENERATED_BANK; otherwise a new level starts. That cap is the whole
// reason this isn't just "add 8 words per level": in phonics every extra
// distinct syllable is another button on screen.
function addCoverageLevels(levels, wordPool, dictionarySyllables) {
    const covered = new Set(levels.flatMap(l => l.words.map(w => `${w.speaker}|${w.id}`)));
    const missing = [];
    wordPool.forEach((word, key) => { if (!covered.has(key)) missing.push(word); });
    if (missing.length === 0) return;

    const bankSize = (words) => new Set(words.flatMap(w => w.targetSyllables.map(normalizeSyllable))).size;
    const added = [];

    missing.forEach((word) => {
        const hosts = levels.filter(l => l.category === 'endless_practice' && l.speaker === word.speaker);
        const host = hosts.find(l => bankSize([...l.words, word]) <= MAX_GENERATED_BANK);
        if (host) {
            host.words.push(word);
            added.push(host);
        } else {
            const level = {
                levelId: `Random Mix — ${word.speaker}`,
                category: 'endless_practice',
                speaker: word.speaker,
                syllablePool: [],
                words: [word]
            };
            levels.push(level);
            added.push(level);
        }
    });

    // Rebuild the bank and re-shuffle every level that grew, so added words
    // aren't always last and their syllables actually get buttons.
    new Set(added).forEach((level) => {
        level.syllablePool = buildSyllablePool(level.words, level.speaker, dictionarySyllables);
        shuffleArray(level.words);
    });

    console.info(`[Coverage] ${missing.length} unreachable word(s) added to Random: ` +
        missing.map(w => `${w.targetWord} (${w.speaker})`).join(', '));
}

// Rebuilt each time selectPlaylist() runs, so it only ever lists levels
// from the currently-chosen playlist, not all four mixed together.
function initializeThemeSelector() {
    const selector = document.getElementById('theme-selector');
    selector.innerHTML = '';
    selector.onchange = null;

    activeLevels.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.innerText = level.levelId;
        selector.appendChild(option);
    });

    selector.onchange = (event) => {
        loadLevel(parseInt(event.target.value));
    };
}

function loadLevel(levelIndex) {
    if (levelIndex >= activeLevels.length) {
        showToast("You've completed this playlist!", 'info', 0);
        return;
    }

    currentLevelIndex = levelIndex;
    currentLevel = activeLevels[currentLevelIndex];
    document.getElementById('theme-selector').value = currentLevelIndex;
    document.getElementById('theme-selector').title = currentLevel.levelId;

    renderBank();
    loadWord(0);
}

function loadWord(wordIndex) {
    currentWordIndex = wordIndex;
    currentWord = currentLevel.words[currentWordIndex];
    
    maxSlots = currentWord.targetSyllables.length;
    queue = []; 
    
    const imgElement = document.getElementById('prompt-image');
    imgElement.onerror = function() {
        this.onerror = null; 
        this.src = 'images/placeholder.png'; 
    };
    imgElement.src = currentWord.imageUrl;
    
    clearTimeout(toastTimeout);
    document.getElementById('toast').classList.remove('show');
    document.getElementById('queue-slots').classList.remove('correct', 'show-hint');
    document.getElementById('correct-badge').classList.remove('show');
    showingHint = false;
    document.getElementById('hint-btn').classList.remove('active');

    renderQueue();
    isTransitioning = false;

    // CHANGE: Removed playFullWordAudio() from here so it doesn't auto-play
}

// Toggle the per-slot tone-hint dots (see style.css's .slot::before) on
// or off - visual instead of the old "Tone Hint: mid mid high" text
// line, and reclaims that line entirely.
let showingHint = false;
function toggleToneHint() {
    if (!currentWord || !currentWord.targetTones || isTransitioning) return;
    showingHint = !showingHint;
    document.getElementById('queue-slots').classList.toggle('show-hint', showingHint);
    document.getElementById('hint-btn').classList.toggle('active', showingHint);
}

// Interrupting our own playback is normal here - every syllable tap stops
// whatever was playing before it - and the interrupted play() promise rejects
// with AbortError. That's the mechanism working, not a failure, so it's
// swallowed; anything else still gets reported. Before this, tapping through
// a level quickly filled the console with red errors that looked like missing
// audio files but weren't.
function reportAudioFailure(context, error) {
    if (error && error.name === 'AbortError') return;
    console.warn(`Audio playback blocked or file missing (${context}):`, error);
}

function playFullWordAudio() {
    if (currentWord && currentWord.fullAudioUrl) {
        const promptAudio = new Audio(currentWord.fullAudioUrl);
        promptAudio.play().catch(error => console.log("Audio play blocked or missing."));
    }
}

function moveToNextWord() {
    const nextWordIndex = currentWordIndex + 1;
    if (nextWordIndex < currentLevel.words.length) {
        loadWord(nextWordIndex);
    } else {
        showToast("Level Complete! Loading next set...", 'info', 1500);
        setTimeout(() => loadLevel(currentLevelIndex + 1), 1500);
    }
}

// Mirrors moveToNextWord() - stays within the current level (no
// wraparound into the previous theme), floors at the first word.
function prevWord() {
    if (isTransitioning) return;
    const prevWordIndex = currentWordIndex - 1;
    if (prevWordIndex >= 0) {
        loadWord(prevWordIndex);
    }
}

function renderBank() {
    const rows = {
        high: document.querySelector('#high-tones .bank-row'),
        mid: document.querySelector('#mid-tones .bank-row'),
        low: document.querySelector('#low-tones .bank-row')
    };
    
    Object.values(rows).forEach(row => row.innerHTML = '');

    currentLevel.syllablePool.forEach(buttonData => {
        const btn = document.createElement('button');
        btn.innerText = buttonData.text;
        btn.onclick = () => handleSyllableClick(buttonData);
        
        const tone = buttonData.tone || 'mid'; 
        btn.className = `btn-${tone}`;
        rows[tone].appendChild(btn);
    });
}

function renderQueue() {
    const slotsDiv = document.getElementById('queue-slots');
    slotsDiv.innerHTML = '';
    
    for (let i = 0; i < maxSlots; i++) {
        const slot = document.createElement('div');
        const tone = currentWord?.targetTones?.[i] || 'mid';
        slot.className = `slot tone-${tone}`;
        slot.innerText = queue[i] || '';
        slotsDiv.appendChild(slot);
    }
}

function handleSyllableClick(buttonData) {
    if (isTransitioning) return; 

    if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0; 
    }

    if (buttonData.audio) {
        const absoluteUrl = BASE_URL + buttonData.audio;
        currentPlayingAudio = new Audio(absoluteUrl);
        currentPlayingAudio.play().catch((err) => reportAudioFailure(absoluteUrl, err));
    }

    queue.push(buttonData.text);
    if (queue.length > maxSlots) queue.shift(); 

    renderQueue();
    checkWinCondition();
}

// ADDITION: Allow the user to skip a difficult word
function skipWord() {
    if (isTransitioning) return; // Prevent spam-clicking
    
    isTransitioning = true;

    showToast("Skipping word...", 'skipping', 800);

    // Wait a brief moment so they can read the message, then move on
    setTimeout(moveToNextWord, 800);
}

function checkWinCondition() {
    const isMatch = queue.length === maxSlots &&
                    queue.every((val, index) => val === currentWord.targetSyllables[index]);

    if (isMatch) {
        isTransitioning = true;

        // Stop the last syllable's click sound immediately - it used to
        // keep playing right into the full-word repeat in
        // playWinningSequence below, making the two audibly overlap.
        if (currentPlayingAudio) {
            currentPlayingAudio.pause();
            currentPlayingAudio.currentTime = 0;
        }

        showToast("Correct! Great job!", 'correct', 2000);
        document.getElementById('queue-slots').classList.add('correct');
        document.getElementById('correct-badge').classList.add('show');

        playDing();
        playWinningSequence();
    }
}

// Simple two-note ascending chime synthesized with the Web Audio API -
// no external sound asset needed. Plays immediately on a correct answer,
// distinct from (and well before) the full-word audio repeat.
let dingAudioCtx = null;
function playDing() {
    try {
        dingAudioCtx = dingAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const now = dingAudioCtx.currentTime;
        [660, 880].forEach((freq, i) => {
            const osc = dingAudioCtx.createOscillator();
            const gain = dingAudioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = now + i * 0.12;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
            osc.connect(gain).connect(dingAudioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.32);
        });
    } catch (err) {
        console.warn('Could not play the correct-answer chime:', err);
    }
}

function playWinningSequence() {
    setTimeout(() => {
        const fullWordAudio = new Audio(currentWord.fullAudioUrl);
        let hasMovedOn = false; // Flag to prevent double-firing

        // This function handles the transition
        const triggerNext = () => {
            if (!hasMovedOn) {
                hasMovedOn = true;
                setTimeout(moveToNextWord, 1000);
            }
        };

        // Standard triggers
        fullWordAudio.onended = triggerNext;
        fullWordAudio.play().catch(triggerNext);

        // FAILSAFE: If the OS freezes the audio (e.g., WhatsApp call), 
        // force the game to move on after 3.5 seconds anyway.
        setTimeout(triggerNext, 3500); 
        
    }, 400); 
}

loadGame();