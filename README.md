# Voice Teleprompter

Voice Teleprompter is a browser-based teleprompter that follows your speech instead of scrolling at a fixed speed.

Unlike traditional teleprompters, it waits for you to speak before advancing through the script, allowing you to pause naturally while recording videos, demonstrating products, or presenting technical content.

The entire application is contained in a single HTML file and runs locally in a modern browser. No installation, server or subscription is required.

## Features

### Voice-controlled scrolling

- Follows your speech automatically
- No scrolling timers
- Pause naturally without losing your place
- Hands-free reset using the voice command **"Hey reset"**

### Intelligent speech tracking

Rather than attempting perfect speech-to-text transcription, Voice Teleprompter tracks your position through the script using a lightweight recognition engine.

Words are divided into two categories:

- **Required words** (white)
- **Optional words** (cyan)

This makes the teleprompter much more tolerant of technical terminology, acronyms, product names and common filler words.

## Eye Contact Mode

Eye Contact Mode creates an adjustable horizontal reading gap so the next lines of text appear immediately above your webcam if positioned in front of your screen within the reading gap.

This helps maintain natural eye contact while reading the script, making recordings look much more natural.

The gap size can be adjusted using the **G−** and **G+** buttons and is remembered automatically.

## Mirror Mode

Mirror the script for use with beam-splitter teleprompter hardware.

Only the script is mirrored. The toolbar, editor and help pages remain readable.

## Built-in Script Editor

- Edit scripts directly in the browser
- Open plain text (`.txt`) files
- Save edited scripts
- Automatically remembers the last script used

## Adjustable Display

- Adjustable font size
- Fullscreen mode
- Auto-hiding toolbar
- Mirror mode
- Eye Contact mode with adjustable gap

## Help System

The built-in Help page includes:

- Controls reference
- Voice commands
- Recognition guide
- Required vs optional words
- Script statistics
- Adjustable reading speed
- Tips for improving recognition

## Script Statistics

Displays:

- Word count
- Sentence count
- Optional word count
- Estimated reading time

Reading time is calculated using an adjustable Words Per Minute (WPM) value.

## Recognition Tips

If a word is difficult for speech recognition, it can easily be made optional.

| Required | Optional |
|----------|----------|
| Bluetooth | BlueTooth |
| Open Thread | OpenThread |
| rssi | RSSI |

Optional words are highlighted in **cyan**.

## Browser Support

Voice Teleprompter uses the browser's Web Speech API.

Recommended browser:

- Google Chrome

Support in other browsers depends on their implementation of the Web Speech API.

## Privacy

Everything runs locally in your browser.

No scripts are uploaded anywhere.

The application stores only the following in browser local storage:

- Last script
- Font size
- Reading speed
- Mirror mode
- Eye Contact gap size

## Installation

No installation is required.

Clone or download the repository and open **index.html** in Google Chrome.

## License

This project is licensed under the **Apache License 2.0**.

See the `LICENSE` file for details.