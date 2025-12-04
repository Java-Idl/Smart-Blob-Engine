class TweenManager {
    constructor() { this.tweens = []; }
    
    add(target, props, duration, easing = 'linear', onComplete = null) {
        // FIX: Removed the filter that deleted existing tweens. 
        // Now allows X, Y, and Scale animations to happen at the same time.
        
        const tween = {
            target, props, startValues: {},
            startTime: performance.now(),
            duration, easing, onComplete
        };
        for (let key in props) tween.startValues[key] = target[key] || 0;
        this.tweens.push(tween);
    }

    update(time) {
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const t = this.tweens[i];
            const elapsed = time - t.startTime;
            let progress = Math.min(elapsed / t.duration, 1);
            const eased = this.ease(progress, t.easing);

            for (let key in t.props) {
                const start = t.startValues[key];
                const end = t.props[key];
                t.target[key] = start + (end - start) * eased;
            }

            if (progress >= 1) {
                if (t.onComplete) t.onComplete();
                // Ensure we only remove the completed tween
                const index = this.tweens.indexOf(t);
                if (index > -1) this.tweens.splice(index, 1);
            }
        }
    }

    ease(t, type) {
        switch(type) {
            case 'easeOutQuad': return 1 - (1 - t) * (1 - t);
            case 'easeInQuad': return t * t;
            case 'easeOutElastic': 
                const c4 = (2 * Math.PI) / 3;
                return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
            default: return t;
        }
    }
}

class SmartBlob {
    constructor(options = {}) {
        this.container = options.container || document.body;
        if (!this.container) return;

        this.config = {
            blobSize: options.size || 32,
            colors: {
                blob: options.blobColor || '#ffe600',
                eye: options.eyeColor || '#000000'
            },
            jumpSpeed: 500,
            jumpCooldown: 800
        };

        // State
        this.width = 0;
        this.height = 0;
        this.clientMouse = { x: 0, y: 0 };
        this.mouse = { x: 0, y: 0 };
        
        this.platforms = []; 
        this.selectors = new Set();
        this.tweens = new TweenManager();
        this.lastJumpTime = 0;
        this.rafId = null;

        // Blob State - Start at 0,0 but will be moved to ground in resize()
        this.blob = {
            x: 50, y: 0,
            scaleX: 1, scaleY: 1,
            isJumping: false
        };
        this.isInitialized = false;

        this.handleResize = this.resize.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseDown = this.onMouseDown.bind(this);

        this.initCanvas();
        this.bindEvents();
        
        if (options.autoAttach !== false) {
            this.start();
        }
    }

    initCanvas() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none'; 
        this.canvas.style.zIndex = '9999'; 
        this.canvas.style.imageRendering = 'pixelated';
        
