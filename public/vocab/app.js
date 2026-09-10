// --- GLOBAL CONFIGURATION ---
// Sibling of the phonics and tone games, and deliberately built from the same
// parts. Image and audio bytes live in R2; the word data ships same-origin and
// is read from the phonics game's copies rather than duplicated, because
// sync_dictionary_data.py keeps one vendored copy fresh for all three games.
// `../phonics/vocab.json` resolves to /phonics/vocab.json from /vocab/.
const BASE_URL = "https://gamemedia.speaknigeria.org/";
const DATA_DIR = "../phonics/";

// speaker1 is excluded for the same reason the tone game excludes it: only 11
// of its words are playable, which is too thin to build levels from.
const ALLOWED_SPEAKERS = ["speaker2", "speaker3"];

// Which playlists this game offers. sessions.json also defines tone_pattern and
// syllable_reinforcement; neither means anything here. Grouping words by their
// tone shape or by shared syllables tells a vocabulary learner nothing - those
// groupings exist for games where tone or syllables are the task.
const OFFERED_CATEGORIES = ["themed", "endless_practice"];

// How many words to offer per round. Levels can be as small as 3 words, so
// distractors are topped up from the same speaker's wider pool when a level
// cannot fill this on its own.
const CHOICE_COUNT = 4;

let CURRENT_IMAGE_STYLE = "cartoon";
// ----------------------------

let gameData = [];
let activeLevels = [];
let currentLevelIndex = 0;
let currentWordIndex = 0;

let currentLevel = null;
let currentWord = null;
let choices = [];
let ruledOut = new Set();     // wrong picks, struck through rather than cleared
let isSolved = false;
let isTransitioning = false;
let currentPlayingAudio = null;

// A level asked for by a shared link, consumed by loadLevel on the first call.
let requestedShare = null;

// Every playable word per speaker, for topping up distractors.
let speakerPool = {};

// The English gloss, taken from the word id - the id is
// <romanized yoruba>_<english>, so the gloss is everything after the LAST
// underscore. Not the first: "e_joo_please" has its extra underscore in the
// Yoruba half (ẹ jọ̀ọ́ is two words), and splitting on the first would hint
// "joo please". Verified across all 92 ids - 91 have one underscore, that one
// has two, and last-underscore is right for every one of them.
//
// vocab.json also carries a `definition`, but those run long and discursive
// ("July, the second month of the traditional Yoruba calendar, the Kọ́jọ́dá;
// the Agẹmọ festival is held during this month"), which gives away far more
// than a hint should. The id's gloss is one word and is what was asked for.
function englishOf(wordId) {
    const cut = wordId.lastIndexOf("_");
    if (cut < 0) return wordId;
    return wordId.slice(cut + 1).replace(/_/g, " ");
}

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

// Optional browser fullscreen - must be called directly from a user gesture.
// iOS Safari does not support the Fullscreen API for arbitrary page content at
// all, so this silently no-ops there; nothing to fix on our end.
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
    snGame.fullscreen(!!document.fullscreenElement);
});

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- AUDIO --------------------------------------------------------------
// One lazily-created AudioContext for the feedback sounds. Short sine notes
// with a soft attack and exponential decay - the same chime the other two games
// use, so the family sounds consistent.
let audioCtx = null;
function getAudioCtx() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
    return audioCtx;
}

function playChime(freqs, { gain = 0.25, noteGap = 0.12, decay = 0.3 } = {}) {
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const start = now + i * noteGap;
            gainNode.gain.setValueAtTime(0, start);
            gainNode.gain.linearRampToValueAtTime(gain, start + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, start + decay);
            osc.connect(gainNode).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + decay + 0.02);
        });
    } catch (err) {
        console.warn("Could not play chime:", err);
    }
}
const playSuccess = () => playChime([784, 1047, 1319], { gain: 0.22, noteGap: 0.11, decay: 0.6 });
const playWrong = () => playChime([196, 147], { gain: 0.14, noteGap: 0.09, decay: 0.18 });

// Interrupting our own playback is normal - each tap stops whatever was
// playing - and the interrupted play() promise rejects with AbortError. That is
// the mechanism working, so it is swallowed; anything else is reported.
function reportAudioFailure(context, error) {
    if (error && error.name === 'AbortError') return;
    console.warn(`Audio playback blocked or file missing (${context}):`, error);
}

function playWordAudio(fromUser = true) {
    if (!currentWord) return;
    if (fromUser) snGame.audio(currentWord, 'full');
    if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0;
    }
    currentPlayingAudio = new Audio(currentWord.fullAudioUrl);
    currentPlayingAudio.play().catch((err) => reportAudioFailure(currentWord.fullAudioUrl, err));
}

// --- DATA ---------------------------------------------------------------
function initializePlaylistMenu() {
    const counts = {};
    gameData.forEach((level) => { counts[level.category] = (counts[level.category] || 0) + 1; });
    document.querySelectorAll('.playlist-btn').forEach((btn) => {
        btn.disabled = !counts[btn.dataset.category];
    });
}

