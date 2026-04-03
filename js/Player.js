import { Input } from './Input.js';
import { Assets } from './Assets.js';

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 60;
        this.speed = 0;
        this.maxSpeed = 8;
        this.acceleration = 0.2;
        this.friction = 0.05;
        this.brakeForce = 0.5;
        this.angle = 0; // for slight steering tilt visual
        
        this.color = '#00ffcc';
    }

    update(input, dt) {
        // Acceleration
        if (input.isAccelerating) {
            this.speed += this.acceleration;
        } else if (input.isBraking) {
            this.speed -= this.brakeForce;
        } else {
            // Friction
            if (this.speed > 0) this.speed -= this.friction;
            if (this.speed < 0) this.speed += this.friction;
        }

        // Clamp speed
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -2) this.speed = -2; // Reverse
        if (Math.abs(this.speed) < 0.1) this.speed = 0;

        // Steering
        if (this.speed !== 0) {
            const steer = input.steerDir;
            const turnSpeed = 3 * (this.speed / this.maxSpeed); // Turn sharper when moving
            this.x += steer * turnSpeed;
            this.angle = steer * 0.1; // Visual tilt
        } else {
            this.angle = 0;
        }

        // Boundaries simple clamp (temporary)
        if (this.x < 50) this.x = 50;
        if (this.x > 550 - this.width) this.x = 550 - this.width;
    }

    draw(ctx, input) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);

        // Body
        ctx.fillStyle = this.color;
        
        // Shadow/glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        
        if (Assets.car.complete && Assets.car.naturalWidth > 0) {
            ctx.drawImage(Assets.car, -this.width/2, -this.height/2, this.width, this.height);
        } else {
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
            
            // Windshield
            ctx.fillStyle = '#0b0f19';
            ctx.fillRect(-this.width/2 + 4, -this.height/2 + 10, this.width - 8, 15);
        }

        ctx.shadowBlur = 0; // reset

        // Indicators
        const time = Date.now();
        const blink = Math.floor(time / 250) % 2 === 0;

        if (blink) {
            ctx.fillStyle = '#ffaa00'; // Amber
            if (input.indicators.left) {
                ctx.fillRect(-this.width/2 - 2, -this.height/2 + 5, 4, 10);
                ctx.fillRect(-this.width/2 - 2, this.height/2 - 15, 4, 10);
            }
            if (input.indicators.right) {
                ctx.fillRect(this.width/2 - 2, -this.height/2 + 5, 4, 10);
                ctx.fillRect(this.width/2 - 2, this.height/2 - 15, 4, 10);
            }
        }
        
        // Brakelights
        if (input.isBraking) {
            ctx.fillStyle = '#ff0044';
            ctx.fillRect(-this.width/2 + 2, this.height/2 - 4, 8, 4);
            ctx.fillRect(this.width/2 - 10, this.height/2 - 4, 8, 4);
        }

        ctx.restore();
    }
}
