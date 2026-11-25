#!/usr/bin/env bash
# Makes the audio files of the accessibility features (for blind players):
# - client/assets/voice/<word>.ogg: one spoken word per file, read by the
#   client one after the other ("music", "50", "percent");
# - client/assets/sounds/enemy.ogg, victory.ogg, game_over.ogg: short beeps.
#
# The voice is made by Flite (free speech synthesis from Carnegie Mellon
# University, BSD-like license), through ffmpeg: no file is downloaded, so
# there is no license problem. The generated files are in the repository:
# this script is only needed to add or change a word.
# Needs ffmpeg built with libflite (`ffmpeg -filters | grep flite`).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VOICE_DIR="$ROOT/client/assets/voice"
SOUND_DIR="$ROOT/client/assets/sounds"
VOICE="slt" # a Flite voice: kal, kal16, awb, rms or slt

# Every word the client can say. A word that is not here is spelled letter by
# letter (a name, for example), so add the words of any new menu here.
WORDS=(
    # menus
    solo game multiplayer settings quit music sounds difficulty easy normal hard
    mode campaign endless voice on off up down left right fire pause summary
    reset keys back address port name connect ready not leave play again main
    menu resume to waiting room victory over final score lives speed power
    wave level boss no percent press new key for cancel type delete
    # key names
    escape space enter tab shift control alt return backspace
    # messages of the game
    warning the is coming enraged destroyed answer from connection lost with
    full players server closed unknown player dot
    # numbers that are not a single number file
    hundred thousand
)

# Flite adds silence before and after the word: cut it (start, then the end by
# reading the sound backwards), so the words of a sentence follow each other.
TRIM="silenceremove=start_periods=1:start_threshold=-45dB"
TRIM="$TRIM,areverse,$TRIM,areverse"

say() { # say <text> <file>
    ffmpeg -hide_banner -loglevel error -y -f lavfi -i "flite=text='$1':voice=$VOICE" \
        -af "$TRIM,loudnorm=I=-16:TP=-1.5,apad=pad_dur=0.06" -ac 1 -ar 22050 \
        -c:a libvorbis -q:a 3 "$2"
}

mkdir -p "$VOICE_DIR"
for word in "${WORDS[@]}"; do
    say "$word" "$VOICE_DIR/$word.ogg"
done
for letter in {a..z}; do
    say "${letter^^}" "$VOICE_DIR/$letter.ogg" # upper case: Flite says the letter name
done
for number in $(seq 0 100); do
    say "$number" "$VOICE_DIR/$number.ogg"
done

# Beeps: square waves like the other sounds of the game.
tone() { # tone <frequency> <seconds>
    echo "aevalsrc='0.25*sgn(sin(2*PI*$1*t))':s=22050:d=$2,afade=t=out:st=0:d=$2"
}
beeps() { # beeps <file> <tone 1> <tone 2> ...
    local file="$1"
    shift
    local inputs=() filter="" i=0
    for t in "$@"; do
        inputs+=(-f lavfi -i "$t")
        filter+="[$i:a]"
        i=$((i + 1))
    done
    ffmpeg -hide_banner -loglevel error -y "${inputs[@]}" \
        -filter_complex "${filter}concat=n=$i:v=0:a=1" -ac 1 -c:a libvorbis -q:a 3 "$file"
}
# A short "bip": an enemy appears (the client places it left / right, high / low).
beeps "$SOUND_DIR/enemy.ogg" "$(tone 880 0.07)"
# Going up: victory. Going down: game over.
beeps "$SOUND_DIR/victory.ogg" "$(tone 523 0.12)" "$(tone 659 0.12)" "$(tone 784 0.12)" \
    "$(tone 1047 0.45)"
beeps "$SOUND_DIR/game_over.ogg" "$(tone 392 0.2)" "$(tone 330 0.2)" "$(tone 262 0.2)" \
    "$(tone 196 0.6)"

echo "Done: $(ls "$VOICE_DIR" | wc -l) voice files in $VOICE_DIR"
