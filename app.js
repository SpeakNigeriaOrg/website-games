// --- GLOBAL CONFIGURATION ---
const BASE_URL = "https://pub-5da9d55f185e47e790045ceb1be1facd.r2.dev/";

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

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function loadGame() {
    try {
        const [wordsResponse, syllablesResponse, sessionsResponse] = await Promise.all([
            fetch('words.json'),
            fetch('syllables.json'),
            fetch('sessions.json')
        ]);
        
        const dictionaryWords = await wordsResponse.json();
        const dictionarySyllables = await syllablesResponse.json();
        const sessions = await sessionsResponse.json();
        
        gameData = sessions.map(session => {
            let sessionWords = [];
            let sessionSyllablePool = [];
            
            session.words.forEach(wordId => {
                const wordData = dictionaryWords[wordId];
                
                if (wordData) {
                    
                    // Construct standard paths using Convention Over Configuration
                    const dynamicAudioUrl = `${BASE_URL}words/${CURRENT_SPEAKER}/${wordId}.wav`;
                    const dynamicImageUrl = `${BASE_URL}images/${CURRENT_IMAGE_STYLE}/${wordId}.jpg`;

                    sessionWords.push({
                        id: wordId,
                        targetWord: wordData.displayText, 
                        targetSyllables: wordData.syllables,
                        fullAudioUrl: dynamicAudioUrl, 
                        imageUrl: dynamicImageUrl
                    });
                                        
                    wordData.syllables.forEach(syllable => {
                        if (!sessionSyllablePool.some(s => s.text === syllable)) {
                            
                            // 1. CHANGE THIS: Fetch the object, not the string
                            const syllableInfo = dictionarySyllables[CURRENT_SPEAKER]?.[syllable];
                            
                            // 2. CHANGE THIS: Check if the object exists
                            if (syllableInfo && syllableInfo.audio) {
                                sessionSyllablePool.push({
                                    text: syllable,
                                    // 3. CHANGE THIS: Use the .audio property
                                    audioUrl: BASE_URL + syllableInfo.audio,
                                    // 4. ADD THIS: Capture the tone so renderBank() can sort it
                                    tone: syllableInfo.tone 
                                });
                            } else {
                                console.warn(`[Missing Asset] Syllable "${syllable}" missing for ${CURRENT_SPEAKER}`);
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
        document.getElementById('feedback-message').innerText = "Error loading game data.";
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
        document.getElementById('feedback-message').innerText = "You've completed all the themes!";
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
    
    // Set image with a basic 404 fallback to keep UI clean during testing
    const imgElement = document.getElementById('prompt-image');
    imgElement.onerror = function() {
        this.onerror = null; 
        this.src = 'images/placeholder.jpg'; 
    };
    imgElement.src = currentWord.imageUrl;
    
    document.getElementById('feedback-message').innerText = ""; 
    renderQueue();
    isTransitioning = false; 

    playFullWordAudio();
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
        document.getElementById('feedback-message').innerText = "Theme Complete! Loading next set...";
        setTimeout(() => loadLevel(currentLevelIndex + 1), 1500);
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
        
        // Data-driven: The tone is already defined in the data
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
        slot.className = 'slot';
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

    if (buttonData.audioUrl) {
        currentPlayingAudio = new Audio(buttonData.audioUrl);
        currentPlayingAudio.play().catch(() => {});
    }

    queue.push(buttonData.text);
    if (queue.length > maxSlots) queue.shift(); 

    renderQueue();
    checkWinCondition();
}

function checkWinCondition() {
    const isMatch = queue.length === maxSlots && 
                    queue.every((val, index) => val === currentWord.targetSyllables[index]);
    
    if (isMatch) {
        isTransitioning = true; 
        document.getElementById('feedback-message').innerText = "Correct! Great job!";
        playWinningSequence(); 
    }
}

function playWinningSequence() {
    setTimeout(() => {
        const fullWordAudio = new Audio(currentWord.fullAudioUrl);
        
        fullWordAudio.onended = () => setTimeout(moveToNextWord, 1000);
        fullWordAudio.play().catch(() => setTimeout(moveToNextWord, 1000));
    }, 400); 
}

loadGame();