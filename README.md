# https://pfg.pw/unamap

# una!map · a 4k osu!mania map maker

A new editor for 4k osu!mania maps

## Why?

- Faster note input: Press 'DF/JK' to place notes, hold for hold notes, use 'A/S' to go forwards/back in time
- BPM SV normalization (TODO: this is not implemented yet)
- SV mapping in-editor that preserves the relative positioning of notes
- Hold space to play, when you release it goes back to the start

And eventually:

- BPM SV normalization (TODO: this is not implemented yet)

## Features

- Basic timing, place notes & hold notes, box-select, drag notes, copy/paste
- Export .osz

## Limitations

- Missing undo/redo
- Missing save/load from file
- Missing note volume, sample, bank, addition bank
- Timing tab is not very good: missing that line thing you can hover over that shows the match, missing tap beat, missing easy offset/bpm adjustment buttons, missing time signature, missing skip bar line, missing kiai time
- Missing "Move already placed objects when changing timing"
- Missing difficulty settings, source, mapper tags, romanised artist, romanised title, background, design settings
- Can't import an existing map
- Performance gets worse with more notes (This will be resolved once the binary search is implemented)
- Missing playback speed settings