        this.container.appendChild(this.canvas);
        
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        
        this.resize();
    }

    bindEvents() {
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mousedown', this.handleMouseDown);
    }

    unbindEvents() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('mousedown', this.handleMouseDown);
        if (this.resizeObserver) this.resizeObserver.disconnect();
    }

    onMouseMove(e) {
        this.clientMouse.x = e.clientX;
        this.clientMouse.y = e.clientY + window.scrollY;
    }

    onMouseDown(e) {
        if (e.target.closest('button, a, input, select, textarea, [role="button"]')) {
            return;
        }
        this.triggerJump(true);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        // Ensure we cover the whole scrollable area
        this.height = Math.max(
            document.body.scrollHeight, 
            document.documentElement.scrollHeight, 
            rect.height
        );
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Spawn Logic: If this is the first resize, teleport blob to ground
        const groundY = this.height;
        if (!this.isInitialized) {
            this.blob.y = groundY - this.config.blobSize;
            this.isInitialized = true;
        } else {
            // Safety: If blob falls out of screen, reset to ground
            if (this.blob.y > groundY - this.config.blobSize) {
                this.blob.y = groundY - this.config.blobSize;
            }
        }
        
        this.refreshDOMPlatforms();
    }

    scanPlatforms(selector) {
        this.selectors.add(selector);
        this.refreshDOMPlatforms();
    }

    refreshDOMPlatforms() {
        if (this.selectors.size === 0) return;
        
        this.platforms = this.platforms.filter(p => p.type !== 'dom');
        const scrollTop = window.scrollY || document.documentElement.scrollTop;

        this.selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    this.platforms.push({
                        x: rect.left + window.scrollX, 
                        y: rect.top + scrollTop,
                        w: rect.width,
                        h: rect.height,
                        type: 'dom'
                    });
                }
            });
        });
    }

    updateMouseCoordinates() {
        this.mouse.x = this.clientMouse.x;
        this.mouse.y = this.clientMouse.y; 
    }

    calculateNextHop() {
        const { x, y } = this.blob;
        const { x: mx, y: my } = this.mouse;
        const size = this.config.blobSize;

        const groundPlatform = { 
            x: 0, 
            y: this.height, 
            w: this.width, 
            h: 10, 
            isGround: true 
        };

        const allPlatforms = [...this.platforms, groundPlatform];
        const maxJump = 500;
        
        let idealX = x + (mx - x);
        if (Math.abs(mx - x) > maxJump) {
            idealX = x + Math.sign(mx - x) * maxJump;
        }

        let bestSpot = { x: x, y: y, score: Infinity };
        let found = false;

        const isMouseAbove = my < y;
        const verticalWeight = isMouseAbove ? 3.0 : 1.0;

        allPlatforms.forEach(p => {
            if (y > p.y && y < p.y + p.h) return;

            const diffY = p.y - (y + size);
            
            if (diffY < -500) return; 
            if (!p.isGround && diffY > 600) return;

            const platRight = p.x + p.w - size;
            const reachMin = x - maxJump;
            const reachMax = x + maxJump;
            
            const validMin = Math.max(p.x, reachMin);
            const validMax = Math.min(platRight, reachMax);

            if (validMin > validMax) return;

            const candidateX = Math.max(validMin, Math.min(validMax, idealX));
            
            const distY = Math.abs(p.y - my);
            const distX = Math.abs(candidateX - mx);
            let score = distY * verticalWeight + distX;

            if (Math.abs(p.y - (y + size)) < 5) score += 500;

            if (score < bestSpot.score) {
                bestSpot = { x: candidateX, y: p.y, score: score };
                found = true;
            }
        });

        if (!found) return null;
        if (Math.abs(bestSpot.x - x) < 10 && Math.abs(bestSpot.y - (y + size)) < 10) return null;
        
        return bestSpot;
    }

    triggerJump(force = false) {
        if (this.blob.isJumping) return;
        
        const now = performance.now();
        if (!force && now - this.lastJumpTime < this.config.jumpCooldown) return;

        const distToMouse = Math.hypot(this.blob.x - this.mouse.x, this.blob.y - this.mouse.y);
        if (!force && distToMouse < 60) return;

        const target = this.calculateNextHop();
        if (!target) return;

        this.blob.isJumping = true;
        this.lastJumpTime = now;
        
        const b = this.blob;
        const speed = this.config.jumpSpeed;
        const size = this.config.blobSize;

        // Animation Sequence
        // Note: Using multiple tweens simultaneously on 'b' now works
        this.tweens.add(b, { scaleX: 1.4, scaleY: 0.6 }, 150, 'easeOutQuad', () => {
            this.tweens.add(b, { scaleX: 0.7, scaleY: 1.3 }, 150, 'easeOutQuad');
            this.tweens.add(b, { x: target.x }, speed, 'linear');

            const startY = b.y;
            const endY = target.y - size;
            const peakY = Math.min(startY, endY) - 150;

            this.tweens.add(b, { y: peakY }, speed * 0.5, 'easeOutQuad', () => {
                this.tweens.add(b, { y: endY }, speed * 0.5, 'easeInQuad', () => {
                    b.y = endY; 
                    this.tweens.add(b, { scaleX: 1.5, scaleY: 0.5 }, 100, 'easeOutQuad', () => {
                        this.tweens.add(b, { scaleX: 1, scaleY: 1 }, 200, 'easeOutElastic', () => {
                            b.isJumping = false;
                        });
                    });
                });
            });
        });
    }

    draw() {
        const { ctx, config, blob } = this;
        const size = config.blobSize;

        ctx.clearRect(0, 0, this.width, this.height);

        const cx = blob.x + size / 2;
        const cy = blob.y + size;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(blob.scaleX, blob.scaleY);
        ctx.translate(-cx, -cy);

        ctx.fillStyle = config.colors.blob;
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        ctx.fillRect(blob.x, blob.y, size, size);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeRect(blob.x, blob.y, size, size);

        const centerX = blob.x + size / 2;
        const lookDir = (this.mouse.x > centerX ? 1 : -1) * 3;
        
        const eyeY = blob.y + 10;
        ctx.fillStyle = config.colors.eye;
        
        ctx.fillRect(blob.x + 6 + lookDir, eyeY, 6, 8);
        ctx.fillRect(blob.x + 18 + lookDir, eyeY, 6, 8);
        
        ctx.fillStyle = 'white';
        ctx.fillRect(blob.x + 6 + lookDir, eyeY, 2, 2);
        ctx.fillRect(blob.x + 18 + lookDir, eyeY, 2, 2);

        ctx.restore();
    }

    loop(time) {
        if (!this.rafId) return;
        
        this.updateMouseCoordinates();
        this.tweens.update(time);
        
        if (!this.blob.isJumping && Math.random() > 0.99) {
            this.triggerJump();
        }

        this.draw();
        this.rafId = requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        if (!this.rafId) {
            this.rafId = requestAnimationFrame((t) => this.loop(t));
        }
    }

    stop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.unbindEvents();
        this.ctx.clearRect(0, 0, this.width, this.height);
    }
}
