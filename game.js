// Detectar Plataforma
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'block';
}

// Configuração do Cenário 3D (Three.js)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5c94fc); // Céu azul clássico do Bloxd

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Luzes do Ambiente
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(20, 40, 20);
scene.add(dirLight);

// Variáveis de Jogo e Física Básica
let inventory = { iron: 0, gold: 0, blocks: 0 };
let activeSlot = 0;
let currentTab = 'blocks';

// Parâmetros de Movimento e Gravidade
const player = {
    height: 1.8,
    speed: 0.12,
    velocityY: 0,
    gravity: 0.012,
    jumpForce: 0.22,
    canJump: true,
    hp: 100,
    dmg: 20
};

// Dados da Loja
const shopData = {
    blocks: [
        { id: 'wool', name: 'Lã x16', costType: 'iron', cost: 8, amount: 16 },
        { id: 'wood', name: 'Madeira x16', costType: 'iron', cost: 16, amount: 16 }
    ],
    combat: [
        { id: 'stone_sword', name: 'Espada Pedra', costType: 'iron', cost: 24, dmg: 35 }
    ],
    utility: [
        { id: 'apple', name: 'Maçã (Cura)', costType: 'iron', cost: 6 }
    ]
};

// Estrutura Física do Mapa por Coordenadas de Blocos (Voxel Grid)
const blockMap = new Map(); // Guarda a posição "x,y,z" dos blocos
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const greenMaterial = new THREE.MeshLambertMaterial({ color: 0x7bec5c });
const greyMaterial = new THREE.MeshLambertMaterial({ color: 0xd1d8e0 });
const blueMaterial = new THREE.MeshLambertMaterial({ color: 0x2e66ff });
const redMaterial = new THREE.MeshLambertMaterial({ color: 0xff3e3e });

// Gerador de Blocos no Mundo
function addBlockToWorld(x, y, z, material, type='island') {
    const mesh = new THREE.Mesh(blockGeometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    blockMap.set(`${x},${y},${z}`, { mesh: mesh, type: type });
}

// Gerar Ilha Azul (Início) e Vermelha
function createWorldGrid() {
    // Ilha do Jogador (Azul)
    for(let x = -4; x <= 4; x++) {
        for(let z = -4; z <= 4; z++) {
            addBlockToWorld(x, 0, z, greenMaterial);
        }
    }
    // Cama Azul
    addBlockToWorld(0, 1, -3, blueMaterial, 'blue_bed');

    // Ilha Inimiga (Vermelha)
    for(let x = -4; x <= 4; x++) {
        for(let z = 20; z <= 28; z++) {
            addBlockToWorld(x, 0, z, greenMaterial);
        }
    }
    // Cama Vermelha
    addBlockToWorld(0, 1, 26, redMaterial, 'red_bed');
}
createWorldGrid();

// Posicionar Câmera no ponto de Spawn Inicial
camera.position.set(0, player.height, 3);
let yaw = 0;   // Rotação Esquerda/Direita
let pitch = 0; // Rotação Cima/Baixo

// ======================================================
// CONTROLES DE COMPUTADOR (Teclado e Mouse PointerLock)
// ======================================================
const keys = { w: false, a: false, s: false, d: false, Space: false };

if (!isMobile) {
    // Ativa clique para travar o mouse na tela (Igual Bloxd)
    window.addEventListener('click', () => {
        if(document.getElementById('shop-modal').style.display !== 'grid') {
            renderer.domElement.requestPointerLock();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === renderer.domElement) {
            yaw -= e.movementX * 0.0025;
            pitch -= e.movementY * 0.0025;
            pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
        }
    });

    window.addEventListener('keydown', (e) => {
        if(e.code === 'KeyB') toggleShop(true);
        if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
        if(e.code === 'Space') keys.Space = true;
        
        // Atalhos de Hotbar no PC
        if(e.key === '1') setSlot(0);
        if(e.key === '2') setSlot(1);
        if(e.key === '3') setSlot(2);
    });

    window.addEventListener('keyup', (e) => {
        if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
        if(e.code === 'Space') keys.Space = false;
    });

    // Cliques do Mouse (Ataque e Bloco)
    window.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement === renderer.domElement) {
            if(e.button === 0) performAttackAction(); // Botão Esquerdo
            if(e.button === 2) performPlaceBlock();  // Botão Direito
        }
    });
}

// ======================================================
// CONTROLES DE ANDROID (Joysticks Táteis por Coordenadas)
// ======================================================
let touchMoveData = { dx: 0, dy: 0 };
let touchLookData = { dx: 0, dy: 0 };

if (isMobile) {
    const joyMoveEl = document.getElementById('joystick-move');
    const joyLookEl = document.getElementById('joystick-look');

    // Toque para andar
    joyMoveEl.addEventListener('touchmove', (e) => {
        let t = e.touches[0];
        let rect = joyMoveEl.getBoundingClientRect();
        let cx = rect.left + rect.width/2;
        let cy = rect.top + rect.height/2;
        touchMoveData.dx = (t.clientX - cx) / (rect.width/2);
        touchMoveData.dy = (t.clientY - cy) / (rect.height/2);
    });
    joyMoveEl.addEventListener('touchend', () => { touchMoveData = { dx: 0, dy: 0 }; });

    // Toque para olhar/girar câmera
    joyLookEl.addEventListener('touchmove', (e) => {
        let t = e.touches[0];
        let rect = joyLookEl.getBoundingClientRect();
        let cx = rect.left + rect.width/2;
        let cy = rect.top + rect.height/2;
        yaw -= ((t.clientX - cx) / (rect.width/2)) * 0.04;
        pitch -= ((t.clientY - cy) / (rect.height/2)) * 0.04;
        pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    });

    // Botões físicos virtuais
    document.getElementById('btn-jump').addEventListener('touchstart', () => { if(player.canJump) player.velocityY = player.jumpForce; });
    document.getElementById('btn-action').addEventListener('touchstart', performPlaceBlock);
    document.getElementById('btn-attack').addEventListener('touchstart', performAttackAction);
}

