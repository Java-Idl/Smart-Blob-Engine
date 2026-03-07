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

    ease(t, type) {
        switch (type) {
            case 'easeOutQuad':
                return 1 - (1 - t) * (1 - t);
            case 'easeInQuad':
                return t * t;
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
            isJumping: false
        };

        this.defaultMetrics = {
            urgency: 0,
            maxJumpX: this.config.maxJumpX,
            selectedPathLength: 0,
            bestTargetDistance: 0,
            expandedNodes: 0,
            solveMs: 0,
            fallbackCount: 0,
            mode: 'idle'
        };

        this.metrics = new BlobEngineMetrics(this.defaultMetrics);

        this.debug = {
            enabled: Boolean(options.debugPath),
            nodes: [],
            edges: [],
            activePath: [],
            metrics: this.metrics
        };

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
            maxJumpX: this.config.maxJumpX,
            mode: 'idle'
        };

        this.metrics.reset(resetSnapshot);
        this.debug.activePath = [];
        this.lastJumpTime = performance.now();
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

        const { maxJumpX, maxJumpUp, maxDropDown } = this.config;
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
            if (Math.abs(dx) > maxJumpX) return;
            if (dy < -maxJumpUp) return;
            if (dy > maxDropDown) return;

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

                if (Math.abs(dx) > maxJumpX) continue;
                if (dy < -maxJumpUp || dy > maxDropDown) continue;

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
            this.debug.nodes = uniqueNodes;
            this.debug.edges = Array.from(edges.entries()).flatMap(([from, list]) => {
                return list.map((edge) => ({ from, to: edge.to }));
            });
        }

        return this.cachedGraph;
    }

    getGraph() {
        return this.cachedGraph || this.buildPathGraph();
    }

    createStartNode(graph, limits) {
        const startNode = {
            id: -1,
            platformIndex: -1,
            x: this.blob.x,
            y: this.blob.y
        };
        const candidateEdges = [];

        for (const node of graph.nodes) {
            if (!this.canTraverse(startNode, node, limits)) continue;

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
                if (!this.canTraverse(currentNode, nextNode, limits)) continue;

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
            expandedNodes
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

        const minImprovement = 0.05;
        if (best.targetDistance >= currentDistanceToTarget - minImprovement) {
            return null;
        }

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

        return best ? best.node : null;
    }

    calculateNextHop() {
        const solveStart = performance.now();
        const limits = this.getDynamicPathParams();
        const graph = this.getGraph();
        const { startNode, startEdges } = this.createStartNode(graph, limits);

        this.metrics.update({
            urgency: limits.urgency,
            maxJumpX: limits.maxJumpX,
            selectedPathLength: 0,
            bestTargetDistance: 0,
            expandedNodes: 0,
            solveMs: 0,
            mode: 'searching'
        });

        if (startEdges.length === 0) {
            if (this.debug.enabled) this.debug.activePath = [];
            this.metrics.update({
                mode: 'blocked',
                solveMs: performance.now() - solveStart
            });
            return null;
        }

        const shortestPaths = this.runShortestPaths(graph, startNode, startEdges, limits);
        this.metrics.set('expandedNodes', shortestPaths.expandedNodes);

        const bestReachable = this.pickBestReachableNode(graph, startNode, shortestPaths, limits);

        if (bestReachable) {
            const nextNode = graph.nodes[bestReachable.path[1]];
            if (nextNode) {
                if (this.debug.enabled) {
                    const pathNodes = bestReachable.path.map((id) => (id === -1 ? startNode : graph.nodes[id])).filter(Boolean);
                    if (bestReachable.isProjected) {
                        pathNodes.push({ x: bestReachable.landingX, y: bestReachable.landingY });
                    }
                    this.debug.activePath = pathNodes;
                }

                this.metrics.update({
                    selectedPathLength: bestReachable.path.length,
                    bestTargetDistance: bestReachable.targetDistance,
                    mode: 'astar',
                    solveMs: performance.now() - solveStart
                });

                const useProjectedLanding = bestReachable.path.length <= 2 && Number.isFinite(bestReachable.landingX) && Number.isFinite(bestReachable.landingY);
                const finalX = useProjectedLanding ? bestReachable.landingX : nextNode.x;
                const finalY = useProjectedLanding ? bestReachable.landingY + this.config.blobSize : nextNode.y + this.config.blobSize;

                return {
                    x: finalX,
                    y: finalY,
                    path: bestReachable.path,
                    bestTargetDistance: bestReachable.targetDistance,
                    improvement: bestReachable.improvement
                };
            }
        }

        const fallbackNode = this.findDirectFallback(graph, startNode, limits);
        if (fallbackNode) {
            if (this.debug.enabled) {
                this.debug.activePath = [startNode, fallbackNode];
            }

            this.metrics.update({
                selectedPathLength: 2,
                bestTargetDistance: best.score,
                mode: 'fallback',
                solveMs: performance.now() - solveStart
            });
            this.metrics.increment('fallbackCount', 1);

            return {
                x: fallbackNode.x,
                y: fallbackNode.y + this.config.blobSize,
                path: [startNode.id, fallbackNode.id],
                bestTargetDistance: best.score,
                improvement: 0
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
            const blobCenterX = this.blob.x + this.config.blobSize / 2;
            const blobCenterY = this.blob.y + this.config.blobSize / 2;
            const currentDistanceToMouse = Math.hypot(blobCenterX - this.mouse.x, blobCenterY - this.mouse.y);
            const projectedDistance = Number.isFinite(target.bestTargetDistance)
                ? target.bestTargetDistance
                : currentDistanceToMouse;
            const improvement = Number.isFinite(target.improvement)
                ? target.improvement
                : Math.max(0, currentDistanceToMouse - projectedDistance);

            if (improvement < 0.25) {
                return;
            }
        }

        this.blob.isJumping = true;
        this.lastJumpTime = now;

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

        this.tweens.add(blob, { scaleX: 1.4, scaleY: 0.6 }, 140, 'easeOutQuad', () => {
            this.tweens.add(blob, { scaleX: 0.7, scaleY: 1.3 }, 140, 'easeOutQuad');
            this.tweens.add(blob, { x: target.x }, speed, 'linear');

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
                this.tweens.add(blob, { y: endY }, downDuration, 'easeInCubic', () => {
                    blob.y = endY;
                    this.tweens.add(blob, { scaleX: 1.5, scaleY: 0.5 }, 90, 'easeOutQuad', () => {
                        this.tweens.add(blob, { scaleX: 1, scaleY: 1 }, 220, 'easeOutElastic', () => {
                            blob.isJumping = false;
                        });
                    });
                });
            });
        });
    }

    drawDebugPath() {
        if (!this.debug.enabled) return;

        const { ctx } = this;

        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 1;

        for (const edge of this.debug.edges) {
            const from = this.debug.nodes[edge.from];
            const to = this.debug.nodes[edge.to];
            if (!from || !to) continue;
            ctx.beginPath();
            ctx.moveTo(from.x + this.config.blobSize / 2, from.y + this.config.blobSize / 2);
            ctx.lineTo(to.x + this.config.blobSize / 2, to.y + this.config.blobSize / 2);
            ctx.stroke();
        }

        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#1565c0';
        for (const node of this.debug.nodes) {
            ctx.beginPath();
            ctx.arc(node.x + this.config.blobSize / 2, node.y + this.config.blobSize / 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.debug.activePath.length > 1) {
            ctx.strokeStyle = '#00c853';
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
