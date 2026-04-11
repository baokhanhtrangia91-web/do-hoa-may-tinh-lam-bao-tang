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

// CẬP NHẬT: Media Elements
const mediaBtn = document.getElementById('media-btn');
const artVideo = document.getElementById('art-video');
const artAudio = document.getElementById('art-audio');

// Kích thước theo sơ đồ
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
    
    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        artUI.style.display = 'none'; // Đóng UI khi quay lại game
        stopAllMedia();
    });

    controls.addEventListener('unlock', () => {
        // Chỉ hiện hướng dẫn nếu bảng tranh không mở
        if (artUI.style.display !== 'block') {
            instructions.style.display = 'flex';
        }
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

    // 1. SÀN NHÀ
    const floorTex = loader.load('textures/white-tiles-textures-background.jpg');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(15, 15);
    
    const floorBig = new THREE.Mesh(new THREE.PlaneGeometry(BIG_ROOM, BIG_ROOM), new THREE.MeshStandardMaterial({map: floorTex}));
    floorBig.rotation.x = -Math.PI / 2;
    scene.add(floorBig);

    const floorSmall = new THREE.Mesh(new THREE.PlaneGeometry(SMALL_ROOM_W, SMALL_ROOM_D), new THREE.MeshStandardMaterial({color: 0xdddddd}));
    floorSmall.rotation.x = -Math.PI / 2;
    floorSmall.position.set(0, 0.01, 32.5);
    scene.add(floorSmall);

    const addW = (w, h, d, x, z, ry = 0) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        wall.position.set(x, h/2, z);
        wall.rotation.y = ry;
        scene.add(wall);
    };

    // 2 & 3. TƯỜNG
    addW(BIG_ROOM, 12, 1, 0, -25);
    addW(1, 12, BIG_ROOM, -25, 0);
    addW(1, 12, BIG_ROOM, 25, 0);
    addW(20, 12, 1, -15, 25); 
    addW(20, 12, 1, 15, 25);
    addW(SMALL_ROOM_W, 10, 1, 0, 40);
    addW(1, 10, SMALL_ROOM_D, -10, 32.5);
    addW(1, 10, SMALL_ROOM_D, 10, 32.5);

    // 4. VẬT THỂ
    const gHe = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, 8), new THREE.MeshStandardMaterial({color: 0xffffff}));
    gHe.position.set(0, 0.75, 0);
    scene.add(gHe);


    // --- 5. CẬP NHẬT: TREO TRANH CÓ MEDIA ---
    // Cấu trúc: addArt(url, rộng, cao, x, z, xoay, tiêu đề, mô tả, link_media, loại_media)
    addArt('textures/mona.JPG', 10, 6, 0, -24.4, 0, "Mona Lisa", "Tác phẩm kinh điển của Leonardo da Vinci.", 'audio/How the Mona Lisa became so overrated.mp3', 'video');
    addArt('textures/the-madonna.jpg', 5, 5, -24.4, -15, Math.PI/2, "The Madonna", "Thuyết minh về sự ra đời của tác phẩm.", 'audio/madonna.mp3', 'audio');
    addArt('textures/art3.jpg', 5, 5, -24.4, 15, Math.PI/2, "Tranh 3", "Mô tả tranh 3");
    addArt('textures/art2.jpg', 5, 5, 24.4, -15, -Math.PI/2, "Tranh 2", "Mô tả tranh 2");
    addArt('textures/art4.jpg', 5, 5, 24.4, 15, -Math.PI/2, "Tranh 4", "Mô tả tranh 4");
    addArt('textures/info.jpg', 7, 9, -10, 24.4, Math.PI, "Thông Tin", "Chào mừng bạn.");
}

// CẬP NHẬT: Hàm addArt nhận thêm media
function addArt(url, w, h, x, z, ry, title, desc, mediaUrl = '', mediaType = 'none') {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const art = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: loader.load(url) })
    );
    
    // Lưu thông tin vào userData
    art.userData = { isArt: true, title, desc, mediaUrl, mediaType };
    
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
    if (artUI.style.display === 'block') {
        // Đóng bảng
        artUI.style.display = 'none';
        stopAllMedia();
        
        // RESET VẬN TỐC để tránh bị văng
        velocity.set(0, 0, 0); 
        moveForward = moveBackward = moveLeft = moveRight = false;
        
        controls.lock(); 
    } else if (intersectedArt) {
        // Mở bảng
        const data = intersectedArt.userData;
        artTitle.innerText = data.title;
        artText.innerText = data.desc;
        artUI.style.display = 'block';

        // Reset vận tốc khi mở bảng để nhân vật đứng yên tại chỗ
        velocity.set(0, 0, 0);
        moveForward = moveBackward = moveLeft = moveRight = false;

        if (data.mediaType !== 'none') {
            mediaBtn.style.display = 'block';
            mediaBtn.onclick = () => playMedia(data.mediaUrl, data.mediaType);
        } else {
            mediaBtn.style.display = 'none';
        }
        controls.unlock(); 
    }
}

function playMedia(url, type) {
    stopAllMedia();
    if (type === 'video') {
        artVideo.src = url;
        artVideo.style.display = 'block';
        artVideo.play();
    } else if (type === 'audio') {
        artAudio.src = url;
        artAudio.play();
    }
}

function stopAllMedia() {
    artVideo.pause();
    artVideo.src = "";
    artVideo.style.display = 'none';
    artAudio.pause();
    artAudio.src = "";
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

        // Giới hạn delta tối đa để tránh bị nhảy vọt khi lag hoặc switch menu
        const actualDelta = Math.min(delta, 0.1); 

        velocity.x -= velocity.x * 10.0 * actualDelta;
        velocity.z -= velocity.z * 10.0 * actualDelta;
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

        // --- COLLISION ---
        let px = camera.position.x;
        let pz = camera.position.z;
        if (pz > 25) {
            px = Math.max(-9, Math.min(9, px));
            pz = Math.min(39, pz);
            if (pz < 26 && (px < -4 || px > 4)) pz = 26;
        } else {
            px = Math.max(-24, Math.min(24, px));
            pz = Math.max(-24, pz);
            if (pz > 24 && (px < -4 || px > 4)) pz = 24;
        }
        // 2. THÊM MỚI: Va chạm với khối vuông ở giữa (gHe)
        // Khối vuông có kích thước 8x8 (x: -4 đến 4, z: -4 đến 4)
        // Ta cộng thêm 1 khoảng đệm (buffer = 1) để camera không bị cắm xuyên vào vật thể
        const boxSize = 4; // Một nửa chiều rộng/dài của khối
        const buffer = 1.0; // Khoảng cách từ camera đến mặt khối
        const bound = boxSize + buffer; // = 5

        if (px > -bound && px < bound && pz > -bound && pz < bound) {
            // Nếu người chơi lọt vào vùng của khối, đẩy họ ra theo trục gần nhất
            if (Math.abs(px) > Math.abs(pz)) {
                // Đẩy ra theo trục X
                px = px > 0 ? bound : -bound;
            } else {
                // Đẩy ra theo trục Z
                pz = pz > 0 ? bound : -bound;
            }
        }

        // Gán lại tọa độ cho camera
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
        }

        hudPos.innerText = `X: ${camera.position.x.toFixed(1)} | Z: ${camera.position.z.toFixed(1)}`;
        prevTime = time;
    }
    renderer.render(scene, camera);
}
