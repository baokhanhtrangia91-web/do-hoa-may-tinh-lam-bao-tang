import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- BIẾN TOÀN CỤC ---
let scene, camera, renderer, controls, raycaster;
const mouse = new THREE.Vector2(0, 0); 

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isSprinting = false, canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();
let intersectedArt = null;

// TỐI ƯU LAG CÁCH 1: Mảng riêng chỉ chứa các bức tranh để Raycaster quét
const interactableObjects = []; 

// UI Elements
const instructions = document.getElementById('instructions');
const hudStatus = document.getElementById('status');
const hudPos = document.getElementById('pos');
const crosshair = document.getElementById('crosshair');
const artUI = document.getElementById('art-description');
const artTitle = document.getElementById('art-title');
const artText = document.getElementById('art-text');

// Media Elements
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Bóng đổ viền mềm (Soft shadow)
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Màu sắc chuẩn điện ảnh
    renderer.toneMappingExposure = 1.0; // Độ phơi sáng
    document.body.appendChild(renderer.domElement);

    // Tăng nhẹ ánh sáng môi trường để các góc tối không bị đen kịt
    scene.add(new THREE.AmbientLight(0xffffff, 0.4)); 

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
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });

    // 1. SÀN NHÀ
    const floorTex = loader.load('textures/white-tiles-textures-background.jpg');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(15, 15);
    
    const floorBig = new THREE.Mesh(new THREE.PlaneGeometry(BIG_ROOM, BIG_ROOM), new THREE.MeshStandardMaterial({map: floorTex}));
    floorBig.rotation.x = -Math.PI / 2;
    floorBig.receiveShadow = true;
    scene.add(floorBig);

    const floorSmall = new THREE.Mesh(new THREE.PlaneGeometry(SMALL_ROOM_W, SMALL_ROOM_D), new THREE.MeshStandardMaterial({color: 0xdddddd}));
    floorSmall.rotation.x = -Math.PI / 2;
    floorSmall.position.set(0, 0.01, 32.5);
    floorSmall.receiveShadow = true;
    scene.add(floorSmall);

    const addW = (w, h, d, x, z, ry = 0) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        wall.position.set(x, h/2, z);
        wall.rotation.y = ry;
        wall.receiveShadow = true;
        scene.add(wall);
    };

    // 2. TƯỜNG
    addW(BIG_ROOM, 13, 1, 0, -25);
    addW(1, 13, BIG_ROOM, -25, 0);
    addW(1, 13, BIG_ROOM, 25, 0);
    addW(20, 13, 1, -15, 25); 
    addW(20, 13, 1, 15, 25);
    addW(SMALL_ROOM_W, 13, 1, 0, 40);
    addW(1, 13, SMALL_ROOM_D, -10, 32.5);
    addW(1, 13, SMALL_ROOM_D, 10, 32.5);

    // 1. Dùng HemisphereLight tạo ánh sáng môi trường thực tế hơn (trên sáng, dưới tối nhẹ)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    // 3. VẬT THỂ GIỮA PHÒNG (Bục đặt tượng)
    const gHe = new THREE.Mesh(new THREE.BoxGeometry(7, 1.5, 7), new THREE.MeshStandardMaterial({color: 0xdddddd}));
    gHe.position.set(0, 0.75, 0);
    gHe.castShadow = true;     // Thêm dòng này
    gHe.receiveShadow = true;  // Thêm dòng này
    scene.add(gHe);

    // 4. THÊM BỨC TƯỢNG (STATUE)
    const loader3D = new GLTFLoader();
    loader3D.load('bld/Dragon_2.5_For_Animations.glb', (gltf) => {
        const statue = gltf.scene;
        statue.position.set(0, 1.5, 0); 
        statue.scale.set(0.2, 0.2, 0.2); 
        
        statue.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        scene.add(statue);
    }, undefined, (error) => {
        console.error("Lỗi khi tải tượng:", error);
    });

    // --- THÊM ĐÈN RỌI (SPOTLIGHT) CHO TƯỢNG ---
    // Đèn này sẽ tạo ra bóng đổ chính cho căn phòng mà không gây lag như PointLight
    const statueSpotLight = new THREE.SpotLight(0xfff0dd, 500); // Ánh sáng vàng nhẹ, cường độ cao cho bản Three.js mới
    statueSpotLight.position.set(5, 12, 10); // Đặt xéo phía trên tượng
    statueSpotLight.angle = Math.PI / 6; // Góc rọi
    statueSpotLight.penumbra = 0.5; // Làm mềm viền ánh sáng
    statueSpotLight.decay = 2; // Độ suy giảm ánh sáng
    statueSpotLight.distance = 40;
    
    // Bật bóng đổ CHỈ cho đèn rọi này
    statueSpotLight.castShadow = true;
    statueSpotLight.shadow.mapSize.width = 1024; // Chất lượng bóng
    statueSpotLight.shadow.mapSize.height = 1024;
    statueSpotLight.shadow.bias = -0.001; // Fix lỗi sọc đen (shadow acne)
    
    scene.add(statueSpotLight);
    // Cần có target để Spotlight biết chiếu vào đâu
    statueSpotLight.target.position.set(0, 0, 0); 
    scene.add(statueSpotLight.target);
    // ------------------------------------------
    // 5. TRẦN NHÀ
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 });
    
    const ceilingBig = new THREE.Mesh(new THREE.PlaneGeometry(BIG_ROOM, BIG_ROOM), ceilingMat);
    ceilingBig.rotation.x = Math.PI / 2; 
    ceilingBig.position.set(0, 13, 0);   
    scene.add(ceilingBig);

    const ceilingSmall = new THREE.Mesh(new THREE.PlaneGeometry(SMALL_ROOM_W, SMALL_ROOM_D), ceilingMat);
    ceilingSmall.rotation.x = Math.PI / 2;
    ceilingSmall.position.set(0, 13, 32.5); 
    scene.add(ceilingSmall);

    // 6. HỆ THỐNG ĐÈN TRẦN
    const addCeilingLight = (x, z) => {
        // Hộp đèn LED phát sáng
        const bulbMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffee, 
            emissive: 0xffffee,  // Cho bóng đèn tự phát sáng rực lên
            emissiveIntensity: 2 
        }); 
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 2.5), bulbMaterial);
        bulb.position.set(x, 12.95, z); 
        scene.add(bulb);

        // Nguồn sáng thực tế - Giữ nguyên tắt shadow để tối ưu
        const light = new THREE.PointLight(0xffffee, 80, 25); // Điều chỉnh cường độ cho bản Threejs r160+
        light.position.set(x, 12.5, z); 
        light.castShadow = false; 
        scene.add(light);
    };

    // Phân bố đèn
    addCeilingLight(0, 0);       
    addCeilingLight(-15, -15);   
    addCeilingLight(15, -15);    
    addCeilingLight(-15, 12);    
    addCeilingLight(15, 12);     
    addCeilingLight(0, 32.5);    

    // 7. TREO TRANH
    addArt('textures/mona.JPG', 10, 6, 0, -24.4, 0, "Mona Lisa", "Tác phẩm kinh điển của Leonardo da Vinci.", 'audio/How the Mona Lisa became so overrated.mp3', 'video');
    addArt('textures/the-madonna.jpg', 5, 5, -24.4, -15, Math.PI/2, "The Madonna", "Thuyết minh về sự ra đời của tác phẩm.", 'audio/madonna.mp3', 'audio');
    addArt('textures/art3.jpg', 5, 5, -24.4, 15, Math.PI/2, "Tranh 3", "Mô tả tranh 3");
    addArt('textures/art2.jpg', 5, 5, 24.4, -15, -Math.PI/2, "Tranh 2", "Mô tả tranh 2");
    addArt('textures/art4.jpg', 5, 5, 24.4, 15, -Math.PI/2, "Tranh 4", "Mô tả tranh 4");
    addArt('textures/info.jpg', 7, 9, -10, 24.4, Math.PI, "Thông Tin", "Chào mừng bạn.");
}

