import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- BIẾN TOÀN CỤC ---
let scene, camera, renderer, controls, raycaster;
const mouse = new THREE.Vector2(0, 0); 

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isSprinting = false, canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();
let intersectedArt = null;

// UI Elements
const instructions = document.getElementById('instructions');
const hudStatus = document.getElementById('status');
const hudPos = document.getElementById('pos');
const crosshair = document.getElementById('crosshair');
const artUI = document.getElementById('art-description');
const artTitle = document.getElementById('art-title');
const artText = document.getElementById('art-text');

// Kích thước theo sơ đồ (Phòng lớn 50x50, Phòng nhỏ 20x15)
const BIG_ROOM = 50; 
const SMALL_ROOM_W = 20;
const SMALL_ROOM_D = 15;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 0, 70);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // SPAWN ở phòng nhỏ (Phía dưới sơ đồ, trục Z dương)
    camera.position.set(0, 2.5, 40); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    controls = new PointerLockControls(camera, document.body);
    instructions.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => instructions.style.display = 'none');
    controls.addEventListener('unlock', () => {
        instructions.style.display = 'flex';
        artUI.style.display = 'none';
    });
    scene.add(controls.getObject());

    raycaster = new THREE.Raycaster();
    raycaster.far = 8; 

    createWorld();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize);
}

function createWorld() {
    const loader = new THREE.TextureLoader();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    // --- 1. SÀN NHÀ (Gộp cả 2 phòng) ---
    const floorTex = loader.load('textures/white-tiles-textures-background.jpg');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(15, 15);
    
    // Sàn phòng lớn
    const floorBig = new THREE.Mesh(new THREE.PlaneGeometry(BIG_ROOM, BIG_ROOM), new THREE.MeshStandardMaterial({map: floorTex}));
    floorBig.rotation.x = -Math.PI / 2;
    scene.add(floorBig);

    // Sàn phòng nhỏ (Spawn)
    const floorSmall = new THREE.Mesh(new THREE.PlaneGeometry(SMALL_ROOM_W, SMALL_ROOM_D), new THREE.MeshStandardMaterial({color: 0xdddddd}));
    floorSmall.rotation.x = -Math.PI / 2;
    floorSmall.position.set(0, 0.01, 32.5); // Nối tiếp trục Z
    scene.add(floorSmall);

    const addW = (w, h, d, x, z, ry = 0) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        wall.position.set(x, h/2, z);
        wall.rotation.y = ry;
        scene.add(wall);
    };

    // --- 2. TƯỜNG PHÒNG LỚN ---
    addW(BIG_ROOM, 12, 1, 0, -25); // Tường chính (Bắc)
    addW(1, 12, BIG_ROOM, -25, 0); // Tường trái (Tây)
    addW(1, 12, BIG_ROOM, 25, 0);  // Tường phải (Đông)
    // Tường ngăn cách có cửa (Nam)
    addW(20, 12, 1, -15, 25); 
    addW(20, 12, 1, 15, 25);

    // --- 3. TƯỜNG PHÒNG NHỎ (Spawn) ---
    addW(SMALL_ROOM_W, 10, 1, 0, 40); // Tường sau lưng spawn
    addW(1, 10, SMALL_ROOM_D, -10, 32.5);
    addW(1, 10, SMALL_ROOM_D, 10, 32.5);

    // --- 4. BỐ TRÍ VẬT THỂ (GHẾ & BỆ) ---
    // Ghế ở giữa phòng lớn
    const gHe = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 8), new THREE.MeshStandardMaterial({color: 0x333333}));
    gHe.position.set(0, 0.75, 0);
    scene.add(gHe);

    // Bệ treo tranh chính
    const beTranh = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 2), new THREE.MeshStandardMaterial({color: 0x222222}));
    beTranh.position.set(0, 0.25, -23.5);
    scene.add(beTranh);

    // --- 5. TREO TRANH THEO SƠ ĐỒ ---
    // Tranh chính (đối diện cửa)
    addArt('textures/mona.JPG', 10, 6, 0, -24.4, 0, "Tranh Chính", "Tác phẩm tiêu điểm của phòng triển lãm.");

    // Tranh 1 & 3 (Tường bên trái - số 1 ở trên, 3 ở dưới)
    addArt('textures/the-madonna.jpg', 5, 5, -24.4, -15, Math.PI/2, "Tranh 1", "Mô tả tranh 1");
    addArt('textures/art3.jpg', 5, 5, -24.4, 15, Math.PI/2, "Tranh 3", "Mô tả tranh 3");

    // Tranh 2 & 4 (Tường bên phải - số 2 ở trên, 4 ở dưới)
    addArt('textures/art2.jpg', 5, 5, 24.4, -15, -Math.PI/2, "Tranh 2", "Mô tả tranh 2");
    addArt('textures/art4.jpg', 5, 5, 24.4, 15, -Math.PI/2, "Tranh 4", "Mô tả tranh 4");

    // Thông tin phòng (Gần cửa ra vào)
    addArt('textures/info.jpg', 7, 9, -10, 24.4, Math.PI, "Thông Tin Triển Lãm", "Chào mừng bạn đến với bảo tàng 3D.");
}