function selectPlaylist(category) {
    activeLevels = gameData.filter((level) => level.category === category);
    if (activeLevels.length === 0) return;
    document.getElementById('start-overlay').style.display = 'none';
    snGame.playlistSelected(category, activeLevels.length);
    initializeThemeSelector();
    loadLevel(shareTargetIndex());
}

// The index of the level a shared link asked for, or 0. Consumed once: after
// that, changing playlist should open at the top like it normally does.
function shareTargetIndex() {
    if (!requestedShare) return 0;
    const wanted = requestedShare.level.levelId;
    requestedShare = null;
    const found = activeLevels.findIndex((level) => level.levelId === wanted);
    return found >= 0 ? found : 0;
}

function showPlaylistMenu() {
    document.getElementById('start-overlay').style.display = 'flex';
}

// Clicking the backdrop dismisses the menu without changing playlist, but only
// once a game is loaded, so the first (mandatory) choice cannot be skipped by
// an accidental tap. That tap is also what unlocks audio.
document.getElementById('start-overlay').addEventListener('click', (event) => {
    if (event.target.id === 'start-overlay' && currentLevel) {
        document.getElementById('start-overlay').style.display = 'none';
    }
});

// A playable word, or null. Needs a real image and a word recording for this
// speaker; sessions.json's validSpeakers is the only trustworthy evidence of
// the latter, which is why levels are built from it rather than from vocab.json.
function buildWord(wordId, wordData, speaker) {
    const imageStyles = wordData?.imageStyles || [];
    if (!wordData) return null;
    if (imageStyles.length === 0) {
        console.error(`[Missing Image] "${wordId}" has no labeled image - excluding it.`);
        return null;
    }
    const chosenStyle = imageStyles.includes(CURRENT_IMAGE_STYLE) ? CURRENT_IMAGE_STYLE : imageStyles[0];
    return {
        id: wordId,
        displayText: wordData.displayText.normalize("NFC"),
        english: englishOf(wordId),
        // Named targetSyllables because analytics/game-events.js reads the
        // syllable count through that field (or bareSyllables) to report it.
        // This game never shows syllables, but "are longer words harder to
        // recognise" is worth being able to ask, and an absent field would
        // report 0 for every word instead.
        targetSyllables: wordData.syllables,
        speaker,
        fullAudioUrl: `${BASE_URL}words/${speaker}/${wordId}.wav`,
        imageUrl: `${BASE_URL}images/${chosenStyle}/${wordId}.png`
    };
}

async function loadGame() {
    try {
        const [wordsResponse, sessionsResponse] = await Promise.all([
            fetch(DATA_DIR + 'vocab.json'),
            fetch(DATA_DIR + 'sessions.json')
        ]);
        const dictionaryWords = await wordsResponse.json();
        const sessions = await sessionsResponse.json();

        const playableSessions = sessions.filter(session =>
            session.validSpeakers &&
            session.validSpeakers.some(speaker => ALLOWED_SPEAKERS.includes(speaker)));

        // Every playable (speaker, word) pair, for distractors. Drawn from ALL
        // sessions, not just the offered categories: whether a word can be
        // shown has nothing to do with which playlist it is listed under.
        speakerPool = {};
        playableSessions.forEach((session) => {
            session.validSpeakers.filter(s => ALLOWED_SPEAKERS.includes(s)).forEach((speaker) => {
                session.words.forEach((wordId) => {
                    const word = buildWord(wordId, dictionaryWords[wordId], speaker);
                    if (!word) return;
                    speakerPool[speaker] = speakerPool[speaker] || new Map();
                    speakerPool[speaker].set(wordId, word);
                });
            });
        });

        gameData = playableSessions
            .filter(session => OFFERED_CATEGORIES.includes(session.category))
            .map((session) => {
                const speaker = session.validSpeakers.find(s => ALLOWED_SPEAKERS.includes(s));
                const words = session.words
                    .map(id => speakerPool[speaker]?.get(id))
                    .filter(Boolean);
                return {
                    levelId: session.levelId,
                    category: session.category,
                    speaker,
                    words: shuffleArray(words.slice())
                };
            })
            .filter(level => level.words.length >= 2);   // a level of one has no choice to make

        snGame.start('vocab', gameData);

        // A link to a particular level opens straight into it, skipping the
        // playlist menu - that is the whole point of sending someone one.
        requestedShare = snShare.requested('vocab', gameData);
        snShare.init('vocab', function () { return currentLevel; });

        initializePlaylistMenu();
        if (requestedShare) {
            selectPlaylist(requestedShare.category);
            return;
        }
    } catch (error) {
        showToast("Error loading game data.", 'error', 0);
        console.error("Failed to load game data:", error);
    }
}

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
    selector.onchange = (event) => loadLevel(parseInt(event.target.value));
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
    snGame.levelLoaded(currentLevel, currentLevel.speaker);
    loadWord(0);
}

