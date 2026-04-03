import { Assets } from './Assets.js';

export class World {
    constructor() {
        this.speed = 0; // Tied to player speed
        this.offsetY = 0;
        this.laneWidth = 100;
        this.numLanes = 4;
        this.roadWidth = this.laneWidth * this.numLanes;
        this.roadLeft = (600 - this.roadWidth) / 2; // Center road on 600px width
        this.roadRight = this.roadLeft + this.roadWidth;
        
        this.markingsLength = 40;
        this.markingsGap = 40;
    }

    update(playerSpeed, dt) {
        this.speed = playerSpeed;
        this.offsetY += this.speed;
        
        if (this.offsetY > this.markingsLength + this.markingsGap) {
            this.offsetY = 0;
        }
    }

    draw(ctx, canvas) {
        // Draw sidewalks / off-road
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render repeating environment pattern
        if (Assets.tiles.complete && Assets.tiles.naturalWidth > 0) {
            // Assuming tiles are ~32x32
            const tileSize = 32;
            const yStart = (this.offsetY % tileSize) - tileSize;
            for (let y = yStart; y < canvas.height; y += tileSize) {
                for (let x = 0; x < this.roadLeft; x += tileSize) {
                    ctx.drawImage(Assets.tiles, 0, 0, 32, 32, x, y, tileSize, tileSize);
                }
                for (let x = this.roadRight; x < canvas.width; x += tileSize) {
                    ctx.drawImage(Assets.tiles, 32, 0, 32, 32, x, y, tileSize, tileSize); // using another tile
                }
            }
        }

        // Draw main road
        ctx.fillStyle = '#111';
        ctx.fillRect(this.roadLeft, 0, this.roadWidth, canvas.height);

        // Draw lane markings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.setLineDash([this.markingsLength, this.markingsGap]);
        
        for (let i = 1; i < this.numLanes; i++) {
            let x = this.roadLeft + (i * this.laneWidth);
            ctx.beginPath();
            // Start bit higher to ensure smooth continuous scrolling
            ctx.moveTo(x, -this.markingsLength - this.markingsGap + this.offsetY);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        ctx.setLineDash([]); // Reset line dash for other drawings
        
        // Road borders
        ctx.strokeStyle = '#5500ff'; // Neon accent
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(this.roadLeft, 0);
        ctx.lineTo(this.roadLeft, canvas.height);
        ctx.moveTo(this.roadRight, 0);
        ctx.lineTo(this.roadRight, canvas.height);
        ctx.stroke();
    }
}
