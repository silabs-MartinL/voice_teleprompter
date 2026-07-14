# Voice Teleprompter

Voice Teleprompter is a browser-based teleprompter that follows your speech instead of scrolling at a fixed speed.

It was designed for recording technical videos where natural pauses, demonstrations, and retakes are common. Unlike traditional teleprompters, it waits for you to continue speaking and automatically tracks your progress through the script.

The entire application is contained in a single HTML file and runs locally in a modern browser such as Google Chrome. No installation, accounts, subscriptions, or internet connection are required after the page has been loaded.

## Features

- Voice-controlled teleprompter using the Web Speech API
- Automatically follows your speech
- No scrolling timers or countdowns
- Hands-free "Hey reset" voice command
- Open plain text (.txt) scripts
- Built-in script editor
- Download edited scripts
- Remembers the last script automatically
- Adjustable font size
- Fullscreen mode
- Auto-hiding toolbar
- Script statistics and estimated reading time
- Optional-word highlighting to improve recognition of technical scripts

## How it works

Rather than trying to perform perfect speech-to-text transcription, Voice Teleprompter tracks your position through the script.

Words are divided into two categories:

### Required words (white)

These are the important words that the recognizer uses to determine your current position in the script.

### Optional words (cyan)

Optional words can be skipped if the recognizer successfully hears the following required word.

Optional words include:

- Common filler words (for example: the, a, of, to, and, so)
- Technical identifiers such as acronyms, CamelCase names and alphanumeric part numbers

This approach makes the teleprompter much more tolerant of speech recognition errors, especially when reading technical presentations.

## Voice Commands

### Hey reset

Resets the teleprompter back to the beginning of the script without stopping voice recognition.

Useful when restarting a recording take.

## Supported Browsers

Voice Teleprompter uses the browser's Web Speech API.

Recommended browsers:

- Google Chrome
- Microsoft Edge

Other browsers may have limited or no speech recognition support.

## Usage

1. Open the HTML file in Chrome or Edge.
2. Click **Open Script** to load a text file, or use **Edit Script** to type directly into the built-in editor.
3. Click **Start Voice Control**.
4. Begin reading.
5. The teleprompter follows your speech automatically.
6. Say **"Hey reset"** to return to the beginning whenever required.

## Script Tips

If a technical word is not being recognised reliably, you can make it optional by changing its format.

Examples:

| Required    | Optional   |
| ----------- | ---------- |
| rssi        | RSSI       |
| Bluetooth   | BlueTooth  |
| Open Thread | OpenThread |

Words displayed in **cyan** are optional.

Words displayed in **white** are required.

## Script Statistics

The Help page displays:

- Total words
- Number of sentences
- Optional words
- Estimated reading time

Reading time is calculated using an adjustable Words Per Minute (WPM) value.

## Privacy

Everything runs locally in your browser.

Scripts are stored only in your browser's local storage so they can be restored the next time the teleprompter is opened.

No scripts are uploaded to any external service by the application itself.

## Roadmap

Potential future improvements include:

- Export a self-contained HTML teleprompter with the current script embedded
- User-configurable optional-word rules
- Additional recognition diagnostics
- Theme customisation
