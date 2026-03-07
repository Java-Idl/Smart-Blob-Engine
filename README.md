# Smart Blob Engine

A tiny browser-only blob character that navigates page elements using graph-based pathfinding.

## What changed in this rewrite

- Reworked pathfinding from a local greedy hop scorer to graph search with A*.
- Added explicit graph construction over platform landing points.
- Added configurable jump constraints (`maxJumpX`, `maxJumpUp`, `maxDropDown`).
- Added optional debug rendering for graph nodes, edges, and chosen path.
- Separated demo HTML from engine code (`index.html` + `script.js`).

## Quick start

1. Open `index.html` in a browser.
2. Move mouse around to guide blob.
3. Click empty background to force a jump.

## API

```js
const blob = new SmartBlob({
  size: 32,
  blobColor: '#ffe600',
  eyeColor: '#000000',
  jumpSpeed: 500,
  jumpCooldown: 800,
  maxJumpX: 320,
  maxJumpUp: 260,
  maxDropDown: 520,
  debugPath: false,
  autoAttach: true
});

blob.scanPlatforms('.platform');
blob.start();
blob.stop();
```

## Pathfinding design

- Platforms are converted to candidate landing nodes (left, center, right; plus extra sampling on ground).
- Directed jump edges are created if jump constraints allow transition.
- A* is run from current blob position to one of the nearest goal candidates to the cursor.
- The blob executes only the next hop from the chosen path each jump tick.

## Notes

- No external libraries.
- Built for small-to-medium DOM scenes.
