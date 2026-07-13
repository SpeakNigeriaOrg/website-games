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
// ----------------------------

let gameData = [];
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

function startGame() {
    // 1. Hide the overlay
    document.getElementById('start-overlay').style.display = 'none';
    
    // 2. Now it is safe to load the first word
    loadWord(0); 
}

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

        gameData = playableSessions.map(session => {
            let sessionWords = [];
            let sessionSyllablePool = [];

            // Prefer the player's chosen speaker (CURRENT_SPEAKER - settable
            // via a future voice-picker UI) if this level actually supports
            // it; otherwise fall back to whichever speaker it does support.
            // Never falls through to an unsupported/hardcoded speaker now -
            // playableSessions above already guarantees validSpeakers is
            // non-empty and every listed speaker is fully covered.
            let levelSpeaker = session.validSpeakers.includes(CURRENT_SPEAKER)
                ? CURRENT_SPEAKER
                : session.validSpeakers[0];

            session.words.forEach(wordId => {
                const wordData = dictionaryWords[wordId];
                
                // publishToR2.mjs/exportGameContent.mjs now hard-gate every
                // word in sessions.json on having a real image (same as
                // audio coverage) - a placeholder graphic standing in for
                // missing art is fabricated content, not an acceptable
                // degrade. This check is defense-in-depth only: it should
                // never actually trigger against correctly-generated
                // content, but if it ever does (stale/hand-edited
                // sessions.json), skip the word entirely rather than
                // silently showing a placeholder.
                const imageStyles = wordData?.imageStyles || [];
                if (wordData && imageStyles.length === 0) {
                    console.error(`[Missing Image] "${wordId}" has no labeled image - excluding from this level (sessions.json should already guarantee this never happens; check its generation).`);
                }

                if (wordData && imageStyles.length > 0) {
                    const dynamicAudioUrl = `${BASE_URL}words/${levelSpeaker}/${wordId}.wav`;
                    // Prefer the player's chosen style if covered; otherwise
                    // fall back to whichever style IS covered.
                    const chosenStyle = imageStyles.includes(CURRENT_IMAGE_STYLE)
                        ? CURRENT_IMAGE_STYLE
                        : imageStyles[0];
                    const dynamicImageUrl = `${BASE_URL}images/${chosenStyle}/${wordId}.png`;

                    // ADDITION: Pre-calculate the tones for this word to use in the hint
                    const targetTones = wordData.syllables.map(syllable => {
                        const info = dictionarySyllables[levelSpeaker]?.[syllable];
                        return info ? info.tone : "mid"; // fallback to mid if missing
                    });

                    sessionWords.push({
                        id: wordId,
                        targetWord: wordData.displayText, 
                        targetSyllables: wordData.syllables,
                        targetTones: targetTones, // Save the mapped tones array
                        fullAudioUrl: dynamicAudioUrl, 
                        imageUrl: dynamicImageUrl
                    });
                                        
                    wordData.syllables.forEach(syllable => {
                        if (!sessionSyllablePool.some(s => s.text === syllable)) {
                            const syllableInfo = dictionarySyllables[levelSpeaker]?.[syllable];
                            
                            if (syllableInfo && syllableInfo.audio) {
                                sessionSyllablePool.push({
                                    text: syllable,
                                    audio: syllableInfo.audio, 
                                    tone: syllableInfo.tone 
                                });
                            } else {
                                console.warn(`[Missing Asset] Syllable "${syllable}" missing for ${levelSpeaker}`);
                            }
                        }
                    });
                }
            });
            
            return {
                levelId: session.levelId,
                syllablePool: shuffleArray(sessionSyllablePool),
                words: shuffleArray(sessionWords)
            };
        });
        
        initializeThemeSelector(); 
        loadLevel(0);              
        
    } catch (error) {
        showToast("Error loading game data.", 'error', 0); // 0 = stays until reload, this isn't transient
        console.error("Failed to load game data:", error);
    }
}

function initializeThemeSelector() {
    const selector = document.getElementById('theme-selector');
    selector.innerHTML = ''; 
    
    gameData.forEach((theme, index) => {
        const option = document.createElement('option');
        option.value = index;            
        option.innerText = theme.levelId; 
        selector.appendChild(option);
    });

    selector.addEventListener('change', (event) => {
        loadLevel(parseInt(event.target.value)); 
    });
}

function loadLevel(levelIndex) {
    if (levelIndex >= gameData.length) {
        showToast("You've completed all the themes!", 'info', 0);
        return;
    }
    
    currentLevelIndex = levelIndex;
    currentLevel = gameData[currentLevelIndex];
    document.getElementById('theme-selector').value = currentLevelIndex;

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
        showToast("Theme Complete! Loading next set...", 'info', 1500);
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
        currentPlayingAudio.play().catch((err) => {
            console.error("Audio playback blocked or file missing at:", absoluteUrl, err);
        });
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