// ======================================================
// LÓGICA MECÂNICA DAS AÇÕES (Ataque e Bloco)
// ======================================================
function performPlaceBlock() {
    if(activeSlot === 2 && inventory.blocks > 0) {
        // Calcula a posição exata à frente do jogador no espaço 3D
        let bx = Math.round(camera.position.x + Math.sin(yaw) * -1.5);
        let bz = Math.round(camera.position.z + Math.cos(yaw) * -1.5);
        let by = Math.round(camera.position.y - 0.5);

        if(!blockMap.has(`${bx},${by},${bz}`)) {
            addBlockToWorld(bx, by, bz, greyMaterial, 'player_block');
            inventory.blocks--;
            updateHUD();
        }
    }
}

function performAttackAction() {
    // Procura por blocos de Cama ou inimigos à frente
    let bx = Math.round(camera.position.x + Math.sin(yaw) * -1.5);
    let bz = Math.round(camera.position.z + Math.cos(yaw) * -1.5);
    let by = Math.round(camera.position.y - 0.5);

    let targetKey = `${bx},${by},${bz}`;
    if(blockMap.has(targetKey)) {
        let block = blockMap.get(targetKey);
        if(block.type === 'red_bed') {
            scene.remove(block.mesh);
            blockMap.delete(targetKey);
            showAlert("VOCÊ DESTRUIU A CAMA VERMELHA!");
        }
    }
}

function showAlert(msg) {
    const box = document.getElementById('alert-box');
    box.innerText = msg;
    setTimeout(() => box.innerText = "", 3000);
}

// ======================================================
// MOTOR DE LOOP E ATUALIZAÇÃO DA FÍSICA DE GRAVIDADE
// ======================================================
let lastIronTime = 0;

function gameLoop() {
    requestAnimationFrame(gameLoop);

    let now = Date.now();

    // 1. Processar Rotação da Câmera
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // 2. Processar Vetores de Direção (Andar)
    let moveX = 0;
    let moveZ = 0;

    if (!isMobile) {
        // Lógica de Teclado PC
        if (keys.w) { moveX -= Math.sin(yaw); moveZ -= Math.cos(yaw); }
        if (keys.s) { moveX += Math.sin(yaw); moveZ += Math.cos(yaw); }
        if (keys.a) { moveX -= Math.cos(yaw); moveZ += Math.sin(yaw); }
        if (keys.d) { moveX += Math.cos(yaw); moveZ -= Math.sin(yaw); }
        if (keys.Space && player.canJump) {
            player.velocityY = player.jumpForce;
            player.canJump = false;
        }
    } else {
        // Lógica de Joystick Celular
        moveX = touchMoveData.dx * Math.cos(yaw) - touchMoveData.dy * Math.sin(yaw);
        moveZ = touchMoveData.dx * Math.sin(yaw) + touchMoveData.dy * Math.cos(yaw);
    }

    // Aplicar movimento na coordenada do Player
    camera.position.x += moveX * player.speed;
    camera.position.z += moveZ * player.speed;

    // 3. Aplicar Gravidade e Colisão de Piso Simples
    player.velocityY -= player.gravity;
    camera.position.y += player.velocityY;

    let pBlockX = Math.round(camera.position.x);
    let pBlockY = Math.round(camera.position.y - player.height);
    let pBlockZ = Math.round(camera.position.z);

    // Checa se tem bloco embaixo do pé
    if(blockMap.has(`${pBlockX},${pBlockY},${pBlockZ}`)) {
        camera.position.y = pBlockY + player.height;
        player.velocityY = 0;
        player.canJump = true;
    }

    // Queda no Vazio (Void)
    if(camera.position.y < -15) {
        camera.position.set(0, player.height, 3); // Respawn
        player.velocityY = 0;
        showAlert("VOCÊ CAIU NO VOID!");
    }

    // Gerador Automático de Ferro por Proximidade (Base central)
    if(now - lastIronTime > 1500) {
        if(Math.abs(camera.position.x) < 2 && Math.abs(camera.position.z) < 2) {
            inventory.iron += 2;
            updateHUD();
        }
        lastIronTime = now;
    }

    renderer.render(scene, camera);
}

// ======================================================
// EVENTOS DE INTERFACE DE USUÁRIO (HUD/SHOP)
// ======================================================
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
    if(open && !isMobile) document.exitPointerLock(); // Solta mouse no PC para comprar
    if(open) renderShopList();
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('shop-title').innerText = `${tab.toUpperCase()} SHOP`;
    renderShopList();
}

function renderShopList() {
    const container = document.getElementById('shop-items-container');
    container.innerHTML = '';
    shopData[currentTab].forEach(item => {
        let card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div><strong>${item.name}</strong><span style="font-size:11px;color:#aaa;">Custo: ${item.cost} Ferro</span></div>
            <button onclick="buyItem('${item.id}', ${item.cost}, ${item.amount || 0})">Comprar</button>
        `;
        container.appendChild(card);
    });
}

function buyItem(id, cost, amt) {
    if(inventory.iron >= cost) {
        inventory.iron -= cost;
        if(id === 'wool' || id === 'wood') {
            inventory.blocks += amt;
            setSlot(2);
        } else if(id === 'stone_sword') {
            player.dmg = 35;
        }
        updateHUD();
        toggleShop(false);
    }
}

// Iniciar Motor
updateHUD();
gameLoop();
