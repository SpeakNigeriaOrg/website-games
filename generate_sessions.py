import json
import os

# Where your media files live
MEDIA_DIR = "data" 

# Global configurations
ALL_SPEAKERS = ["speaker1", "speaker2"]
ALL_STYLES = ["real", "cartoon"]

def generate_sessions():
    # 1. Load data files from the CURRENT directory
    with open('sessions_source.json', 'r', encoding='utf-8') as f:
        sessions_source = json.load(f)
    with open('words.json', 'r', encoding='utf-8') as f:
        dictionary_words = json.load(f)
    with open('syllables.json', 'r', encoding='utf-8') as f:
        dictionary_syllables = json.load(f)

    generated_sessions = []

    for level in sessions_source:
        valid_speakers = []
        valid_styles = []

        # --- VALIDATE SPEAKERS ---
        for speaker in ALL_SPEAKERS:
            is_speaker_valid = True
            for word_id in level["words"]:
                # Pointing to data/words/
                expected_audio = os.path.join(MEDIA_DIR, "words", speaker, f"{word_id}.wav")
                if not os.path.exists(expected_audio):
                    is_speaker_valid = False
                    break 
                
                # Syllables are just a lookup, no disk check needed here
                word_data = dictionary_words.get(word_id)
                for syllable in word_data["syllables"]:
                    if syllable not in dictionary_syllables[speaker]:
                        is_speaker_valid = False
                        break
            if is_speaker_valid: valid_speakers.append(speaker)

        # --- VALIDATE IMAGE STYLES ---
        for style in ALL_STYLES:
            is_style_valid = True
            for word_id in level["words"]:
                # Pointing to data/images/
                expected_image = os.path.join(MEDIA_DIR, "images", style, f"{word_id}.jpg")
                if not os.path.exists(expected_image):
                    is_style_valid = False
                    break
            if is_style_valid: valid_styles.append(style)

        generated_sessions.append({
            "levelId": level["levelId"],
            "validSpeakers": valid_speakers,
            "validStyles": valid_styles,
            "words": level["words"]
        })

    with open('sessions.json', 'w', encoding='utf-8') as f:
        json.dump(generated_sessions, f, indent=2, ensure_ascii=False)
        
    print("Success! sessions.json generated.")

if __name__ == "__main__":
    generate_sessions()