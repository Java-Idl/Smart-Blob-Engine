# Smart Blob Engine

Smart Blob Engine is a browser-only movement engine.
It draws a blob on a canvas, tracks the mouse, builds a platform graph from DOM elements, and moves the blob with A* path search.

_Inspiration_ [\^o^/](https://neon-blob-jump.kudos-kebab-kept.workers.dev/)

All engine code is in `script.js`.

## Quick start

1. Open `index.html` in a browser.
2. Move the mouse to set the target.
3. Click empty page space to force a jump.

## Public usage

```js
const blob = new SmartBlob({
  container: document.getElementById('game-container'),
  size: 32,
  blobColor: '#ffe600',
  eyeColor: '#000000',
  jumpSpeed: 500,
  jumpCooldown: 260,
  maxJumpX: 320,
  maxJumpUp: 260,
  maxDropDown: 520,
  maxNeighborsPerNode: 12,
  adaptivePathfinding: true,
  predictiveLookaheadMs: 240,
  maxDynamicJumpBoost: 0.45,
  climbAggression: 1,
  dropAggression: 1,
  minMoveDistance: 6,
  flatMoveBias: 1,
  flatArcMax: 64,
  targetPredictionWeight: 0,
  debugMode: 'off',
  debugPath: false,
  autoAttach: true
});

blob.scanPlatforms('.platform');
blob.start();
blob.stop();
blob.destroy();
```

## File structure

- `script.js`: engine classes and runtime loop.
- `index.html`: demo scene, controls, and platform generation.

## Classes in script.js

### 1) TweenManager

Handles property animation for blob movement and squash/stretch.

Methods:

- `add(target, props, duration, easing, onComplete)`
- `update(time)`
- `remove(target, keys)`
- `ease(t, type)`

Supported easing names:

- `linear`
- `easeOutQuad`
- `easeInQuad`
- `easeInOutQuad`
- `easeOutCubic`
- `easeInCubic`
- `easeOutElastic`

### 2) MinPriorityQueue

Binary heap used by path search.

Methods:

- `push(nodeId, priority)`
- `pop()`
- `size()`
- `bubbleUp(index)`
- `sinkDown(index)`

### 3) BlobEngineMetrics

Stores live metrics and notifies listeners.

Methods:

- `get(key, fallback)`
- `set(key, value)`
- `update(partialMetrics)`
- `increment(key, delta)`
- `reset(defaultMetrics)`
- `snapshot()`
- `subscribe(listener)`
- `emit()`

### 4) SmartBlob

Main engine class.

## SmartBlob options

### Visual

- `container`: parent element for the engine canvas (default `document.body`).
- `size`: blob width/height in pixels.
- `blobColor`: main blob color.
- `eyeColor`: eye color.

### Jump and motion

- `jumpSpeed`: base jump tween duration controller.
- `jumpCooldown`: minimum time between automatic jumps.
- `minMoveDistance`: minimum accepted hop distance.
- `flatArcMax`: cap for low-arc horizontal jump height.

### Traversal limits

- `maxJumpX`: max horizontal hop reach.
- `maxJumpUp`: max upward hop reach.
- `maxDropDown`: max downward hop reach.

### Path selection and behavior

- `maxNeighborsPerNode`: max outgoing jump edges considered per node.
- `adaptivePathfinding`: enables dynamic adjustment based on target distance/speed.
- `predictiveLookaheadMs`: lookahead window for mouse prediction.
- `maxDynamicJumpBoost`: scale factor for dynamic horizontal reach boost.
- `climbAggression`: weight favoring upward intent.
- `dropAggression`: weight favoring downward intent.
- `flatMoveBias`: extra weight for same-level movement preference.
- `targetPredictionWeight`: blend between current target and predicted target (`0..1`).

### Debug and startup

- `debugMode`: one of `off`, `used`, `calculated`, `all`.
- `debugPath`: shortcut that maps to `debugMode='used'` when true.
- `autoAttach`: auto-start render loop in constructor unless set to `false`.

## SmartBlob runtime flow

1. Constructor builds config/state, creates canvas, binds events, and optionally starts loop.
2. `scanPlatforms(selector)` registers platform selectors.
3. `refreshDOMPlatforms()` reads DOM rectangles and caches platform data.
4. `loop(time)` updates target state, animations, path/jump decisions, and drawing each frame.

## Platform graph and A* search

### Graph build (`buildPathGraph`)

- Adds all scanned DOM platforms plus a synthetic ground platform.
- Samples multiple landing nodes per platform.
- Removes duplicate nodes by rounded coordinate key.
- Adds horizontal edges between neighbor nodes on the same platform.
- Adds jump edges to nearby candidates within jump limits.
- Uses x-axis buckets to limit candidate comparisons and reduce broad pairwise scans.

### Dynamic limits (`getDynamicPathParams`)

Per-jump limits are adjusted from:

- distance to target,
- mouse velocity,
- vertical intent (up/down/same-level),
- user tuning values.

### Search (`runShortestPaths`)

- Creates a temporary start node at current blob position.
- Builds start edges with relaxed start traversal limits.
- Runs A* using `f = g + h`.
- `h` is Euclidean distance to target, scaled by dynamic `heuristicWeight`.
- Records tree edges for debug rendering.

### Hop choice (`calculateNextHop`)

- Uses shortest-path output to score reachable nodes against the target.
- Chooses the next effective hop on the selected path.
- Supports projected landing on non-ground platforms.
- Falls back to direct reachable hop when needed.
- Updates metrics and debug path data for HUD and overlays.

## Jump and animation behavior

- `triggerJump(force)` validates cooldown and movement value before jumping.
- Jump motion combines x tween and two-phase y arc tween.
- Blob shape/rotation tweens create takeoff, flight, landing, and settle effects.
- `updateSecondaryAnimation` handles look direction, idle motion, stationary aura state, and blink timing.

## Rendering and debug output

- `draw()` clears canvas and renders shadow, blob body, eyes, and optional aura.
- `drawDebugPath()` renders graph overlays by mode:
  - `off`: no debug lines.
  - `used`: active chosen path only.
  - `calculated`: search tree edges.
  - `all`: full graph edges/nodes plus calculated edges and active path.

## Metrics

Default metric keys:

- `graphNodes`
- `graphEdges`
- `startOptions`
- `selectedPathLength`
- `targetError`
- `lastHopDistance`
- `expandedNodes`
- `solveMs`
- `fallbackCount`
- `mode`

Typical `mode` values:

- `idle`
- `searching`
- `astar`
- `fallback`
- `blocked`
- `none`

## SmartBlob methods reference

### Public methods

- `scanPlatforms(selector)`
- `start()`
- `stop()`
- `destroy()`
- `resetMetrics()`
- `setDebugMode(mode)`
- `cycleDebugMode()`

### Internal engine methods

- `countGraphEdges(graph)`
- `syncDebugGraphData(graph)`
- `initCanvas()`
- `bindEvents()`
- `unbindEvents()`
- `onMouseMove(event)`
- `onMouseDown(event)`
- `resize()`
- `refreshDOMPlatforms()`
- `updateMouseCoordinates()`
- `clamp(value, min, max)`
- `getDynamicPathParams()`
- `canTraverse(fromNode, toNode, limits)`
- `getGroundPlatform()`
- `buildPathGraph()`
- `getGraph()`
- `createStartNode(graph, limits)`
- `heuristicCost(a, b, weight)`
- `reconstructPath(cameFrom, currentId)`
- `getTraversalPenalty(currentNode, nextNode, limits)`
- `runShortestPaths(graph, startNode, startEdges, limits)`
- `pickBestReachableNode(graph, startNode, shortestPaths, limits)`
- `findDirectFallback(graph, startNode, limits)`
- `calculateNextHop()`
- `triggerJump(force)`
- `updateSecondaryAnimation(time)`
- `getBlinkAmount(time)`
- `drawDebugPath()`
- `draw()`
- `loop(time)`

## Lifecycle and cleanup

- `start()` begins the requestAnimationFrame loop.
- `stop()` stops the loop, unbinds events, and clears the canvas.
- `destroy()` calls `stop()`, removes the canvas element, and clears cached engine references.

## Browser and dependency notes

- No external libraries.
- Requires browser features used by the engine (`requestAnimationFrame`, canvas 2D context, `ResizeObserver`).
- Built for single-page DOM scenes with platform elements discovered by CSS selector.
