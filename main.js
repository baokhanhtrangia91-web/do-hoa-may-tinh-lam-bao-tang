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

const ROOM_SIZE = 40; // Kích thước phòng

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 0, 40);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2.0, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    scene.add(sun);

    controls = new PointerLockControls(camera, document.body);
    instructions.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => instructions.style.display = 'none');
    controls.addEventListener('unlock', () => {
        instructions.style.display = 'flex';
        closeArtUI();
    });
    scene.add(controls.getObject());

    raycaster = new THREE.Raycaster();
    raycaster.far = 7; // Phạm vi tương tác tối đa 7 mét

    createWorld();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize);
}

function createWorld() {
    const loader = new THREE.TextureLoader();

    // Sàn nhà
    const floorTex = loader.load('textures/white-tiles-textures-background.jpg');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 10);
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
        new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Tường
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const addW = (w, h, d, x, z, ry = 0) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        wall.position.set(x, h/2, z);
        wall.rotation.y = ry;
        wall.receiveShadow = true;
        scene.add(wall);
    };
    addW(ROOM_SIZE, 10, 1, 0, -ROOM_SIZE/2); // Bắc
    addW(ROOM_SIZE, 10, 1, 0, ROOM_SIZE/2);  // Nam
    addW(1, 10, ROOM_SIZE, -ROOM_SIZE/2, 0); // Tây
    addW(1, 10, ROOM_SIZE, ROOM_SIZE/2, 0);  // Đông

    // Tranh
    addArt('textures/mona.JPG', 6, 4, 0, -19.4, 0, 
        "molisa", "tranh nhu db");
    addArt('textures/the-madonna.jpg', 5, 5, -19.4, 5, Math.PI/2,
        "tranh", "xau vl.");
}

function addArt(url, w, h, x, z, ry, title, desc) {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();

    const frame = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    group.add(frame);

    const art = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: loader.load(url) })
    );
    art.position.z = 0.12;
    art.userData = { isArt: true, title, desc };
    group.add(art);

    group.position.set(x, 4.5, z);
    group.rotation.y = ry;
    scene.add(group);
}

function closeArtUI() {
    artUI.style.display = 'none';
}

function onKeyDown(e) {
    switch (e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'ShiftLeft': isSprinting = true; break;
        case 'Space': if (canJump) velocity.y += 12; canJump = false; break;
        case 'KeyE': 
            if (artUI.style.display === 'block') {
                closeArtUI();
            } else if (intersectedArt) {
                artTitle.innerText = intersectedArt.userData.title;
                artText.innerText = intersectedArt.userData.desc;
                artUI.style.display = 'block';
            }
            break;
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

        const speed = isSprinting ? 180.0 : 80.0;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        camera.position.y += (velocity.y * delta);

        if (camera.position.y < 2.0) {
            velocity.y = 0; camera.position.y = 2.0; canJump = true;
        }

        // --- 1. LOGIC CHẶN TƯỜNG (COLLISION) ---
        const limit = (ROOM_SIZE / 2) - 1.5; // Trừ đi một khoảng để không bị kẹt vào tường
        camera.position.x = Math.max(-limit, Math.min(limit, camera.position.x));
        camera.position.z = Math.max(-limit, Math.min(limit, camera.position.z));

        // --- 2. RAYCASTING & TỰ ĐỘNG ĐÓNG TEXT ---
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        let foundArtThisFrame = false;

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (obj.userData.isArt) {
                intersectedArt = obj;
                crosshair.classList.add('active');
                hudStatus.innerHTML = `<span style="color:yellow">E: Xem ${obj.userData.title}</span>`;
                foundArtThisFrame = true;
            }
        }

        // Nếu khung hình này không nhìn thấy tranh, hoặc đi ra xa
        if (!foundArtThisFrame) {
            intersectedArt = null;
            crosshair.classList.remove('active');
            hudStatus.innerText = isSprinting ? "Đang chạy" : (direction.length() > 0 ? "Đang đi bộ" : "Đứng yên");
            
            // Tự động đóng hộp text nếu người dùng quay đi hoặc đi xa
            if (artUI.style.display === 'block') {
                closeArtUI();
            }
        }

        hudPos.innerText = `X: ${camera.position.x.toFixed(1)} | Z: ${camera.position.z.toFixed(1)}`;
        prevTime = time;
    }
    renderer.render(scene, camera);
}
