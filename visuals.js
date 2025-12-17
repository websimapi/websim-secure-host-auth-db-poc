import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class GameVisuals {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x202025);
        this.scene.fog = new THREE.Fog(0x202025, 10, 50);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        this.playerMeshes = new Map(); // Map<playerId, Mesh>
        
        this.setupEnvironment();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
    }

    setupEnvironment() {
        // Floor
        const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        this.scene.add(gridHelper);

        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })
        );
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        this.scene.add(plane);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    updatePlayer(id, data) {
        if (!data || !data.active) {
            this.removePlayer(id);
            return;
        }

        let mesh = this.playerMeshes.get(id);

        if (!mesh) {
            // Create new player mesh
            const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
            const material = new THREE.MeshStandardMaterial({ color: data.color || 0xffffff });
            mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            this.scene.add(mesh);
            this.playerMeshes.set(id, mesh);
        }

        // Interpolate position for smoothness (simple lerp)
        const target = new THREE.Vector3(data.x, data.y, data.z);
        if (mesh.position.distanceTo(target) > 5) {
            mesh.position.copy(target);
        } else {
            mesh.position.lerp(target, 0.2);
        }
    }

    removePlayer(id) {
        const mesh = this.playerMeshes.get(id);
        if (mesh) {
            this.scene.remove(mesh);
            this.playerMeshes.delete(id);
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    getGroundIntersection(clientX, clientY) {
        const mouse = new THREE.Vector2();
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        const intersection = raycaster.ray.intersectPlane(plane, target);
        return intersection;
    }
}

