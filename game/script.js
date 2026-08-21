// ============================================
// ECLIPSE - Juego de Estrellas
// Versión 1.0 - Optimizado para rendimiento
// ============================================

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        
        // Dimensiones
        this.width = 0;
        this.height = 0;
        this.scale = 1;
        
        // Estado del juego
        this.state = 'menu'; // menu, playing, gameover
        this.score = 0;
        this.lives = 3;
        this.maxLives = 3;
        this.level = 1;
        this.combo = 0;
        this.maxCombo = 0;
        
        // Jugador (nave)
        this.player = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            radius: 20,
            angle: 0,
            speed: 0.12,
            trail: []
        };
        
        // Elementos del juego
        this.stars = [];
        this.asteroids = [];
        this.particles = [];
        this.collectEffects = [];
        
        // Configuración de dificultad
        this.difficulty = {
            starSpawnRate: 60,
            asteroidSpawnRate: 90,
            maxStars: 12,
            maxAsteroids: 8,
            baseSpeed: 2,
            speedMultiplier: 1
        };
        
        // Temporizadores
        this.frameCount = 0;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.animationId = null;
        
        // Input
        this.mouse = { x: 0, y: 0, active: false };
        this.touch = { x: 0, y: 0, active: false };
        
        // Optimización para móviles
        this.isMobile = false;
        this.particleLimit = 50;
        
        // Inicializar
        this.init();
        this.setupEventListeners();
        this.setupUI();
        this.startLoop();
    }
    
    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resize(), 300);
        });
    }
    
    resize() {
        const container = document.getElementById('gameContainer');
        const rect = container.getBoundingClientRect();
        
        this.width = rect.width;
        this.height = rect.height;
        
        // Detectar si es móvil
        this.isMobile = this.width < 768 || ('ontouchstart' in window);
        
        // Ajustar límite de partículas
        this.particleLimit = this.isMobile ? 30 : 50;
        
        // Escalar canvas
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Posicionar jugador en el centro
        this.player.x = this.width / 2;
        this.player.y = this.height / 2;
        this.player.targetX = this.width / 2;
        this.player.targetY = this.height / 2;
    }
    
    setupEventListeners() {
        // Mouse
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            this.mouse.active = true;
            this.player.targetX = this.mouse.x;
            this.player.targetY = this.mouse.y;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.active = false;
        });
        
        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) {
                const rect = this.canvas.getBoundingClientRect();
                this.touch.x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
                this.touch.y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
                this.touch.active = true;
                this.player.targetX = this.touch.x;
                this.player.targetY = this.touch.y;
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) {
                const rect = this.canvas.getBoundingClientRect();
                this.touch.x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
                this.touch.y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
                this.touch.active = true;
                this.player.targetX = this.touch.x;
                this.player.targetY = this.touch.y;
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touch.active = false;
            // Mantener la última posición
        }, { passive: false });
    }
    
    setupUI() {
        // Botones
        document.getElementById('startButton').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('restartButton').addEventListener('click', () => {
            this.startGame();
        });
        
        // Touch para botones
        document.querySelectorAll('.menu-button').forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.click();
            }, { passive: false });
        });
    }
    
    startGame() {
        // Reiniciar estado
        this.score = 0;
        this.lives = this.maxLives;
        this.level = 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.stars = [];
        this.asteroids = [];
        this.particles = [];
        this.collectEffects = [];
        this.frameCount = 0;
        this.difficulty.speedMultiplier = 1;
        
        // Posicionar jugador
        this.player.x = this.width / 2;
        this.player.y = this.height / 2;
        this.player.targetX = this.width / 2;
        this.player.targetY = this.height / 2;
        this.player.trail = [];
        
        // Ocultar menús
        document.getElementById('startMenu').classList.add('hidden');
        document.getElementById('gameOverMenu').style.display = 'none';
        
        // Actualizar UI
        this.updateUI();
        
        // Cambiar estado
        this.state = 'playing';
    }
    
    gameOver() {
        this.state = 'gameover';
        
        // Mostrar menú game over
        const menu = document.getElementById('gameOverMenu');
        menu.style.display = 'flex';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLevel').textContent = this.level;
        
        // Efecto de entrada
        menu.style.opacity = '0';
        setTimeout(() => {
            menu.style.opacity = '1';
        }, 50);
    }
    
    updateUI() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('levelValue').textContent = this.level;
        
        // Actualizar corazones
        const hearts = document.querySelectorAll('.heart');
        hearts.forEach((heart, index) => {
            if (index < this.lives) {
                heart.classList.remove('lost');
            } else {
                heart.classList.add('lost');
            }
        });
    }
    
    // ============================================
    // MÉTODOS DEL JUEGO
    // ============================================
    
    spawnStar() {
        const margin = 40;
        const x = margin + Math.random() * (this.width - margin * 2);
        const y = margin + Math.random() * (this.height - margin * 2);
        
        // No spawn cerca del jugador
        const dx = x - this.player.x;
        const dy = y - this.player.y;
        if (dx * dx + dy * dy < 10000) return;
        
        const size = 8 + Math.random() * 12;
        const speed = 0.5 + Math.random() * 1.5;
        const angle = Math.random() * Math.PI * 2;
        
        this.stars.push({
            x: x,
            y: y,
            radius: size,
            speed: speed,
            angle: angle,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: 0.02 + Math.random() * 0.03,
            value: 10 + Math.floor(Math.random() * 20),
            glow: 0.5 + Math.random() * 0.5
        });
        
        // Mantener límite
        if (this.stars.length > this.difficulty.maxStars + this.level * 2) {
            this.stars.shift();
        }
    }
    
    spawnAsteroid() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch(side) {
            case 0: x = -30; y = Math.random() * this.height; break;
            case 1: x = this.width + 30; y = Math.random() * this.height; break;
            case 2: x = Math.random() * this.width; y = -30; break;
            case 3: x = Math.random() * this.width; y = this.height + 30; break;
        }
        
        const speed = 1 + Math.random() * 2;
        const angle = Math.atan2(this.player.y - y, this.player.x - x) + (Math.random() - 0.5) * 0.5;
        const size = 15 + Math.random() * 25;
        
        this.asteroids.push({
            x: x,
            y: y,
            radius: size,
            speed: speed * this.difficulty.speedMultiplier,
            angle: angle,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.02,
            vertices: this.generateAsteroidVertices(size)
        });
        
        // Mantener límite
        if (this.asteroids.length > this.difficulty.maxAsteroids + this.level) {
            this.asteroids.shift();
        }
    }
    
    generateAsteroidVertices(radius) {
        const vertices = [];
        const count = 8 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const r = radius * (0.7 + Math.random() * 0.3);
            vertices.push({ angle: angle, radius: r });
        }
        return vertices;
    }
    
    createParticles(x, y, count, color, speed, life) {
        const limit = Math.min(count, this.particleLimit);
        for (let i = 0; i < limit; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 0.5 + Math.random() * speed;
            const size = 2 + Math.random() * 4;
            
            this.particles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                radius: size,
                life: life * (0.5 + Math.random() * 0.5),
                maxLife: life,
                color: color,
                decay: 0.005 + Math.random() * 0.01
            });
        }
        
        // Limitar partículas totales
        while (this.particles.length > this.particleLimit * 3) {
            this.particles.shift();
        }
    }
    
    createCollectEffect(x, y, value) {
        this.collectEffects.push({
            x: x,
            y: y,
            text: `+${value}`,
            life: 60,
            maxLife: 60,
            velocity: -2
        });
    }
    
    // ============================================
    // ACTUALIZACIÓN DEL JUEGO
    // ============================================
    
    update() {
        this.frameCount++;
        
        // Actualizar dificultad
        this.difficulty.speedMultiplier = 1 + (this.level - 1) * 0.15;
        const spawnRate = Math.max(20, 60 - this.level * 2);
        
        // Spawn de estrellas
        if (this.frameCount % Math.floor(spawnRate) === 0) {
            this.spawnStar();
        }
        
        // Spawn de asteroides
        const asteroidRate = Math.max(40, 90 - this.level * 3);
        if (this.frameCount % Math.floor(asteroidRate) === 0 && this.asteroids.length < this.difficulty.maxAsteroids + this.level) {
            this.spawnAsteroid();
        }
        
        // Actualizar jugador (movimiento suave)
        const dx = this.player.targetX - this.player.x;
        const dy = this.player.targetY - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 1) {
            const speed = Math.min(this.player.speed * dist * 0.1, 15);
            this.player.x += (dx / dist) * speed;
            this.player.y += (dy / dist) * speed;
            this.player.angle = Math.atan2(dy, dx);
        }
        
        // Actualizar estela
        this.player.trail.push({ x: this.player.x, y: this.player.y, life: 20 });
        if (this.player.trail.length > 15) this.player.trail.shift();
        
        // Actualizar estela
        this.player.trail = this.player.trail.filter(t => {
            t.life--;
            return t.life > 0;
        });
        
        // Actualizar estrellas
        for (let i = this.stars.length - 1; i >= 0; i--) {
            const star = this.stars[i];
            star.x += Math.cos(star.angle) * star.speed * 0.2;
            star.y += Math.sin(star.angle) * star.speed * 0.2;
            star.pulse += star.pulseSpeed;
            
            // Mantener en pantalla
            if (star.x < -20 || star.x > this.width + 20 || 
                star.y < -20 || star.y > this.height + 20) {
                this.stars.splice(i, 1);
                continue;
            }
            
            // Colisión con jugador
            const dx2 = star.x - this.player.x;
            const dy2 = star.y - this.player.y;
            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            
            if (dist2 < this.player.radius + star.radius) {
                // Recolectar estrella
                this.score += star.value;
                this.combo++;
                if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                
                // Bonus por combo
                let bonus = 0;
                if (this.combo > 5) bonus = Math.floor(this.combo * 0.5);
                this.score += bonus;
                
                this.createCollectEffect(star.x, star.y, star.value + (bonus > 0 ? ` +${bonus}` : ''));
                this.createParticles(star.x, star.y, 15, '#FFD700', 4, 40);
                
                // Subir nivel
                const newLevel = Math.floor(this.score / 100) + 1;
                if (newLevel > this.level) {
                    this.level = newLevel;
                    // Efecto de nivel
                    this.createParticles(this.width / 2, this.height / 2, 30, '#00D4FF', 6, 60);
                }
                
                this.stars.splice(i, 1);
                this.updateUI();
                continue;
            }
        }
        
        // Actualizar asteroides
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const asteroid = this.asteroids[i];
            asteroid.x += Math.cos(asteroid.angle) * asteroid.speed;
            asteroid.y += Math.sin(asteroid.angle) * asteroid.speed;
            asteroid.rotation += asteroid.rotationSpeed;
            
            // Eliminar si sale de pantalla
            if (asteroid.x < -100 || asteroid.x > this.width + 100 || 
                asteroid.y < -100 || asteroid.y > this.height + 100) {
                this.asteroids.splice(i, 1);
                continue;
            }
            
            // Colisión con jugador
            const dx2 = asteroid.x - this.player.x;
            const dy2 = asteroid.y - this.player.y;
            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            
            if (dist2 < this.player.radius + asteroid.radius) {
                // Impacto
                this.lives--;
                this.combo = 0;
                this.createParticles(asteroid.x, asteroid.y, 25, '#FF4444', 6, 50);
                this.updateUI();
                this.asteroids.splice(i, 1);
                
                if (this.lives <= 0) {
                    this.gameOver();
                    return;
                }
                continue;
            }
        }
        
        // Actualizar partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.life -= p.decay;
            p.radius *= 0.995;
            
            if (p.life <= 0 || p.radius < 0.1) {
                this.particles.splice(i, 1);
            }
        }
        
        // Actualizar efectos de colección
        for (let i = this.collectEffects.length - 1; i >= 0; i--) {
            const effect = this.collectEffects[i];
            effect.y += effect.velocity;
            effect.life--;
            if (effect.life <= 0) {
                this.collectEffects.splice(i, 1);
            }
        }
    }
    
    // ============================================
    // DIBUJADO
    // ============================================
    
    draw() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        
        // Limpiar canvas con fondo degradado
        const gradient = ctx.createRadialGradient(
            w * 0.5, h * 0.5, 0,
            w * 0.5, h * 0.5, Math.max(w, h) * 0.8
        );
        gradient.addColorStop(0, '#2a2a2a');
        gradient.addColorStop(0.3, '#1a1a1a');
        gradient.addColorStop(0.7, '#0a0a0a');
        gradient.addColorStop(1, '#000000');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        
        // === DIBUJAR ESTRELLAS DE FONDO (estáticas) ===
        // Ya están en el fondo del canvas
        
        // === DIBUJAR ASTERIODES ===
        for (const asteroid of this.asteroids) {
            ctx.save();
            ctx.translate(asteroid.x, asteroid.y);
            ctx.rotate(asteroid.rotation);
            
            // Sombra
            ctx.shadowColor = 'rgba(255, 50, 50, 0.2)';
            ctx.shadowBlur = 20;
            
            ctx.beginPath();
            const verts = asteroid.vertices;
            for (let i = 0; i < verts.length; i++) {
                const v = verts[i];
                const x = Math.cos(v.angle) * v.radius;
                const y = Math.sin(v.angle) * v.radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            
            // Gradiente del asteroide
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, asteroid.radius);
            grad.addColorStop(0, 'rgba(120, 120, 140, 0.8)');
            grad.addColorStop(0.5, 'rgba(60, 60, 80, 0.9)');
            grad.addColorStop(1, 'rgba(30, 30, 40, 0.95)');
            
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = 'rgba(200, 200, 220, 0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.restore();
        }
        
        // === DIBUJAR ESTRELLAS (coleccionables) ===
        for (const star of this.stars) {
            const pulse = Math.sin(star.pulse) * 0.2 + 0.8;
            const radius = star.radius * pulse;
            
            ctx.save();
            
            // Brillo exterior
            const glow = ctx.createRadialGradient(
                star.x, star.y, 0,
                star.x, star.y, radius * 3
            );
            glow.addColorStop(0, `rgba(255, 215, 0, ${0.3 * star.glow * pulse})`);
            glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(star.x - radius * 3, star.y - radius * 3, radius * 6, radius * 6);
            
            // Cuerpo de la estrella
            const starGrad = ctx.createRadialGradient(
                star.x - radius * 0.3, star.y - radius * 0.3, 0,
                star.x, star.y, radius
            );
            starGrad.addColorStop(0, '#FFEAA7');
            starGrad.addColorStop(0.4, '#FFD700');
            starGrad.addColorStop(0.8, '#FFA500');
            starGrad.addColorStop(1, '#FF8C00');
            
            ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
            ctx.shadowBlur = 30;
            
            ctx.beginPath();
            // Dibujar estrella de 4 puntas
            const points = 8;
            for (let i = 0; i < points * 2; i++) {
                const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? radius : radius * 0.4;
                const x = star.x + Math.cos(angle) * r;
                const y = star.y + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = starGrad;
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.restore();
        }
        
        // === DIBUJAR ESTELA ===
        for (let i = 0; i < this.player.trail.length; i++) {
            const t = this.player.trail[i];
            const alpha = t.life / 20 * 0.3;
            const radius = (t.life / 20) * 8;
            
            const grad = ctx.createRadialGradient(
                t.x, t.y, 0,
                t.x, t.y, radius
            );
            grad.addColorStop(0, `rgba(150, 200, 255, ${alpha * 0.5})`);
            grad.addColorStop(1, `rgba(150, 200, 255, 0)`);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // === DIBUJAR JUGADOR (Nave Ave) ===
        if (this.state === 'playing') {
            this.drawPlayer(ctx);
        }
        
        // === DIBUJAR PARTÍCULAS ===
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            
            const grad = ctx.createRadialGradient(
                p.x, p.y, 0,
                p.x, p.y, p.radius
            );
            grad.addColorStop(0, p.color);
            grad.addColorStop(1, p.color + '00');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1;
        }
        
        // === DIBUJAR EFECTOS DE COLECCIÓN ===
        for (const effect of this.collectEffects) {
            const alpha = effect.life / effect.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#FFD700';
            ctx.font = this.isMobile ? '20px sans-serif' : '28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
            ctx.shadowBlur = 20;
            ctx.fillText(effect.text, effect.x, effect.y);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }
    
    drawPlayer(ctx) {
        const x = this.player.x;
        const y = this.player.y;
        const size = this.player.radius;
        const angle = this.player.angle;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        // Sombra de la nave
        ctx.shadowColor = 'rgba(100, 180, 255, 0.3)';
        ctx.shadowBlur = 40;
        
        // Cuerpo principal (forma de ave estilizada)
        const grad = ctx.createLinearGradient(-size, 0, size, 0);
        grad.addColorStop(0, '#4A9EFF');
        grad.addColorStop(0.3, '#7BC0FF');
        grad.addColorStop(0.7, '#A8D8FF');
        grad.addColorStop(1, '#4A9EFF');
        
        // Ala izquierda
        ctx.beginPath();
        ctx.moveTo(-size * 1.4, 0);
        ctx.quadraticCurveTo(-size * 0.8, -size * 0.7, -size * 0.2, -size * 0.5);
        ctx.quadraticCurveTo(-size * 0.1, -size * 0.3, 0, 0);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Ala derecha
        ctx.beginPath();
        ctx.moveTo(-size * 1.4, 0);
        ctx.quadraticCurveTo(-size * 0.8, size * 0.7, -size * 0.2, size * 0.5);
        ctx.quadraticCurveTo(-size * 0.1, size * 0.3, 0, 0);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.stroke();
        
        // Cuerpo central
        ctx.beginPath();
        ctx.moveTo(size * 0.8, 0);
        ctx.quadraticCurveTo(size * 0.2, -size * 0.6, -size * 0.4, -size * 0.3);
        ctx.quadraticCurveTo(-size * 0.5, 0, -size * 0.4, size * 0.3);
        ctx.quadraticCurveTo(size * 0.2, size * 0.6, size * 0.8, 0);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Cola (detrás)
        ctx.beginPath();
        ctx.moveTo(-size * 1.2, -size * 0.2);
        ctx.quadraticCurveTo(-size * 1.6, 0, -size * 1.2, size * 0.2);
        ctx.quadraticCurveTo(-size * 1.0, 0, -size * 1.2, -size * 0.2);
        ctx.fillStyle = 'rgba(74, 158, 255, 0.6)';
        ctx.fill();
        
        // Cabina (ojo brillante)
        const eyeGrad = ctx.createRadialGradient(
            size * 0.2, 0, 0,
            size * 0.2, 0, size * 0.4
        );
        eyeGrad.addColorStop(0, '#FFFFFF');
        eyeGrad.addColorStop(0.3, '#E8F4FF');
        eyeGrad.addColorStop(0.7, '#7BC0FF');
        eyeGrad.addColorStop(1, 'rgba(74, 158, 255, 0.2)');
        
        ctx.shadowBlur = 60;
        ctx.shadowColor = 'rgba(100, 180, 255, 0.5)';
        
        ctx.beginPath();
        ctx.arc(size * 0.2, 0, size * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = eyeGrad;
        ctx.fill();
        
        // Punto brillante en el ojo
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(size * 0.3, -size * 0.1, size * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
        
        // Detalles de alas (líneas decorativas)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < 3; i++) {
            const yOffset = (i - 1) * size * 0.25;
            ctx.beginPath();
            ctx.moveTo(-size * 0.4, yOffset);
            ctx.lineTo(-size * 0.1, yOffset);
            ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
        ctx.restore();
        
        // Efecto de pulso alrededor de la nave
        const pulse = Math.sin(this.frameCount * 0.05) * 0.1 + 0.9;
        const glowSize = size * 1.8 * pulse;
        
        const glow = ctx.createRadialGradient(
            x, y, size * 0.5,
            x, y, glowSize
        );
        glow.addColorStop(0, 'rgba(100, 180, 255, 0.05)');
        glow.addColorStop(0.5, 'rgba(100, 180, 255, 0.03)');
        glow.addColorStop(1, 'rgba(100, 180, 255, 0)');
        
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ============================================
    // BUCLE PRINCIPAL
    // ============================================
    
    startLoop() {
        const loop = (timestamp) => {
            if (this.state === 'playing') {
                this.update();
            }
            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        
        this.animationId = requestAnimationFrame(loop);
    }
    
    // ============================================
    // DIBUJAR ESTRELLAS DE FONDO (generadas una vez)
    // ============================================
    
    drawBackgroundStars() {
        // Ya se dibujan con el gradiente, no necesitamos estrellas fijas
        // para mantener el diseño limpio
    }
}

// ============================================
// INICIALIZAR JUEGO
// ============================================

// Esperar a que DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    
    // Exponer para debugging
    window.game = game;
});

// ============================================
// MANEJO DE ERRORES Y RENDIMIENTO
// ============================================

// Reducir uso de CPU cuando no está visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pausar si es necesario
    }
});