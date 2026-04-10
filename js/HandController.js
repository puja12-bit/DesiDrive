export class HandController {
    constructor() {
        this.videoElement = document.getElementById('input-video');
        this.canvasElement = document.getElementById('output-canvas');
        this.canvasCtx = this.canvasElement.getContext('2d');
        this.statusElement = document.getElementById('hand-status');

        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => this.onResults(results));

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.hands.send({ image: this.videoElement });
            },
            width: 120,
            height: 90
        });

        // Control State
        this.state = {
            up: false,
            down: false,
            left: false,
            right: false,
            q: false,
            e: false,
            steerAngle: 0
        };

        // Smoothing buffer
        this.bufferSize = 5;
        this.history = [];

        this.lastGestureTime = { q: 0, e: 0 };
        this.debounceTime = 500; // ms for indicators
    }

    start() {
        this.camera.start();
        this.statusElement.innerText = "STARTING CAM...";
    }

    onResults(results) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

        let newState = {
            up: false,
            down: false,
            left: false,
            right: false,
            q: false,
            e: false,
            steerAngle: 0
        };

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const handCount = results.multiHandLandmarks.length;
            this.statusElement.innerText = `${handCount} HAND(S)`;
            this.statusElement.style.color = "#0f0";

            const handData = results.multiHandLandmarks.map((landmarks, index) => {
                const handedness = results.multiHandedness[index].label;
                
                // Draw landmarks
                drawConnectors(this.canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                drawLandmarks(this.canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });

                return {
                    isPalm: this.isOpenPalm(landmarks),
                    isFist: this.isFist(landmarks),
                    isPeace: this.isPeaceSign(landmarks),
                    angle: this.getHandAngle(landmarks),
                    handedness: handedness
                };
            });

            // STEERING: Average angle of all detected hands
            let aggregateSteer = handData.reduce((sum, h) => sum + h.angle, 0) / handCount;
            newState.steerAngle = aggregateSteer;

            // BRAKE: Either hand making a fist triggers the brake (Priority)
            const brakeActive = handData.some(h => h.isFist);

            // ACCELERATION: Requires BOTH hands to be open palms
            const accelActive = (handCount === 2) && handData.every(h => h.isPalm);

            // Apply prioritized control
            if (brakeActive) {
                newState.down = true;
                newState.up = false;
            } else if (accelActive) {
                newState.up = true;
            }

            // INDICATORS: Peace sign per hand (Debounced)
            const now = Date.now();
            handData.forEach(h => {
                if (h.isPeace) {
                    if (h.handedness === "Left" && now - this.lastGestureTime.q > this.debounceTime) {
                        newState.q = true;
                        this.lastGestureTime.q = now;
                    }
                    if (h.handedness === "Right" && now - this.lastGestureTime.e > this.debounceTime) {
                        newState.e = true;
                        this.lastGestureTime.e = now;
                    }
                }
            });

            if (newState.steerAngle < -20) newState.left = true;
            else if (newState.steerAngle > 20) newState.right = true;

        } else {
            this.statusElement.innerText = "NO HAND";
            this.statusElement.style.color = "#f00";
        }

        this.applySmoothing(newState);
        this.canvasCtx.restore();
    }

    isOpenPalm(l) {
        // Check 4 fingers (Index, Middle, Ring, Pinky) are up
        const fingersUp = (l[8].y < l[6].y && l[12].y < l[10].y && l[16].y < l[14].y && l[20].y < l[18].y);
        // Thumb check (Tip distance from wrist > IP joint distance from wrist)
        const thumbExtended = this.getDist(l[4], l[0]) > this.getDist(l[3], l[0]);
        return fingersUp && thumbExtended;
    }

    isFist(l) {
        // Check 4 fingers are closed
        const fingersDown = (l[8].y > l[6].y && l[12].y > l[10].y && l[16].y > l[14].y && l[20].y > l[18].y);
        // Thumb check (Tip closer to wrist than MCP)
        const thumbClosed = this.getDist(l[4], l[0]) < this.getDist(l[2], l[0]);
        return fingersDown && thumbClosed;
    }

    isPeaceSign(l) {
        // Index and Middle up, Ring and Pinky down
        const indexMiddleUp = (l[8].y < l[6].y && l[12].y < l[10].y);
        const ringPinkyDown = (l[16].y > l[14].y && l[20].y > l[18].y);
        // Thumb tucked
        const thumbTucked = this.getDist(l[4], l[0]) < this.getDist(l[2], l[0]);
        return indexMiddleUp && ringPinkyDown && thumbTucked;
    }

    getDist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    getHandAngle(l) {
        // Landmarks 0 (Wrist) and 5 (Index MCP)
        // Angle relative to vertical
        const dx = l[5].x - l[0].x;
        const dy = -(l[5].y - l[0].y); // flip y because y increases downwards
        const angle = Math.atan2(dx, dy) * (180 / Math.PI);
        return angle;
    }

    applySmoothing(newState) {
        this.history.push(newState);
        if (this.history.length > this.bufferSize) this.history.shift();

        // For discrete keys (up, down, left, right), we use majority vote or "any active"
        // User said: "Safety: Ensure all keys are released when no hand is detected"
        // So we strictly follow the latest state for safety, but can smooth the steering.

        // Average steering angle for stability
        const avgAngle = this.history.reduce((sum, s) => sum + s.steerAngle, 0) / this.history.length;
        
        this.state.up = newState.up;
        this.state.down = newState.down;
        this.state.q = newState.q;
        this.state.e = newState.e;
        this.state.steerAngle = avgAngle;

        // Re-calculate left/right based on smoothed angle
        this.state.left = avgAngle < -20;
        this.state.right = avgAngle > 20;
    }
}
