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
        print(f"\nEvaluating: {level['levelId']}")
        valid_speakers = []
        valid_styles = []

        # --- VALIDATE SPEAKERS ---
        for speaker in ALL_SPEAKERS:
            is_speaker_valid = True
            for word_id in level["words"]:
                # Check for the full word audio
                expected_audio = os.path.join(MEDIA_DIR, "words", speaker, f"{word_id}.wav")
                if not os.path.exists(expected_audio):
                    print(f"  -> [SPEAKER REJECTED] {speaker}: Missing word audio '{expected_audio}'")
                    is_speaker_valid = False
                    break 
                
                # Check for the required syllables
                word_data = dictionary_words.get(word_id)
                if word_data:
                    for syllable in word_data["syllables"]:
                        if syllable not in dictionary_syllables.get(speaker, {}):
                            print(f"  -> [SPEAKER REJECTED] {speaker}: Missing syllable '{syllable}' (needed for '{word_id}')")
                            is_speaker_valid = False
                            break
                
                # If a syllable failed, break out of the word loop entirely
                if not is_speaker_valid:
                    break

            if is_speaker_valid: 
                valid_speakers.append(speaker)

        # --- VALIDATE IMAGE STYLES ---
        for style in ALL_STYLES:
            is_style_valid = True
            for word_id in level["words"]:
                # Pointing to data/images/
                expected_image = os.path.join(MEDIA_DIR, "images", style, f"{word_id}.png")
                if not os.path.exists(expected_image):
                    print(f"  -> [STYLE REJECTED] {style}: Missing image '{expected_image}'")
                    is_style_valid = False
                    break
            
            if is_style_valid: 
                valid_styles.append(style)

        generated_sessions.append({
            "levelId": level["levelId"],
            "validSpeakers": valid_speakers,
            "validStyles": valid_styles,
            "words": level["words"]
        })

    with open('sessions.json', 'w', encoding='utf-8') as f:
        json.dump(generated_sessions, f, indent=2, ensure_ascii=False)
        
    print("\nSuccess! sessions.json generated.")

if __name__ == "__main__":
    generate_sessions()