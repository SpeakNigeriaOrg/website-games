import json

# --- CONFIGURATION ---
# Define all your speakers here. The script will generate 
# the full required syllable list for every speaker in this array.
SPEAKERS = ["speaker1", "speaker2"]
# ---------------------

def generate_syllable_info(syllable, speaker):
    # 1. Detect the tone
    tone = "mid" # Default
    if any(c in syllable.lower() for c in ['á', 'é', 'ẹ́', 'í', 'ó', 'ọ́', 'ú', 'ń']):
        tone = "high"
        suffix = "_high"
    elif any(c in syllable.lower() for c in ['à', 'è', 'ẹ̀', 'ì', 'ò', 'ọ̀', 'ù', 'ǹ']):
        tone = "low"
        suffix = "_low"
    else:
        suffix = ""

    # 2. Map characters
    base_map = {
        'á': 'a', 'à': 'a',
        'é': 'e', 'è': 'e',
        'ẹ́': 'e_sub', 'ẹ̀': 'e_sub', 'ẹ': 'e_sub',
        'í': 'i', 'ì': 'i',
        'ó': 'o', 'ò': 'o',
        'ọ́': 'o_sub', 'ọ̀': 'o_sub', 'ọ': 'o_sub',
        'ú': 'u', 'ù': 'u',
        'ṣ': 's_sub'
    }
    
    safe_name = "".join([base_map.get(c, c) for c in syllable.lower()])
    
    # Return both the path AND the tone label
    return {
        "audio": f"syllables/{speaker}/{safe_name}{suffix}.wav",
        "tone": tone
    }

def main():
    # 1. Read the existing words.json file
    try:
        with open('words.json', 'r', encoding='utf-8') as f:
            words_data = json.load(f)
    except FileNotFoundError:
        print("Error: words.json not found in the current directory.")
        return

    # 2. Extract all unique syllables required by the game
    unique_syllable_texts = set()
    for word_info in words_data.values():
        for syllable in word_info.get('syllables', []):
            unique_syllable_texts.add(syllable.lower())

    # 3. Build the master dictionary for all defined speakers
    # Initialize the empty master dictionary once here
    master_syllables = {}
    
    # Loop through each speaker only once
    for speaker in SPEAKERS:
        master_syllables[speaker] = {}
        # Fill the dictionary for this specific speaker
        for syllable in unique_syllable_texts:
            master_syllables[speaker][syllable] = generate_syllable_info(syllable, speaker)

    # 4. Save to syllables.json
    with open('syllables.json', 'w', encoding='utf-8') as f:
        json.dump(master_syllables, f, indent=2, ensure_ascii=False)

    print(f"Success! Processed {len(unique_syllable_texts)} unique syllables for {len(SPEAKERS)} speakers.")

if __name__ == "__main__":
    main()