Bun bug!

- [ ] bun 1.2.8 windows 2ae7a1358e894f6b818a4cbff62f5eb731ef883f : `bun serve` Non-sourcemapped error (Choose an audio file)

TODO:

- [x] never expose currentTime to react
  - it lied about doing it twice. so i'll do it myself
- [x] fix click drag select so it can select stuff off the edge of the screen (rn if you select & scroll it loses the ones off the screen)
- [ ] play then scroll somewhere. broken! have to debug this one manually probably
- [x] Display notes on the waveform
- [x] scroll is inverted, flip it
- [ ] Implement undo/redo
- [ ] Add the ability to drag the end of a hold note to change its length
- [ ] Effects when a note passes below the line. It needs to disappear and play an effect and play its hitsound

Export:

- [ ] does it work at all?
- [ ] bpm normalization
- [ ] generate the full .osz file
- [ ] import from .osz file

Features:

- [ ] sv mapping that preserves relative note position
