class TweenManager {
    constructor() {
        this.tweens = [];
    }

    add(target, props, duration, easing = 'linear', onComplete = null) {
        const tween = {
            target,
            props,
            startValues: {},
            startTime: performance.now(),
            duration,
            easing,
            onComplete
        };

        for (const key in props) {
            tween.startValues[key] = target[key] ?? 0;
        }

        this.tweens.push(tween);
    }

    update(time) {
        for (let index = this.tweens.length - 1; index >= 0; index--) {
            const tween = this.tweens[index];
            const elapsed = time - tween.startTime;
            const progress = Math.min(elapsed / tween.duration, 1);
            const eased = this.ease(progress, tween.easing);

            for (const key in tween.props) {
                const start = tween.startValues[key];
                const end = tween.props[key];
                tween.target[key] = start + (end - start) * eased;
            }

            if (progress >= 1) {
                if (tween.onComplete) tween.onComplete();
                this.tweens.splice(index, 1);
            }
        }
    }

    remove(target, keys = null) {
        const keySet = Array.isArray(keys) && keys.length > 0 ? new Set(keys) : null;

        this.tweens = this.tweens.filter((tween) => {
            if (tween.target !== target) return true;
            if (!keySet) return false;
            return !Object.keys(tween.props).some((key) => keySet.has(key));
        });
    }

    ease(t, type) {
        switch (type) {
            case 'easeOutQuad':
                return 1 - (1 - t) * (1 - t);
            case 'easeInQuad':
                return t * t;
            case 'easeInOutQuad':
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            case 'easeOutCubic':
                return 1 - Math.pow(1 - t, 3);
            case 'easeInCubic':
                return t * t * t;
            case 'easeOutElastic': {
                const c4 = (2 * Math.PI) / 3;
                if (t === 0) return 0;
                if (t === 1) return 1;
                return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
            }
            default:
                return t;
        }
    }
}

class MinPriorityQueue {
    constructor() {
        this.items = [];
    }

    push(nodeId, priority) {
        this.items.push({ nodeId, priority });
        this.bubbleUp(this.items.length - 1);
    }

    pop() {
        if (this.items.length === 0) return null;
        const min = this.items[0];
        const end = this.items.pop();
        if (this.items.length > 0) {
            this.items[0] = end;
            this.sinkDown(0);
        }
        return min;
    }

    size() {
        return this.items.length;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.items[parent].priority <= this.items[index].priority) break;
            [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
            index = parent;
        }
    }

    sinkDown(index) {
        const length = this.items.length;
        while (true) {
            const left = index * 2 + 1;
            const right = index * 2 + 2;
            let smallest = index;

            if (left < length && this.items[left].priority < this.items[smallest].priority) {
                smallest = left;
            }
            if (right < length && this.items[right].priority < this.items[smallest].priority) {
                smallest = right;
            }

            if (smallest === index) break;
            [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
            index = smallest;
        }
    }
}

class BlobEngineMetrics {
    constructor(initialMetrics = {}) {
        this.values = { ...initialMetrics };
        this.listeners = new Set();
    }

    get(key, fallback = 0) {
        const value = this.values[key];
        return value === undefined ? fallback : value;
    }

    set(key, value) {
        this.values[key] = value;
        this.emit();
    }

    update(partialMetrics = {}) {
        this.values = { ...this.values, ...partialMetrics };
        this.emit();
    }

    increment(key, delta = 1) {
        const current = Number(this.get(key, 0));
        this.values[key] = current + delta;
        this.emit();
    }

    reset(defaultMetrics = {}) {
        this.values = { ...defaultMetrics };
        this.emit();
    }

    snapshot() {
        return { ...this.values };
    }