// CẬP NHẬT: Hàm addArt nhận thêm media và đưa vào mảng tương tác
function addArt(url, w, h, x, z, ry, title, desc, mediaUrl = '', mediaType = 'none') {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const art = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: loader.load(url) })
    );
    
    // Lưu thông tin vào userData
    art.userData = { isArt: true, title, desc, mediaUrl, mediaType };
    
    // TỐI ƯU LAG CÁCH 1: Đưa tranh vào danh sách cần quét Raycaster
    interactableObjects.push(art);
    
    const frame = new THREE.Mesh(
        new THREE.BoxGeometry(w+0.4, h+0.4, 0.1), 
        new THREE.MeshStandardMaterial({color:0x111111, roughness: 0.8}) // Đổi màu khung đen nhám
    );
    
    // --- BẬT ĐỔ BÓNG CHO KHUNG TRANH ---
    frame.castShadow = true;
    
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

function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
        case 'ShiftLeft': isSprinting = false; break;
    }
}

function toggleArtUI() {
    if (artUI.style.display === 'block') {
        artUI.style.display = 'none';
        stopAllMedia();
        velocity.set(0, 0, 0); 
        moveForward = moveBackward = moveLeft = moveRight = false;
        controls.lock(); 
    } else if (intersectedArt) {
        const data = intersectedArt.userData;
        artTitle.innerText = data.title;
        artText.innerText = data.desc;
        artUI.style.display = 'block';

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
        const actualDelta = Math.min(delta, 0.1); 

        velocity.x -= velocity.x * 10.0 * actualDelta;
        velocity.z -= velocity.z * 10.0 * actualDelta;
        velocity.y -= 30.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speed = isSprinting ? 180.0 : 90.0;
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
        
        // Va chạm với khối vuông ở giữa (gHe)
        const boxSize = 3.5; // gHe rộng 7x7 nên nửa chiều là 3.5
        const buffer = 1.0; 
        const bound = boxSize + buffer; // = 4.5

        if (px > -bound && px < bound && pz > -bound && pz < bound) {
            if (Math.abs(px) > Math.abs(pz)) {
                px = px > 0 ? bound : -bound;
            } else {
                pz = pz > 0 ? bound : -bound;
            }
        }

        camera.position.x = px;
        camera.position.z = pz;

        // --- RAYCASTING (ĐÃ TỐI ƯU) ---
        raycaster.setFromCamera(mouse, camera);
        // TỐI ƯU LAG CÁCH 1: Chỉ kiểm tra va chạm tia nhìn với các bức tranh, bỏ thuộc tính "true" đệ quy
        const intersects = raycaster.intersectObjects(interactableObjects, false);
        
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
