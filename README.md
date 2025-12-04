# 🟡 Meet the Smart Blob Engine

**A cute lil' pixel buddy that vibes on your website.**

The **Smart Blob Engine** makes a squishy little dude that wanders around your page. He chases your mouse, hops between stuff like buttons (we call 'em "platforms"), and does those satisfying squishy animations. Don't worry - he's lightweight and won't slow your site down.

## ✨ Cool Stuff He Does

  * **Smart Jumps:** Figures out the best way to get to your cursor
  * **Platform Finder:** You tell him what parts of the page he can stand on
  * **Bouncy Physics:** Smooth cartoon-style movement
  * **No Extra Baggage:** Runs on his own code, no big libraries needed
  * **Make It Yours:** Change his size, colors, and how fast he jumps

## 🚀 Let's Do This

1.  Add the `SmartBlob` code to your site (stick it in a script tag or file)
2.  Bring him to life!

```javascript
// Make your blob
const myBlob = new SmartBlob({
    size: 32,                 // How big (pixels)
    blobColor: '#ffe600',     // His body color
    eyeColor: '#000000'       // His eyes
});

// Tell him what to stand on
myBlob.scanPlatforms('button'); 
```

## 🎮 What He's Up To

  * **Mouse Stalker:** He's always watching your cursor. If you move far, he'll jump.
  * **Click To Jump:** Click anywhere empty and he'll leap immediately.
  * **Just Chillin':** If you ignore him, he'll hop around occasionally to stay entertained.

## ⚙️ Make It Your Own

Customize your blob with these options:

| Option | Default | What It Does |
| :--- | :--- | :--- |
| `container` | `document.body` | Where he lives |
| `size` | `32` | How big he is |
| `blobColor` | `'#ffe600'` | His body color |
| `eyeColor` | `'#000000'` | His eye color |
| `autoAttach` | `true` | If false, you gotta call `.start()` yourself |

## 🏗️ Building Playgrounds

Turn any part of your page into something your blob can stand on. Works great for nav bars, cards, whatever.

Use `scanPlatforms` with normal CSS selectors:

```javascript
// Let him stand on your navbar
myBlob.scanPlatforms('.navbar');

// Or on images
myBlob.scanPlatforms('img');

// Or on cards
myBlob.scanPlatforms('.card');
```

*Pro tip: He automatically treats the bottom of the page as ground.*

## 🕹️ Controlling Your Blob

Need to boss him around? Here's how:

  * **`myBlob.start()`**: Wakes him up
  * **`myBlob.stop()`**: Puts him to sleep (good for when users switch tabs)
  * **`myBlob.scanPlatforms(selector)`**: Makes him look for new stuff to stand on

## 🧠 Nerdy Details

He runs on custom code called `TweenManager`:

  * Handles multiple animations at once (like moving while changing size)
  * Uses fancy timing for smooth movement
  * Cleans up after himself (no memory leaks)

## 📄 Legal Stuff

Do whatever you want with this - it's free!
