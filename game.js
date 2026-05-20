const canvas = document.getElementById('bwCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Estado e Inventário
let inventory = { iron: 0, gold: 0, blocks: 0 };
let activeSlot = 0; 
let currentTab = 'blocks';

const shopData = {
    blocks: [
        { id: 'wool', name: 'Lã x16', costType: 'iron', cost: 8, amount: 16 },
        { id: 'wood', name: 'Madeira x16', costType: 'iron', cost: 16, amount: 16 }
    ],
    combat: [
        { id: 'stone_sword', name: 'Espada Pedra', costType: 'iron', cost: 24, dmg: 25 },
        { id: 'iron_armor', name: 'Armadura Ferro', costType: 'gold', cost: 12 }
    ],
    utility: [
        { id: 'stone_pick', name: 'Picareta Pedra', costType: 'iron', cost: 24 },
        { id: 'apple', name: 'Maçã (Cura)', costType: 'iron', cost: 6 }
    ]
};

let blueBedAlive = true;
let redBedAlive = true;

// Entidades com Parâmetros de Física Física
const player = {
    x: 100, y: 150, radius: 12, speed: 3.2, angle: 0,
    hp: 100, maxHp: 100, dmg: 15
};

const bot = {
    x: 520, y: 150, radius: 12, speed: 2.0, angle: 0,
    hp: 100, lastAttack: 0
};

// Configuração de Blocos do Mundo (Grid de Construção)
const blockSize = 32;
let mapBlocks = [];

function initMap() {
    // Geração da Ilha do Jogador (Azul - Esquerda)
    for(let i=1; i<6; i++) {
        for(let j=3; j<8; j++) {
            mapBlocks.push({x: i*blockSize, y: j*blockSize, type: 'island'});
        }
    }
    // Geração da Ilha do Bot (Vermelha - Direita)
    for(let i=15; i<20; i++) {
        for(let j=3; j<8; j++) {
            mapBlocks.push({x: i*blockSize, y: j*blockSize, type: 'island'});
        }
    }
}
initMap();

const blueBed = { x: 48, y: 160, w: 40, h: 25 };
const redBed = { x: 590, y: 160, w: 40, h: 25 };
const ironGenerator = { x: 96, y: 220, lastSpawn: 0 };

// Analógico Embutido no Canvas para prevenir interceptações do Android
const joyMove = { x: 80, y: 0, rOut: 45, rIn: 18, tId: null, cx: 80, cy: 0, active: false, dx: 0, dy: 0 };
function initJoystick() {
    joyMove.y = canvas.height - 85;
    joyMove.cx = joyMove.x; joyMove.cy = joyMove.y;
}
initJoystick();
window.addEventListener('resize', initJoystick);

// Captura Multi-Touch Independente
window.addEventListener('touchstart', (e) => {
    for(let t of e.changedTouches) {
        if(t.clientX < canvas.width / 2 && joyMove.tId === null) {
            joyMove.tId = t.identifier;
            joyMove.active = true;
            updateJoy(t.clientX, t.clientY);
        } else if(t.clientX >= canvas.width / 2) {
            handleBuildBlock(t.clientX, t.clientY);
        }
    }
});

window.addEventListener('touchmove', (e) => {
    for(let t of e.touches) {
        if(t.identifier === joyMove.tId) updateJoy(t.clientX, t.clientY);
    }
});

const endTouch = (e) => {
    for(let t of e.changedTouches) {
        if(t.identifier === joyMove.tId) {
            joyMove.tId = null; joyMove.active = false;
            joyMove.cx = joyMove.x; joyMove.cy = joyMove.y;
            joyMove.dx = 0; joyMove.dy = 0;
        }
    }
};
window.addEventListener('touchend', endTouch);
window.addEventListener('touchcancel', endTouch);

function updateJoy(tx, ty) {
    let dx = tx - joyMove.x;
    let dy = ty - joyMove.y;
    let dist = Math.hypot(dx, dy);
    if(dist > joyMove.rOut) {
        dx = (dx / dist) * joyMove.rOut;
        dy = (dy / dist) * joyMove.rOut;
    }
    joyMove.cx = joyMove.x + dx;
    joyMove.cy = joyMove.y + dy;
    joyMove.dx = dx / joyMove.rOut;
    joyMove.dy = dy / joyMove.rOut;
}

// Mecânica de Posicionamento de Bloco pelo Toque
function handleBuildBlock(screenX, screenY) {
    if(activeSlot === 2 && inventory.blocks > 0) {
        let gridX = Math.floor(screenX / blockSize) * blockSize;
        let gridY = Math.floor(screenY / blockSize) * blockSize;

        let alreadyExists = mapBlocks.some(b => b.x === gridX && b.y === gridY);
        if(!alreadyExists) {
            mapBlocks.push({ x: gridX, y: gridY, type: 'bridge' });
            inventory.blocks--;
            updateHUD();
        }
    }
}

function checkPlatform(px, py) {
    return mapBlocks.some(b => 
        px >= b.x && px <= b.x + blockSize &&
        py >= b.y && py <= b.y + blockSize
    );
}

function triggerAttack() {
    let distToBot = Math.hypot(player.x - bot.x, player.y - bot.y);
    if(distToBot < 45) {
        bot.hp -= player.dmg;
        if(bot.hp <= 0) {
            if(redBedAlive) {
                bot.x = 520; bot.y = 150; bot.hp = 100;
                showAlert("INIMIGO ABATIDO! ELE RESPAWNOU NA CAMA.");
            } else {
                bot.x = -9999;
                showAlert("TIME VERMELHO ELIMINADO DEFINITIVAMENTE!");
            }
        }
    }

    if(redBedAlive) {
        let distToBed = Math.hypot(player.x - (redBed.x + 20), player.y - (redBed.y + 12));
        if(distToBed < 50) {
            redBedAlive = false;
            showAlert("SENSACIONAL! VOCÊ DESTRUIU A CAMA VERMELHA!");
        }
    }
}

function showAlert(msg) {
    const el = document.getElementById('alert-box');
    el.innerText = msg;
    setTimeout(() => el.innerText = "", 3500);
}

// Mecânica de Loop (Update Engine)
function update() {
    let now = Date.now();

    if(joyMove.active) {
        player.x += joyMove.dx * player.speed;
        player.y += joyMove.dy * player.speed;
        player.angle = Math.atan2(joyMove.dy, joyMove.dx);
    }

    // Queda no Void (Espaço)
    if(!checkPlatform(player.x, player.y)) {
        player.hp -= 2.5;
        if(player.hp <= 0) {
            if(blueBedAlive) {
                player.x = 100; player.y = 150; player.hp = 100;
                showAlert("VOCÊ CAIU NO VAZIO!");
            } else {
                showAlert("FIM DE JOGO! SUA CAMA JÁ TINHA SIDO DESTRUÍDA.");
                player.x = -2000;
            }
        }
    }

    // Coleta Automática do Gerador de Ferro
    if(now - ironGenerator.lastSpawn > 1000) {
        if(Math.hypot(player.x - ironGenerator.x, player.y - ironGenerator.y) < 35) {
            inventory.iron += 4;
            updateHUD();
        }
        ironGenerator.lastSpawn = now;
    }

    // Inteligência Artificial Avançada do Bot (Caçador)
    if(bot.x > 0) {
        let distToPlayer = Math.hypot(player.x - bot.x, player.y - bot.y);
        if(distToPlayer < 200) {
            bot.angle = Math.atan2(player.y - bot.y, player.x - bot.x);
            bot.x += Math.cos(bot.angle) * bot.speed;
            bot.y += Math.sin(bot.angle) * bot.speed;

            if(distToPlayer < 28 && now - bot.lastAttack > 1200) {
                player.hp -= 18;
                showAlert("ALERTA! VOCÊ FOI ATACADO PELO BOT!");
                bot.lastAttack = now;
            }
        }
    }
}

// Pintura dos Elementos Visuais (Render Engine)
function draw() {
    ctx.fillStyle = "#4a83ec"; // Cor do fundo (Céu do Bloxd)
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenhar Blocos Construídos / Plataformas
    for(let b of mapBlocks) {
        ctx.fillStyle = b.type === 'island' ? '#8bc34a' : '#d1d8e0';
        ctx.fillRect(b.x, b.y, blockSize, blockSize);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.strokeRect(b.x, b.y, blockSize, blockSize);
    }

    // Gerador de Recursos
    ctx.fillStyle = "#57606f";
    ctx.beginPath(); ctx.arc(ironGenerator.x, ironGenerator.y, 10, 0, Math.PI*2); ctx.fill();

    // Camas Táticas
    if(blueBedAlive) {
        ctx.fillStyle = "#2f3542"; ctx.fillRect(blueBed.x, blueBed.y, blueBed.w, blueBed.h);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(blueBed.x, blueBed.y, 10, blueBed.h);
    }
    if(redBedAlive) {
        ctx.fillStyle = "#ff4757"; ctx.fillRect(redBed.x, redBed.y, redBed.w, redBed.h);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(redBed.x + 30, redBed.y, 10, redBed.h);
    }

    // Desenhar Inimigo (Red)
    if(bot.x > 0) {
        ctx.fillStyle = "#ff4757";
        ctx.beginPath(); ctx.arc(bot.x, bot.y, bot.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.stroke();
    }

    // Desenhar Jogador (Blue)
    if(player.x > 0) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        ctx.fillStyle = "#1e90ff";
        ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
        
        // Item na mão
        ctx.fillStyle = activeSlot === 0 ? '#a1a1a1' : (activeSlot === 1 ? '#57606f' : '#ffffff');
        ctx.fillRect(8, -2, 8, 4);
        ctx.restore();

        // Barra de Vida Dinâmica
        ctx.fillStyle = '#ff4757'; ctx.fillRect(player.x - 15, player.y - 20, 30, 4);
        ctx.fillStyle = '#2ed573'; ctx.fillRect(player.x - 15, player.y - 20, 30 * (player.hp/player.maxHp), 4);
    }

    // Desenhar Controle Analógico Virtual
    if(joyMove.active) {
        ctx.save(); ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(joyMove.x, joyMove.y, joyMove.rOut, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(joyMove.cx, joyMove.cy, joyMove.rIn, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

function engineLoop() {
    update();
    draw();
    requestAnimationFrame(engineLoop);
}

// Interface (UI Control)
function updateHUD() {
    document.getElementById('hud-iron').innerText = inventory.iron;
    document.getElementById('hud-gold').innerText = inventory.gold;
    document.getElementById('slot-blocks').innerHTML = `📦${inventory.blocks}<br><span>Blocos</span>`;
}

function setSlot(id) {
    activeSlot = id;
    const slots = document.querySelectorAll('.slot');
    slots.forEach((s, idx) => s.className = idx === id ? 'slot active' : 'slot');
}

function toggleShop(open) {
    document.getElementById('shop-modal').style.display = open ? 'grid' : 'none';
    if(open) renderShopList();
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('shop-title').innerText = `${tab.toUpperCase()} SHOP`;
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(b => b.className = b.innerText.toLowerCase() === tab ? 'tab-btn active' : 'tab-btn');
    renderShopList();
}

function renderShopList() {
    const container = document.getElementById('shop-items-container');
    container.innerHTML = '';
    
    shopData[currentTab].forEach(item => {
        let card = document.createElement('div');
        card.className = 'item-card';
        let wallet = inventory[item.costType];
        let cantBuy = wallet < item.cost ? 'disabled' : '';

        card.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <span style="font-size:11px; color:#a0aabf;">Preço: ${item.cost} ${item.costType}</span>
            </div>
            <button ${cantBuy} onclick="buyItem('${item.id}', ${item.cost}, '${item.costType}', ${item.amount || 0})">Comprar</button>
        `;
        container.appendChild(card);
    });
}

function buyItem(id, cost, type, amt) {
    if(inventory[type] >= cost) {
        inventory[type] -= cost;
        if(id === 'wool' || id === 'wood') {
            inventory.blocks += amt;
            setSlot(2);
        } else if(id === 'stone_sword') {
            player.dmg = 24;
            showAlert("VOCÊ COMPROU UMA ESPADA MELHOR!");
        } else if(id === 'apple') {
            player.hp = Math.min(player.maxHp, player.hp + 35);
        }
        updateHUD();
        renderShopList();
    }
}

// Inicialização
updateHUD();
engineLoop();