function addArt(url, w, h, x, z, ry, title, desc) {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const art = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: loader.load(url) })
    );
    art.userData = { isArt: true, title, desc };
    
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w+0.4, h+0.4, 0.1), new THREE.MeshStandardMaterial({color:0x000000}));
    group.add(frame);
    group.add(art);
    art.position.z = 0.06;
    group.position.set(x, 5, z);
    group.rotation.y = ry;
    scene.add(group);
}

function onKeyDown(e) {
    switch (e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'ShiftLeft': isSprinting = true; break;
        case 'Space': if (canJump) velocity.y += 10; canJump = false; break;
        case 'KeyE': toggleArtUI(); break;
    }
}

function toggleArtUI() {
    if (artUI.style.display === 'block') artUI.style.display = 'none';
    else if (intersectedArt) {
        artTitle.innerText = intersectedArt.userData.title;
        artText.innerText = intersectedArt.userData.desc;
        artUI.style.display = 'block';
    }
}

function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
        case 'ShiftLeft': isSprinting = false; break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls.isLocked) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 30.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speed = isSprinting ? 200.0 : 100.0;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.y += (velocity.y * delta);

        if (camera.position.y < 2.5) {
            velocity.y = 0; camera.position.y = 2.5; canJump = true;
        }

        // --- COLLISION (CHẶN TƯỜNG) ---
        let px = camera.position.x;
        let pz = camera.position.z;

        if (pz > 25) { // Trong phòng nhỏ
            px = Math.max(-9, Math.min(9, px));
            pz = Math.min(39, pz);
            if (pz < 26 && (px < -4 || px > 4)) pz = 26; // Chặn tường cửa
        } else { // Trong phòng lớn
            px = Math.max(-24, Math.min(24, px));
            pz = Math.max(-24, pz);
            if (pz > 24 && (px < -4 || px > 4)) pz = 24; // Chặn tường cửa từ bên trong
        }
        camera.position.x = px;
        camera.position.z = pz;

        // --- RAYCASTING ---
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        let foundArt = false;
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (obj.userData.isArt) {
                intersectedArt = obj;
                crosshair.classList.add('active');
                hudStatus.innerHTML = `<span style="color:yellow">E: ${obj.userData.title}</span>`;
                foundArt = true;
            }
        }
        if (!foundArt) {
            intersectedArt = null;
            crosshair.classList.remove('active');
            hudStatus.innerText = "Đang tham quan";
            if (artUI.style.display === 'block') artUI.style.display = 'none';
        }

        hudPos.innerText = `X: ${camera.position.x.toFixed(1)} | Z: ${camera.position.z.toFixed(1)}`;
        prevTime = time;
    }
    renderer.render(scene, camera);
}