    subscribe(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit() {
        for (const listener of this.listeners) {
            listener(this.snapshot());
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
            jumpSpeed: options.jumpSpeed || 500,
            jumpCooldown: options.jumpCooldown || 260,
            maxJumpX: options.maxJumpX || 320,
            maxJumpUp: options.maxJumpUp || 260,
            maxDropDown: options.maxDropDown || 520,
            pathGoalCandidates: options.pathGoalCandidates || 6,
            maxNeighborsPerNode: options.maxNeighborsPerNode || 12,
            adaptivePathfinding: options.adaptivePathfinding !== false,
            predictiveLookaheadMs: options.predictiveLookaheadMs || 240,
            maxDynamicJumpBoost: options.maxDynamicJumpBoost || 0.45,
            maxDynamicGoalCandidates: options.maxDynamicGoalCandidates || 12,
            climbAggression: options.climbAggression || 1,
            dropAggression: options.dropAggression || 1,
            minMoveDistance: options.minMoveDistance || 6,
            flatMoveBias: options.flatMoveBias || 1,
            flatArcMax: options.flatArcMax || 64,
            targetPredictionWeight: options.targetPredictionWeight || 0
        };

        this.width = 0;
        this.height = 0;
        this.clientMouse = { x: 0, y: 0 };
        this.mouse = { x: 0, y: 0 };
        this.mouseVelocity = { x: 0, y: 0, speed: 0 };
        this.lastMouseSample = { x: 0, y: 0, t: performance.now() };

        this.platforms = [];
        this.selectors = new Set();
        this.tweens = new TweenManager();
        this.lastJumpTime = 0;
        this.rafId = null;

        this.blob = {
            x: 50,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            isJumping: false
        };

        this.animation = {
            lastFrameTime: performance.now(),
            idleTime: 0,
            lookOffset: 0,
            blinkWindowStart: -1,
            nextBlinkAt: performance.now() + 1200 + Math.random() * 2800,
            stationaryTime: 0,
            stationaryStrength: 0,
            lastBlobX: this.blob.x,
            lastBlobY: this.blob.y
        };

        this.defaultMetrics = {
            graphNodes: 0,
            graphEdges: 0,
            startOptions: 0,
            selectedPathLength: 0,
            targetError: 0,
            lastHopDistance: 0,
            expandedNodes: 0,
            solveMs: 0,
            fallbackCount: 0,
            mode: 'idle'
        };

        this.metrics = new BlobEngineMetrics(this.defaultMetrics);

        const initialDebugMode = options.debugMode || (options.debugPath ? 'used' : 'off');
        this.debug = {
            mode: 'off',
            enabled: false,
            nodes: [],
            edges: [],
            calculatedEdges: [],
            activePath: [],
            metrics: this.metrics
        };
        this.setDebugMode(initialDebugMode);

        this.isInitialized = false;
        this.cachedGraph = null;

        this.handleResize = this.resize.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseDown = this.onMouseDown.bind(this);

        this.initCanvas();
        this.bindEvents();

        if (options.autoAttach !== false) {
            this.start();
        }
    }

    resetMetrics() {
        const resetSnapshot = {
            ...this.defaultMetrics,
            mode: 'idle'
        };

        this.metrics.reset(resetSnapshot);
        this.debug.activePath = [];
        this.debug.calculatedEdges = [];
        this.lastJumpTime = performance.now();
    }

    setDebugMode(mode = 'off') {
        const allowedModes = new Set(['off', 'used', 'calculated', 'all']);
        const nextMode = allowedModes.has(mode) ? mode : 'off';
        this.debug.mode = nextMode;
        this.debug.enabled = nextMode !== 'off';

        if (this.debug.enabled) {
            this.syncDebugGraphData();
        }
    }

    cycleDebugMode() {
        const orderedModes = ['off', 'used', 'calculated', 'all'];
        const currentIndex = orderedModes.indexOf(this.debug.mode);
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % orderedModes.length;
        const nextMode = orderedModes[nextIndex];
        this.setDebugMode(nextMode);
        return nextMode;
    }

    countGraphEdges(graph) {
        let edgeCount = 0;
        for (const neighbors of graph.edges.values()) {
            edgeCount += neighbors.length;
        }
        return edgeCount;
    }

    syncDebugGraphData(graph = this.cachedGraph) {
        if (!graph) {
            this.debug.nodes = [];
            this.debug.edges = [];
            return;
        }

        this.debug.nodes = graph.nodes;
        this.debug.edges = Array.from(graph.edges.entries()).flatMap(([from, list]) => {
            return list.map((edge) => ({ from, to: edge.to }));
        });
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

    onMouseMove(event) {
        const now = performance.now();
        const nextX = event.clientX;
        const nextY = event.clientY + window.scrollY;
        const dt = Math.max(1, now - this.lastMouseSample.t);

        const rawVx = (nextX - this.lastMouseSample.x) / dt;
        const rawVy = (nextY - this.lastMouseSample.y) / dt;
        const alpha = 0.22;

        this.mouseVelocity.x = this.mouseVelocity.x * (1 - alpha) + rawVx * alpha;
        this.mouseVelocity.y = this.mouseVelocity.y * (1 - alpha) + rawVy * alpha;
        this.mouseVelocity.speed = Math.hypot(this.mouseVelocity.x, this.mouseVelocity.y);

        this.lastMouseSample.x = nextX;
        this.lastMouseSample.y = nextY;
        this.lastMouseSample.t = now;

        this.clientMouse.x = nextX;
        this.clientMouse.y = nextY;
    }

    onMouseDown(event) {
        if (event.target.closest('button, a, input, select, textarea, [role="button"]')) {
            return;
        }
        this.triggerJump(true);
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.width = Math.max(1, Math.floor(rect.width));
        this.height = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            Math.floor(rect.height)
        );

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        const groundY = this.height;
        if (!this.isInitialized) {
            this.blob.y = groundY - this.config.blobSize;
            this.isInitialized = true;
        } else if (this.blob.y > groundY - this.config.blobSize) {
            this.blob.y = groundY - this.config.blobSize;
        }

        this.refreshDOMPlatforms();
    }

    scanPlatforms(selector) {
        this.selectors.add(selector);
        this.refreshDOMPlatforms();
    }

    refreshDOMPlatforms() {
        this.platforms = [];

        const scrollTop = window.scrollY || document.documentElement.scrollTop;

        this.selectors.forEach((selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;

                this.platforms.push({
                    x: rect.left + window.scrollX,
                    y: rect.top + scrollTop,
                    w: rect.width,
                    h: rect.height,
                    type: 'dom'
                });
            });
        });