// The other words offered this round. Same level first - those are thematically
// related, which makes the choice about the word rather than about the topic -
// then topped up from the same speaker's pool when the level is too small
// (levels run from 3 to 12 words).
function buildChoices(word) {
    const seen = new Set([word.displayText]);
    const distractors = [];
    const take = (candidates) => {
        shuffleArray(candidates.slice()).forEach((other) => {
            if (distractors.length >= CHOICE_COUNT - 1) return;
            if (other.id === word.id || seen.has(other.displayText)) return;
            seen.add(other.displayText);
            distractors.push(other);
        });
    };
    take(currentLevel.words);
    take([...(speakerPool[word.speaker]?.values() || [])]);
    return shuffleArray([word, ...distractors]);
}

function loadWord(wordIndex) {
    currentWordIndex = wordIndex;
    currentWord = currentLevel.words[currentWordIndex];
    choices = buildChoices(currentWord);
    ruledOut = new Set();
    isSolved = false;

    const imgElement = document.getElementById('prompt-image');
    imgElement.onerror = function () { this.onerror = null; this.src = 'images/placeholder.png'; };
    imgElement.src = currentWord.imageUrl;
    imgElement.alt = 'Which word is this?';

    clearTimeout(toastTimeout);
    document.getElementById('toast').classList.remove('show');
    document.getElementById('correct-badge').classList.remove('show');
    const hint = document.getElementById('hint-text');
    hint.textContent = '';
    hint.classList.remove('show');
    showingHint = false;
    document.getElementById('hint-btn').classList.remove('active');

    renderChoices();
    isTransitioning = false;
    snGame.wordShown(currentWord, currentLevel);

    // Deliberately NO audio here. The player should see the picture and read
    // the options; hearing the word first would make it a listening game, which
    // is what the other two already are. Tapping the picture plays it if they
    // want the help, and a correct answer plays it as confirmation.
}

let showingHint = false;
function toggleHint() {
    if (!currentWord || isTransitioning) return;
    showingHint = !showingHint;
    if (showingHint) snGame.hint('english-gloss');
    const hint = document.getElementById('hint-text');
    hint.textContent = showingHint ? currentWord.english : '';
    hint.classList.toggle('show', showingHint);
    document.getElementById('hint-btn').classList.toggle('active', showingHint);
}

function moveToNextWord() {
    const next = currentWordIndex + 1;
    if (next < currentLevel.words.length) {
        loadWord(next);
    } else {
        snGame.levelComplete(currentLevel);
        showToast("Level Complete! Loading next set...", 'info', 1500);
        setTimeout(() => loadLevel(currentLevelIndex + 1), 1500);
    }
}

function prevWord() {
    if (isTransitioning) return;
    if (currentWordIndex - 1 >= 0) { snGame.back(); loadWord(currentWordIndex - 1); }
}

function skipWord() {
    if (isTransitioning) return;
    isTransitioning = true;
    snGame.skipped(currentWord, currentLevel);
    showToast("Skipping word...", 'skipping', 800);
    setTimeout(moveToNextWord, 800);
}

// --- CHOICES ------------------------------------------------------------
function renderChoices() {
    const container = document.getElementById('choices');
    container.innerHTML = '';
    choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice';
        btn.textContent = choice.displayText;
        if (ruledOut.has(choice.id)) btn.classList.add('ruled-out');
        if (isSolved && choice.id === currentWord.id) btn.classList.add('correct');
        btn.disabled = isSolved || ruledOut.has(choice.id);
        btn.onclick = () => handleChoice(choice);
        container.appendChild(btn);
    });
}

function handleChoice(choice) {
    if (isTransitioning || isSolved) return;

    if (choice.id !== currentWord.id) {
        // Wrong answers are struck through and left on screen rather than
        // clearing the round. No score and no lives - the same
        // no-punishment spirit as the other two games - and eliminating an
        // option is a real step forward rather than a reset.
        ruledOut.add(choice.id);
        snGame.answer(currentWord, currentLevel, false, {
            chosenWord: choice.id,
            choiceCount: choices.length
        });
        playWrong();
        renderChoices();
        const remaining = choices.filter(c => !ruledOut.has(c.id)).length;
        showToast(remaining > 1 ? "Not that one - try again" : "This one, then", 'skipping', 1200);
        return;
    }

    isSolved = true;
    isTransitioning = true;
    snGame.answer(currentWord, currentLevel, true, {
        chosenWord: choice.id,
        choiceCount: choices.length
    });
    document.getElementById('correct-badge').classList.add('show');
    showToast("Correct! Great job!", 'correct', 2000);
    renderChoices();
    playSuccess();

    // Hearing it now ties the spelling they just picked to how it sounds.
    setTimeout(() => {
        const audio = new Audio(currentWord.fullAudioUrl);
        let movedOn = false;
        const next = () => { if (!movedOn) { movedOn = true; setTimeout(moveToNextWord, 1000); } };
        audio.onended = next;
        audio.play().catch(next);
        // FAILSAFE: if the OS freezes audio (an incoming call), onended never
        // fires - move on anyway.
        setTimeout(next, 3500);
    }, 500);
}

loadGame();
