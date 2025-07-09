Bun bug!

- [ ] bun 1.2.8 windows 2ae7a1358e894f6b818a4cbff62f5eb731ef883f : `bun serve` Non-sourcemapped error (Choose an audio file)

TODO:

- [x] never expose currentTime to react
  - it lied about doing it twice. so i'll do it myself
- [x] fix click drag select so it can select stuff off the edge of the screen (rn if you select & scroll it loses the ones off the screen)
- [x] play then scroll somewhere. broken! have to debug this one manually probably
- [x] Display notes on the waveform
- [x] scroll is inverted, flip it
- [ ] Implement undo/redo
- [ ] Add the ability to drag the end of a hold note to change its length
- [ ] Effects when a note passes below the line. It needs to disappear and play an effect and play its hitsound
- [ ] Before the first time you press space to play you have to click
- [ ] Need to do the binary search optimizations to reduce the performance impact of having thousands of notes
- [x] consider trying out a keyboard-only workflow: place notes with `dfjk`. place over a note to erase. advance with `;`, de-vance with `a`. hold space to play. 
  - simple to try, add support for 'a' to go back and ';' to go forwards. also add pressing a note over a note deletes it, which we want anyway
  - I don't like it
- [ ] add keybind settings

Export:

- [ ] does it work at all?
- [ ] bpm normalization
- [ ] generate the full .osz file
- [ ] import from .osz file

Features:

- [ ] sv mapping that preserves relative note position
