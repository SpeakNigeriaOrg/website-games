let gameData = [];
let currentLevelIndex = 0;
let currentWordIndex = 0;

let currentLevel = null;
let currentWord = null;
let queue = [];
let maxSlots = 0;
let isTransitioning = false; 

async function loadGame() {
    try {
        const response = await fetch('problems.json');
        gameData = await response.json();
        
        initializeThemeSelector(); 
        loadLevel(0);              
    } catch (error) {
        document.getElementById('feedback-message').innerText = "Error loading game data.";
        console.error("Failed to load problems.json:", error);
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
        const selectedIndex = parseInt(event.target.value);
        loadLevel(selectedIndex); 
    });
}

function loadLevel(levelIndex) {
    if (levelIndex >= gameData.length) {
        document.getElementById('feedback-message').innerText = "You've completed all the themes!";
        return;
    }
    
    currentLevelIndex = levelIndex;
    currentLevel = gameData[currentLevelIndex];
    currentWordIndex = 0; 
    
    document.getElementById('theme-selector').value = currentLevelIndex;

    renderBank(); 
    loadWord(currentWordIndex);
}

function loadWord(wordIndex) {
    currentWordIndex = wordIndex;
    currentWord = currentLevel.words[currentWordIndex];
    
    maxSlots = currentWord.targetSyllables.length;
    queue = []; 
    
    // NEW: Swap the image
    document.getElementById('prompt-image').src = currentWord.imageUrl;
    
    // Clear out any old text feedback
    document.getElementById('feedback-message').innerText = ""; 
    
    renderQueue();
    isTransitioning = false; 

    // NEW: Autoplay the full word audio
    playFullWordAudio();
}

// NEW: Handles playing the full word prompt
function playFullWordAudio() {
    if (currentWord && currentWord.fullAudioUrl) {
        const promptAudio = new Audio(currentWord.fullAudioUrl);
        
        // Note: Browsers sometimes block autoplay on the very first page load 
        // until the user interacts with the screen. We catch the error silently so it doesn't break.
        promptAudio.play().catch(error => {
            console.log("Autoplay blocked. User needs to tap the image to play the sound.");
        });
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
    const bankDiv = document.getElementById('syllable-bank');
    bankDiv.innerHTML = ''; 
    
    currentLevel.syllablePool.forEach(buttonData => {
        const btn = document.createElement('button');
        btn.innerText = buttonData.text;
        btn.onclick = () => handleSyllableClick(buttonData);
        bankDiv.appendChild(btn);
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

    const audio = new Audio(buttonData.audioUrl);
    audio.play();

    queue.push(buttonData.text);

    if (queue.length > maxSlots) {
        queue.shift(); 
    }

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
    let currentIndex = 0;

    function playNextSyllable() {
        if (currentIndex >= currentWord.targetSyllables.length) {
            setTimeout(moveToNextWord, 1000); 
            return;
        }

        const syllableText = currentWord.targetSyllables[currentIndex];
        const buttonData = currentLevel.syllablePool.find(b => b.text === syllableText);
        
        if (buttonData) {
            const audio = new Audio(buttonData.audioUrl);
            audio.onended = playNextSyllable; 
            audio.play().catch(e => playNextSyllable());
        } else {
            playNextSyllable(); 
        }
        
        currentIndex++;
    }

    playNextSyllable();
}

loadGame();