        this.platforms.sort((left, right) => left.y - right.y || left.x - right.x);
        this.cachedGraph = null;
    }

    updateMouseCoordinates() {
        this.mouse.x = this.clientMouse.x;
        this.mouse.y = this.clientMouse.y;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    getDynamicPathParams() {
        const targetDistance = Math.hypot(this.blob.x - this.mouse.x, this.blob.y - this.mouse.y);
        const distanceRatio = this.clamp(targetDistance / 900, 0, 1);
        const speedRatio = this.clamp(this.mouseVelocity.speed / 1.1, 0, 1);
        const urgency = this.config.adaptivePathfinding
            ? this.clamp(distanceRatio * 0.65 + speedRatio * 0.35, 0, 1)
            : 0;

        const boost = 1 + this.config.maxDynamicJumpBoost * urgency;
        const predictedX = this.mouse.x + this.mouseVelocity.x * this.config.predictiveLookaheadMs;
        const predictedY = this.mouse.y + this.mouseVelocity.y * this.config.predictiveLookaheadMs * 0.35;
        const predictionWeight = this.clamp(this.config.targetPredictionWeight, 0, 1);
        const effectiveTargetX = this.mouse.x + (predictedX - this.mouse.x) * predictionWeight;
        const effectiveTargetY = this.mouse.y + (predictedY - this.mouse.y) * predictionWeight;

        const verticalDelta = this.blob.y - effectiveTargetY;
        const wantsUp = this.clamp(verticalDelta / 520, 0, 1);
        const wantsDown = this.clamp(-verticalDelta / 520, 0, 1);
        const sameLevelIntent = this.clamp(1 - Math.abs(verticalDelta) / 120, 0, 1);
        const climbAggression = this.clamp(this.config.climbAggression, 0.4, 2.5);
        const dropAggression = this.clamp(this.config.dropAggression, 0.4, 2.5);
        const flatMoveBias = this.clamp(this.config.flatMoveBias, 0.4, 3);

        const maxJumpX = this.config.maxJumpX * boost;
        const maxJumpUp = this.config.maxJumpUp * (1 + 0.32 * urgency + 0.42 * wantsUp * climbAggression);
        const maxDropDown = this.config.maxDropDown * (1 + 0.25 * urgency + 0.34 * wantsDown * dropAggression);
        const goalCandidates = Math.round(
            this.config.pathGoalCandidates +
            (this.config.maxDynamicGoalCandidates - this.config.pathGoalCandidates) * (urgency * 0.7 + wantsUp * 0.3 * climbAggression)
        );
        const neighborLimit = Math.round(this.config.maxNeighborsPerNode + 4 * urgency);
        const heuristicWeight = 1 + 0.25 * urgency;

        return {
            urgency,
            wantsUp,
            wantsDown,
            sameLevelIntent,
            flatMoveBias,
            maxJumpX,
            maxJumpUp,
            maxDropDown,
            goalCandidates,
            neighborLimit,
            heuristicWeight,
            targetX: this.clamp(effectiveTargetX, 0, this.width),
            targetY: this.clamp(effectiveTargetY, 0, this.height)
        };
    }

    canTraverse(fromNode, toNode, limits) {
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        if (Math.abs(dx) > limits.maxJumpX) return false;
        if (dy < -limits.maxJumpUp) return false;
        if (dy > limits.maxDropDown) return false;
        return true;
    }

    getGroundPlatform() {
        return {
            x: 0,
            y: this.height,
            w: this.width,
            h: 10,
            isGround: true,
            type: 'ground'
        };
    }

    buildPathGraph() {
        const size = this.config.blobSize;
        const platforms = [...this.platforms, this.getGroundPlatform()];

        const nodes = [];

        const pushNode = (platformIndex, x, y) => {
            nodes.push({
                id: nodes.length,
                platformIndex,
                x,
                y,
                key: `${Math.round(x)}:${Math.round(y)}`
            });
        };

        platforms.forEach((platform, platformIndex) => {
            const minX = platform.x;
            const maxX = platform.x + platform.w - size;
            if (maxX < minX) return;

            const y = platform.y - size;
            const centerX = (minX + maxX) / 2;

            pushNode(platformIndex, minX, y);
            pushNode(platformIndex, minX + (maxX - minX) * 0.25, y);
            pushNode(platformIndex, centerX, y);
            pushNode(platformIndex, minX + (maxX - minX) * 0.75, y);
            pushNode(platformIndex, maxX, y);

            const genericStep = Math.max(size * 1.15, 56);
            for (let x = minX; x <= maxX; x += genericStep) {
                pushNode(platformIndex, x, y);
            }
            if (maxX - minX > 0) pushNode(platformIndex, maxX, y);

            if (platform.isGround) {
                const step = Math.max(size * 1.6, 110);
                for (let x = minX; x <= maxX; x += step) {
                    pushNode(platformIndex, x, y);
                }
                if (maxX - minX > 0) pushNode(platformIndex, maxX, y);
            }
        });

        const uniqueNodes = [];
        const seen = new Set();
        nodes.forEach((node) => {
            if (seen.has(node.key)) return;
            seen.add(node.key);
            node.id = uniqueNodes.length;
            uniqueNodes.push(node);
        });

        const edges = new Map();
        for (const node of uniqueNodes) {
            edges.set(node.id, []);
        }

        const graphMaxJumpX = this.config.maxJumpX * (1 + this.config.maxDynamicJumpBoost + 0.15);
        const graphMaxJumpUp = this.config.maxJumpUp * 1.8;
        const graphMaxDropDown = this.config.maxDropDown * 1.8;
        const maxNeighborsPerNode = this.config.maxNeighborsPerNode;

        const costBetween = (fromNode, toNode) => {
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const distanceCost = Math.hypot(dx, dy);
            const verticalPenalty = dy < 0 ? Math.abs(dy) * 0.4 : dy * 0.12;
            const lateralPenalty = Math.abs(dx) * 0.04;
            return distanceCost + verticalPenalty + lateralPenalty;
        };

        const addEdge = (fromNode, toNode) => {
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;

            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
            if (Math.abs(dx) > graphMaxJumpX) return;
            if (dy < -graphMaxJumpUp) return;
            if (dy > graphMaxDropDown) return;

            edges.get(fromNode.id).push({ to: toNode.id, cost: costBetween(fromNode, toNode) });
        };

        const nodeIdsByPlatform = new Map();
        for (const node of uniqueNodes) {
            if (!nodeIdsByPlatform.has(node.platformIndex)) {
                nodeIdsByPlatform.set(node.platformIndex, []);
            }
            nodeIdsByPlatform.get(node.platformIndex).push(node.id);
        }

        for (const ids of nodeIdsByPlatform.values()) {
            ids.sort((leftId, rightId) => uniqueNodes[leftId].x - uniqueNodes[rightId].x);
            for (let index = 0; index < ids.length - 1; index++) {
                const leftNode = uniqueNodes[ids[index]];
                const rightNode = uniqueNodes[ids[index + 1]];

                const horizontalCost = Math.max(8, Math.abs(rightNode.x - leftNode.x) * 0.35);
                edges.get(leftNode.id).push({ to: rightNode.id, cost: horizontalCost });
                edges.get(rightNode.id).push({ to: leftNode.id, cost: horizontalCost });
            }
        }

        for (const fromNode of uniqueNodes) {
            const reachable = [];

            for (const toNode of uniqueNodes) {
                if (fromNode.id === toNode.id) continue;
                const dx = toNode.x - fromNode.x;
                const dy = toNode.y - fromNode.y;

                if (Math.abs(dx) > graphMaxJumpX) continue;
                if (dy < -graphMaxJumpUp || dy > graphMaxDropDown) continue;

                const cost = costBetween(fromNode, toNode);
                const rank = cost + (fromNode.platformIndex === toNode.platformIndex ? 50 : 0);
                reachable.push({ toNode, cost, rank });
            }

            reachable
                .sort((left, right) => left.rank - right.rank)
                .slice(0, maxNeighborsPerNode)
                .forEach(({ toNode }) => addEdge(fromNode, toNode));
        }

        this.cachedGraph = {
            nodes: uniqueNodes,
            edges,
            platforms
        };

        if (this.debug.enabled) {
            this.syncDebugGraphData(this.cachedGraph);
        }

        return this.cachedGraph;
    }

    getGraph() {
        const graph = this.cachedGraph || this.buildPathGraph();
        if (this.debug.enabled) {
            this.syncDebugGraphData(graph);
        }
        return graph;
    }

    createStartNode(graph, limits) {
        const startNode = {
            id: -1,
            platformIndex: -1,
            x: this.blob.x,
            y: this.blob.y
        };
        const startLimits = {
            ...limits,
            maxJumpX: limits.maxJumpX * 1.35,
            maxJumpUp: limits.maxJumpUp * 1.2,
            maxDropDown: limits.maxDropDown * 1.3
        };
        const candidateEdges = [];

        for (const node of graph.nodes) {
            if (!this.canTraverse(startNode, node, startLimits)) continue;

            const dx = node.x - startNode.x;
            const dy = node.y - startNode.y;

            const cost = Math.hypot(dx, dy) + Math.abs(dx) * 0.03 + (dy < 0 ? Math.abs(dy) * 0.4 : dy * 0.1);
            const targetDx = node.x - limits.targetX;
            const targetDy = node.y - limits.targetY;
            const targetDistance = Math.hypot(targetDx, targetDy);

            let intentPenalty = 0;
            if (limits.wantsUp > 0.12 && dy > 0) {
                intentPenalty += dy * (0.2 + limits.wantsUp * 0.25);
            }
            if (limits.wantsDown > 0.12 && dy < 0) {
                intentPenalty += Math.abs(dy) * (0.18 + limits.wantsDown * 0.24);
            }

            const rank = targetDistance + cost * 0.08 + intentPenalty;
            candidateEdges.push({ to: node.id, cost, dy, rank });
        }

        candidateEdges.sort((left, right) => left.rank - right.rank);

        const neighborLimit = Math.max(20, limits.neighborLimit * 2);
        const directionalReserve = Math.max(6, Math.floor(neighborLimit * 0.35));

        const upwardEdges = candidateEdges.filter((edge) => edge.dy < 0).slice(0, directionalReserve);
        const downwardEdges = candidateEdges.filter((edge) => edge.dy > 0).slice(0, directionalReserve);

        const selected = new Map();
        for (const edge of upwardEdges) selected.set(edge.to, edge);
        for (const edge of downwardEdges) selected.set(edge.to, edge);

        for (const edge of candidateEdges) {
            if (selected.size >= neighborLimit) break;
            if (!selected.has(edge.to)) {
                selected.set(edge.to, edge);
            }
        }

        const startEdges = Array.from(selected.values())
            .sort((left, right) => left.cost - right.cost)
            .map(({ to, cost }) => ({ to, cost }));

        return { startNode, startEdges };
    }

    heuristicCost(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    reconstructPath(cameFrom, currentId) {
        const fullPath = [currentId];
        while (cameFrom.has(currentId)) {
            currentId = cameFrom.get(currentId);
            fullPath.push(currentId);
        }
        fullPath.reverse();
        return fullPath;
    }

    getTraversalPenalty(currentNode, nextNode, limits) {
        const dy = nextNode.y - currentNode.y;
        let verticalIntentPenalty = 0;
        const flatMoveBias = this.clamp(this.config.flatMoveBias, 0.4, 3);

        if (limits.sameLevelIntent > 0.2 && Math.abs(dy) > 1) {
            verticalIntentPenalty += Math.abs(dy) * (0.12 + limits.sameLevelIntent * 0.2) * flatMoveBias;
        }

        if (limits.wantsUp > 0.15 && dy > 0) {
            verticalIntentPenalty += dy * (0.22 + limits.wantsUp * 0.3) * this.clamp(this.config.climbAggression, 0.4, 2.5);
        }
        if (limits.wantsDown > 0.15 && dy < 0) {
            verticalIntentPenalty += Math.abs(dy) * (0.14 + limits.wantsDown * 0.22) * this.clamp(this.config.dropAggression, 0.4, 2.5);
        }
        return verticalIntentPenalty;
    }

    runShortestPaths(graph, startNode, startEdges, limits) {
        const startId = startNode.id;
        const queue = new MinPriorityQueue();
        const visited = new Set();
        let expandedNodes = 0;
        const startTraversalLimits = {
            ...limits,
            maxJumpX: limits.maxJumpX * 1.35,
            maxJumpUp: limits.maxJumpUp * 1.2,
            maxDropDown: limits.maxDropDown * 1.3
        };

        const cameFrom = new Map();
        const gScore = new Map();
        gScore.set(startId, 0);
        queue.push(startId, 0);

        while (queue.size() > 0) {
            const currentEntry = queue.pop();
            if (!currentEntry) break;

            const currentId = currentEntry.nodeId;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            expandedNodes++;

            const neighbors = currentId === startId ? startEdges : (graph.edges.get(currentId) || []);
            const currentNode = currentId === startId ? startNode : graph.nodes[currentId];

            for (const edge of neighbors) {
                const nextNode = graph.nodes[edge.to];
                if (!nextNode) continue;
                const traversalLimits = currentId === startId ? startTraversalLimits : limits;
                if (!this.canTraverse(currentNode, nextNode, traversalLimits)) continue;

                const verticalIntentPenalty = this.getTraversalPenalty(currentNode, nextNode, limits);
                const tentativeG = (gScore.get(currentId) ?? Infinity) + edge.cost + verticalIntentPenalty;
                const bestKnown = gScore.get(edge.to) ?? Infinity;

                if (tentativeG >= bestKnown) continue;

                cameFrom.set(edge.to, currentId);
                gScore.set(edge.to, tentativeG);
                queue.push(edge.to, tentativeG);
            }
        }

        return {
            gScore,
            cameFrom,
            expandedNodes,
            treeEdges: Array.from(cameFrom.entries()).map(([to, from]) => ({ from, to }))
        };
    }

    pickBestReachableNode(graph, startNode, shortestPaths, limits) {
        let best = null;
        const size = this.config.blobSize;
        const flatMoveBias = this.clamp(this.config.flatMoveBias, 0.4, 3);
        const currentDistanceToTarget = Math.hypot(
            (startNode.x + size / 2) - limits.targetX,
            (startNode.y + size / 2) - limits.targetY
        );
        const startCenterY = startNode.y + size / 2;
        const verticalWeight = 1 + Math.max(limits.wantsUp, limits.wantsDown) * 0.8;
        const horizontalWeight = 0.95;

        for (const node of graph.nodes) {
            const basePathCost = shortestPaths.gScore.get(node.id);
            if (basePathCost === undefined || !Number.isFinite(basePathCost)) continue;

            const nodeCenterY = node.y + size / 2;
            const platform = graph.platforms[node.platformIndex];

            const evaluateLanding = (landingX, landingY, extraCost = 0) => {
                const landingCenterY = landingY + size / 2;
                const dx = (landingX + size / 2) - limits.targetX;
                const dy = landingCenterY - limits.targetY;
                const targetDistance = Math.hypot(dx * horizontalWeight, dy * verticalWeight);
                const sameLevelPenalty = Math.abs(landingCenterY - startCenterY) * limits.sameLevelIntent * 0.22 * flatMoveBias;
                const pathCost = basePathCost + extraCost;
                const score = targetDistance + sameLevelPenalty;

                if (!best) {
                    best = {
                        nodeId: node.id,
                        score,
                        pathCost,
                        targetDistance,
                        landingX,
                        landingY,
                        isProjected: extraCost > 0
                    };
                    return;
                }

                const distanceDelta = targetDistance - best.targetDistance;
                const distanceEpsilon = 2.5;
                if (
                    distanceDelta < -distanceEpsilon ||
                    (Math.abs(distanceDelta) <= distanceEpsilon && score < best.score) ||
                    (Math.abs(distanceDelta) <= 0.35 && pathCost < best.pathCost)
                ) {
                    best = {
                        nodeId: node.id,
                        score,
                        pathCost,
                        targetDistance,
                        landingX,
                        landingY,
                        isProjected: extraCost > 0
                    };
                }
            };

            evaluateLanding(node.x, node.y, 0);

            if (platform && !platform.isGround) {
                const projectedX = this.clamp(limits.targetX, platform.x, platform.x + platform.w - size);
                const horizontalMoveCost = Math.abs(projectedX - node.x) * 0.22;
                evaluateLanding(projectedX, node.y, horizontalMoveCost);
            }
        }

        if (!best) return null;

        const path = this.reconstructPath(shortestPaths.cameFrom, best.nodeId);
        if (!path || path.length < 2) return null;

        return {
            nodeId: best.nodeId,
            path,
            score: best.score,
            targetDistance: best.targetDistance,
            currentDistanceToTarget,
            improvement: Math.max(0, currentDistanceToTarget - best.targetDistance),
            pathCost: best.pathCost,
            landingX: best.landingX,
            landingY: best.landingY,
            isProjected: best.isProjected
        };
    }

    findDirectFallback(graph, startNode, limits) {
        let best = null;

        for (const node of graph.nodes) {
            if (!this.canTraverse(startNode, node, limits)) continue;

            const movementDistance = Math.hypot(node.x - startNode.x, node.y - startNode.y);
            if (movementDistance <= 1) continue;

            const dy = node.y - startNode.y;
            let directionPenalty = 0;
            if (limits.wantsUp > 0.15 && dy > 0) directionPenalty += dy * 0.25 * this.clamp(this.config.climbAggression, 0.4, 2.5);
            if (limits.wantsDown > 0.15 && dy < 0) directionPenalty += Math.abs(dy) * 0.2 * this.clamp(this.config.dropAggression, 0.4, 2.5);

            const score =
                Math.hypot(node.x - limits.targetX, node.y - limits.targetY) +
                Math.abs(node.y - startNode.y) * 0.2 +
                directionPenalty;
            if (!best || score < best.score) {
                best = { node, score };
            }
        }

        return best;
    }

    calculateNextHop() {
        const solveStart = performance.now();
        const limits = this.getDynamicPathParams();
        const graph = this.getGraph();
        const { startNode, startEdges } = this.createStartNode(graph, limits);
        const graphEdgeCount = this.countGraphEdges(graph);
        const blobCenterX = startNode.x + this.config.blobSize / 2;
        const blobCenterY = startNode.y + this.config.blobSize / 2;
        const currentDistanceToTarget = Math.hypot(blobCenterX - limits.targetX, blobCenterY - limits.targetY);

        this.metrics.update({
            graphNodes: graph.nodes.length,
            graphEdges: graphEdgeCount,
            startOptions: startEdges.length,
            selectedPathLength: 0,
            targetError: 0,
            expandedNodes: 0,
            solveMs: 0,
            mode: 'searching'
        });

        if (startEdges.length === 0) {
            if (this.debug.enabled) {
                this.debug.activePath = [];
                this.debug.calculatedEdges = [];
            }
            this.metrics.update({
                mode: 'blocked',
                solveMs: performance.now() - solveStart
            });
            return null;
        }

        const shortestPaths = this.runShortestPaths(graph, startNode, startEdges, limits);
        this.metrics.update({
            expandedNodes: shortestPaths.expandedNodes,
            startOptions: startEdges.length
        });

        if (this.debug.enabled) {
            this.debug.calculatedEdges = shortestPaths.treeEdges;
        }

        const bestReachable = this.pickBestReachableNode(graph, startNode, shortestPaths, limits);

        if (bestReachable) {
            let normalizedPath = Array.isArray(bestReachable.path) ? [...bestReachable.path] : [];
            if (normalizedPath.length >= 2 && normalizedPath[0] !== -1 && normalizedPath[normalizedPath.length - 1] === -1) {
                normalizedPath.reverse();
            }

            const startIndex = normalizedPath.indexOf(-1);
            let selectedNextIndex = -1;
            let nextNodeId = null;

            if (startIndex >= 0 && startIndex < normalizedPath.length - 1) {
                for (let index = startIndex + 1; index < normalizedPath.length; index++) {
                    const candidateId = normalizedPath[index];
                    const candidateNode = graph.nodes[candidateId];
                    if (!candidateNode) continue;

                    const candidateDistance = Math.hypot(candidateNode.x - startNode.x, candidateNode.y - startNode.y);
                    if (candidateDistance <= 1) continue;

                    nextNodeId = candidateId;
                    selectedNextIndex = index;
                    break;
                }
            }

            const nextNode = nextNodeId === null ? null : graph.nodes[nextNodeId];

            if (!nextNode && Number.isFinite(bestReachable.landingX) && Number.isFinite(bestReachable.landingY)) {
                const projectedNode = { x: bestReachable.landingX, y: bestReachable.landingY };
                const projectedDistance = Math.hypot(projectedNode.x - startNode.x, projectedNode.y - startNode.y);

                if (projectedDistance > 1 && this.canTraverse(startNode, projectedNode, limits)) {
                    if (this.debug.enabled) {
                        const pathNodes = normalizedPath.map((id) => (id === -1 ? startNode : graph.nodes[id])).filter(Boolean);
                        pathNodes.push({ x: bestReachable.landingX, y: bestReachable.landingY });
                        this.debug.activePath = pathNodes;
                    }

                    this.metrics.update({
                        selectedPathLength: normalizedPath.length,
                        targetError: bestReachable.targetDistance,
                        mode: 'astar',
                        solveMs: performance.now() - solveStart
                    });

                    return {
                        x: bestReachable.landingX,
                        y: bestReachable.landingY + this.config.blobSize,
                        path: normalizedPath,
                        targetError: bestReachable.targetDistance,
                        mode: 'astar',
                        improvement: bestReachable.improvement
                    };
                }
            }

            if (nextNode) {
                if (this.debug.enabled) {
                    const pathNodes = normalizedPath.map((id) => (id === -1 ? startNode : graph.nodes[id])).filter(Boolean);
                    if (bestReachable.isProjected) {
                        pathNodes.push({ x: bestReachable.landingX, y: bestReachable.landingY });
                    }
                    this.debug.activePath = pathNodes;
                }

                this.metrics.update({
                    selectedPathLength: normalizedPath.length,
                    targetError: bestReachable.targetDistance,
                    mode: 'astar',
                    solveMs: performance.now() - solveStart
                });

                const remainingPathLength = selectedNextIndex >= 0
                    ? (normalizedPath.length - selectedNextIndex + 1)
                    : normalizedPath.length;
                const useProjectedLanding = remainingPathLength <= 2 && Number.isFinite(bestReachable.landingX) && Number.isFinite(bestReachable.landingY);
                const finalX = useProjectedLanding ? bestReachable.landingX : nextNode.x;
                const finalY = useProjectedLanding ? bestReachable.landingY + this.config.blobSize : nextNode.y + this.config.blobSize;

                return {
                    x: finalX,
                    y: finalY,
                    path: normalizedPath,
                    targetError: bestReachable.targetDistance,
                    mode: 'astar',
                    improvement: bestReachable.improvement
                };
            }
        }

        const fallback = this.findDirectFallback(graph, startNode, limits);
        if (fallback?.node) {
            const fallbackNode = fallback.node;
            if (this.debug.enabled) {
                this.debug.activePath = [startNode, fallbackNode];
            }

            this.metrics.update({
                selectedPathLength: 2,
                targetError: Math.hypot(
                    (fallbackNode.x + this.config.blobSize / 2) - limits.targetX,
                    (fallbackNode.y + this.config.blobSize / 2) - limits.targetY
                ),
                mode: 'fallback',
                solveMs: performance.now() - solveStart
            });
            this.metrics.increment('fallbackCount', 1);

            const fallbackTargetError = Math.hypot(
                (fallbackNode.x + this.config.blobSize / 2) - limits.targetX,
                (fallbackNode.y + this.config.blobSize / 2) - limits.targetY
            );

            return {
                x: fallbackNode.x,
                y: fallbackNode.y + this.config.blobSize,
                path: [startNode.id, fallbackNode.id],
                targetError: fallbackTargetError,
                mode: 'fallback',
                improvement: Math.max(0, currentDistanceToTarget - fallbackTargetError)
            };
        }

        if (this.debug.enabled) {
            this.debug.activePath = [];
        }

        this.metrics.update({
            mode: 'none',
            solveMs: performance.now() - solveStart
        });

        return null;
    }

    triggerJump(force = false) {
        if (this.blob.isJumping) return;

        const now = performance.now();
        if (!force && now - this.lastJumpTime < this.config.jumpCooldown) return;

        const target = this.calculateNextHop();
        if (!target) return;

        const plannedTopY = target.y - this.config.blobSize;
        const plannedDistance = Math.hypot(target.x - this.blob.x, plannedTopY - this.blob.y);
        if (!force && plannedDistance < this.config.minMoveDistance) {
            const isFallbackHop = target.mode === 'fallback';
            const isAStarSetupHop = target.mode === 'astar' && Array.isArray(target.path) && target.path.length >= 3;
            const setupHopThreshold = Math.max(0.75, this.config.minMoveDistance * 0.2);

            if (
                (isFallbackHop && plannedDistance >= this.config.minMoveDistance * 0.5) ||
                (isAStarSetupHop && plannedDistance >= setupHopThreshold)
            ) {
                // allow short corrective fallback hops
            } else {
            const blobCenterX = this.blob.x + this.config.blobSize / 2;
            const blobCenterY = this.blob.y + this.config.blobSize / 2;
            const currentDistanceToMouse = Math.hypot(blobCenterX - this.mouse.x, blobCenterY - this.mouse.y);
            const projectedDistance = Number.isFinite(target.targetError)
                ? target.targetError
                : currentDistanceToMouse;
            const improvement = Number.isFinite(target.improvement)
                ? target.improvement
                : Math.max(0, currentDistanceToMouse - projectedDistance);

            if (improvement < 0.25) {
                return;
            }
            }
        }

        this.blob.isJumping = true;
        this.lastJumpTime = now;
        this.metrics.set('lastHopDistance', plannedDistance);

        const blob = this.blob;
        const baseSpeed = this.config.jumpSpeed;
        const size = this.config.blobSize;
        const flatMoveBias = this.clamp(this.config.flatMoveBias, 0.4, 3);
        const flatArcMax = this.clamp(this.config.flatArcMax, 4, 80);
        const startY = blob.y;
        const endY = target.y - size;
        const deltaX = Math.abs(target.x - blob.x);
        const deltaY = Math.abs(endY - startY);
        const travelDistance = Math.hypot(deltaX, deltaY);
        const isFlatHop = deltaY < 12;
        const speed = this.clamp(
            baseSpeed * (isFlatHop ? 0.95 : 1) + travelDistance * 0.18,
            360,
            760
        );
        const jumpDirection = target.x >= blob.x ? 1 : -1;
        const takeoffDuration = this.clamp(95 + travelDistance * 0.06, 95, 165);

        this.tweens.remove(blob, ['scaleX', 'scaleY', 'rotation']);

        this.tweens.add(blob, { scaleX: 1.42, scaleY: 0.58, rotation: jumpDirection * 0.1 }, takeoffDuration, 'easeOutQuad', () => {
            this.tweens.add(blob, { scaleX: 0.74, scaleY: 1.28, rotation: jumpDirection * 0.17 }, 120, 'easeOutCubic');
            this.tweens.add(blob, { x: target.x }, speed, isFlatHop ? 'easeInOutQuad' : 'linear');

            let arcHeight;
            if (isFlatHop) {
                const flattenFactor = 1 + (flatMoveBias - 1) * 0.55;
                const inspiredFlatArc = this.clamp((42 + deltaX * 0.12) / flattenFactor, 20, 140);
                arcHeight = Math.min(inspiredFlatArc, flatArcMax);
            } else {
                const verticalLift = Math.min(70, deltaY * 0.2);
                arcHeight = this.clamp(150 + verticalLift, 120, 220);
            }
            const peakY = Math.min(startY, endY) - arcHeight;

            const upDuration = speed * 0.5;
            const downDuration = speed * 0.5;

            this.tweens.add(blob, { y: peakY }, upDuration, 'easeOutCubic', () => {
                this.tweens.add(blob, { scaleX: 0.92, scaleY: 1.08 }, Math.min(180, downDuration * 0.48), 'easeInOutQuad');
                this.tweens.add(blob, { rotation: jumpDirection * 0.06 }, Math.min(170, downDuration * 0.42), 'easeInQuad');
                this.tweens.add(blob, { y: endY }, downDuration, 'easeInCubic', () => {
                    blob.y = endY;
                    this.tweens.add(blob, { scaleX: 1.52, scaleY: 0.5, rotation: 0 }, 90, 'easeOutQuad', () => {
                        this.tweens.add(blob, { scaleX: 1, scaleY: 1, rotation: 0 }, 240, 'easeOutElastic', () => {
                            blob.isJumping = false;
                        });
                    });
                });
            });
        });
    }

    updateSecondaryAnimation(time) {
        const dt = this.clamp(time - this.animation.lastFrameTime, 0, 50);
        this.animation.lastFrameTime = time;

        this.animation.idleTime += this.blob.isJumping ? dt * 0.35 : dt;

        const centerX = this.blob.x + this.config.blobSize / 2;
        const desiredLook = this.clamp((this.mouse.x - centerX) / 110, -1, 1);
        this.animation.lookOffset += (desiredLook - this.animation.lookOffset) * 0.2;

        const movementDelta = Math.hypot(
            this.blob.x - this.animation.lastBlobX,
            this.blob.y - this.animation.lastBlobY
        );
        this.animation.lastBlobX = this.blob.x;
        this.animation.lastBlobY = this.blob.y;

        const stationaryNow = !this.blob.isJumping && movementDelta < 0.1;
        if (stationaryNow) {
            this.animation.stationaryTime = this.clamp(this.animation.stationaryTime + dt, 0, 5000);
        } else {
            this.animation.stationaryTime = this.clamp(this.animation.stationaryTime - dt * 2.1, 0, 5000);
        }
        this.animation.stationaryStrength = this.clamp((this.animation.stationaryTime - 260) / 960, 0, 1);

        if (time >= this.animation.nextBlinkAt && this.animation.blinkWindowStart < 0) {
            this.animation.blinkWindowStart = time;
            this.animation.nextBlinkAt = time + 1200 + Math.random() * 3200;
        }

        if (this.animation.blinkWindowStart > 0 && time - this.animation.blinkWindowStart > 140) {
            this.animation.blinkWindowStart = -1;
        }
    }

    getBlinkAmount(time) {
        if (this.animation.blinkWindowStart < 0) return 0;
        const blinkT = (time - this.animation.blinkWindowStart) / 140;
        if (blinkT <= 0 || blinkT >= 1) return 0;
        return blinkT < 0.5 ? blinkT * 2 : (1 - blinkT) * 2;
    }

    drawDebugPath() {
        if (!this.debug.enabled || this.debug.mode === 'off') return;

        const { ctx } = this;
        const mode = this.debug.mode;

        ctx.save();
        const drawEdgeList = (edges, color, alpha, width) => {
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = width;

            for (const edge of edges) {
                const from = edge.from === -1 ? this.blob : this.debug.nodes[edge.from];
                const to = edge.to === -1 ? this.blob : this.debug.nodes[edge.to];
                if (!from || !to) continue;
                ctx.beginPath();
                ctx.moveTo(from.x + this.config.blobSize / 2, from.y + this.config.blobSize / 2);
                ctx.lineTo(to.x + this.config.blobSize / 2, to.y + this.config.blobSize / 2);
                ctx.stroke();
            }
        };

        if (mode === 'all') {
            drawEdgeList(this.debug.edges, '#4fa9ff', 0.18, 1);
        }

        if (mode === 'calculated' || mode === 'all') {
            drawEdgeList(this.debug.calculatedEdges, '#ffb300', 0.62, 2);
        }

        if (mode === 'all') {
            ctx.globalAlpha = 0.88;
            ctx.fillStyle = '#1565c0';
            for (const node of this.debug.nodes) {
                ctx.beginPath();
                ctx.arc(node.x + this.config.blobSize / 2, node.y + this.config.blobSize / 2, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (this.debug.activePath.length > 1) {
            ctx.globalAlpha = 0.98;
            ctx.strokeStyle = '#00ff84';
            ctx.lineWidth = 3;
            ctx.beginPath();
            const first = this.debug.activePath[0];
            ctx.moveTo(first.x + this.config.blobSize / 2, first.y + this.config.blobSize / 2);
            for (let index = 1; index < this.debug.activePath.length; index++) {
                const node = this.debug.activePath[index];
                ctx.lineTo(node.x + this.config.blobSize / 2, node.y + this.config.blobSize / 2);
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    draw() {
        const { ctx, config, blob } = this;
        const size = config.blobSize;

        ctx.clearRect(0, 0, this.width, this.height);

        this.drawDebugPath();

        const cx = blob.x + size / 2;
        const cy = blob.y + size;
        const idleBreath = this.blob.isJumping ? 0 : Math.sin(this.animation.idleTime * 0.0052) * 0.04;
        const idleSway = this.blob.isJumping ? 0 : Math.sin(this.animation.idleTime * 0.003) * 0.02;
        const bobY = this.blob.isJumping ? 0 : Math.sin(this.animation.idleTime * 0.0044) * 1.8;
        const stationaryStrength = this.animation.stationaryStrength;
        const renderScaleX = blob.scaleX * (1 - idleBreath * 0.62 + idleSway);
        const renderScaleY = blob.scaleY * (1 + idleBreath);
        const renderRotation = blob.rotation + (this.blob.isJumping ? 0 : Math.sin(this.animation.idleTime * 0.0022) * 0.03);

        const shadowScale = this.blob.isJumping ? 0.8 : 1;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(
            cx,
            blob.y + size + 7,
            size * 0.37 * shadowScale,
            size * 0.13 * shadowScale,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        if (stationaryStrength > 0) {
            const auraPulse = (Math.sin(this.animation.idleTime * 0.0064) + 1) * 0.5;
            const auraScale = 1 + auraPulse * (0.18 + stationaryStrength * 0.2);
            const auraW = size * auraScale;
            const auraH = size * (0.7 + auraPulse * 0.12);
            const auraX = cx - auraW / 2;
            const auraY = blob.y + size / 2 - auraH / 2 + bobY * 0.25;

            ctx.save();
            ctx.globalAlpha = 0.12 + stationaryStrength * 0.22;
            ctx.strokeStyle = config.colors.blob;
            ctx.lineWidth = 2;
            ctx.strokeRect(auraX, auraY, auraW, auraH);
            ctx.restore();
        }

        ctx.save();
        ctx.translate(cx, cy + bobY);
        ctx.rotate(renderRotation);
        ctx.scale(renderScaleX, renderScaleY);
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

        const lookDir = Math.round(this.animation.lookOffset * 3);
        const blinkAmount = this.getBlinkAmount(performance.now());
        const eyeHeight = Math.max(1, Math.round(8 * (1 - blinkAmount)));
        const eyeY = blob.y + 10;

        ctx.fillStyle = config.colors.eye;
        ctx.fillRect(blob.x + 6 + lookDir, eyeY, 6, eyeHeight);
        ctx.fillRect(blob.x + 18 + lookDir, eyeY, 6, eyeHeight);

        if (eyeHeight > 2) {
            ctx.fillStyle = 'white';
            ctx.fillRect(blob.x + 6 + lookDir, eyeY, 2, 2);
            ctx.fillRect(blob.x + 18 + lookDir, eyeY, 2, 2);
        }

        ctx.restore();
    }

    loop(time) {
        if (!this.rafId) return;

        this.updateMouseCoordinates();
        this.updateSecondaryAnimation(time);
        this.tweens.update(time);

        if (!this.blob.isJumping) {
            const blobCenterX = this.blob.x + this.config.blobSize / 2;
            const blobCenterY = this.blob.y + this.config.blobSize / 2;
            const distToMouse = Math.hypot(blobCenterX - this.mouse.x, blobCenterY - this.mouse.y);

            const followThreshold = Math.max(2, this.config.minMoveDistance * 0.75);
            if (distToMouse > followThreshold) {
                const forceFollow = distToMouse > this.config.minMoveDistance * 2.2;
                this.triggerJump(forceFollow);
            } else if (Math.random() > 0.996) {
                this.triggerJump(false);
            }
        }

        this.draw();
        this.rafId = requestAnimationFrame((nextTime) => this.loop(nextTime));
    }

    start() {
        if (!this.rafId) {
            this.rafId = requestAnimationFrame((time) => this.loop(time));
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

window.SmartBlob = SmartBlob;
