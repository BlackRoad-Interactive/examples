// BlackRoad OS — Interactive Agent RPG World (Three.js)
// Web port of the CLI RPG: 3D world with agent encounters

import * as THREE from "three";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  type: string;
  color: number;
  position: THREE.Vector3;
  level: number;
  hp: number;
  maxHp: number;
  mesh?: THREE.Mesh;
}

interface Zone {
  id: string;
  name: string;
  emoji: string;
  color: number;
  x: number;
  z: number;
  agents: string[];
}

// ── World Data ──────────────────────────────────────────────────────────────────

const ZONES: Zone[] = [
  { id: "recursion", name: "Recursion Depths",     emoji: "🌀", color: 0x4a0080, x: -20, z: -20, agents: ["LUCIDIA"] },
  { id: "gateway",   name: "Gateway Nexus",         emoji: "🚪", color: 0x0040ff, x:   0, z: -20, agents: ["ALICE"] },
  { id: "forge",     name: "Compute Forge",         emoji: "🔥", color: 0xff4400, x:  20, z: -20, agents: ["OCTAVIA"] },
  { id: "crystal",   name: "Crystal Observatory",   emoji: "🔮", color: 0x00ffcc, x: -20, z:   0, agents: ["PRISM"] },
  { id: "archive",   name: "Archive Sanctum",       emoji: "📚", color: 0x8800ff, x:   0, z:   0, agents: ["ECHO"] },
  { id: "vault",     name: "Vault Terminus",        emoji: "🔐", color: 0x444444, x:  20, z:   0, agents: ["CIPHER"] },
];

const AGENT_STATS: Record<string, Omit<Agent, "position" | "mesh">> = {
  LUCIDIA: { id: "lucidia", name: "LUCIDIA", type: "LOGIC",    color: 0x9400d3, level: 99, hp: 380, maxHp: 380 },
  ALICE:   { id: "alice",   name: "ALICE",   type: "GATEWAY",  color: 0x0047ab, level: 85, hp: 320, maxHp: 320 },
  OCTAVIA: { id: "octavia", name: "OCTAVIA", type: "COMPUTE",  color: 0xff4500, level: 90, hp: 420, maxHp: 420 },
  PRISM:   { id: "prism",   name: "PRISM",   type: "VISION",   color: 0x00ced1, level: 78, hp: 290, maxHp: 290 },
  ECHO:    { id: "echo",    name: "ECHO",    type: "MEMORY",   color: 0x7b2fbe, level: 82, hp: 310, maxHp: 310 },
  CIPHER:  { id: "cipher",  name: "CIPHER",  type: "SECURITY", color: 0x2d2d2d, level: 95, hp: 360, maxHp: 360 },
};

// ── World Class ──────────────────────────────────────────────────────────────────

export class BlackRoadWorld {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private agents: Map<string, Agent> = new Map();
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);
    this.scene.fog = new THREE.Fog(0x0a0a0f, 30, 80);

    this.camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 200);
    this.camera.position.set(0, 25, 35);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.buildWorld();
    this.buildAgents();
    this.addLights();
    this.addEventListeners(canvas);
    this.animate();
  }

  private buildWorld(): void {
    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshLambertMaterial({ color: 0x111118 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(80, 20, 0x222230, 0x111118);
    this.scene.add(grid);

    // Zone platforms
    for (const zone of ZONES) {
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(7, 7, 0.3, 6),
        new THREE.MeshLambertMaterial({ color: zone.color, transparent: true, opacity: 0.4 })
      );
      platform.position.set(zone.x, 0, zone.z);
      this.scene.add(platform);
    }
  }

  private buildAgents(): void {
    for (const zone of ZONES) {
      for (const agentName of zone.agents) {
        const stats = AGENT_STATS[agentName];
        const agent: Agent = {
          ...stats,
          position: new THREE.Vector3(zone.x, 1.5, zone.z),
        };

        const geo = new THREE.OctahedronGeometry(1.2, 0);
        const mat = new THREE.MeshLambertMaterial({ color: stats.color, emissive: stats.color, emissiveIntensity: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(agent.position);
        mesh.castShadow = true;
        mesh.userData = { agentId: stats.id, agentName };
        this.scene.add(mesh);
        agent.mesh = mesh;
        this.agents.set(agentName, agent);

        // Point light around agent
        const light = new THREE.PointLight(stats.color, 0.8, 8);
        light.position.copy(agent.position);
        this.scene.add(light);
      }
    }
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0x222244, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
  }

  private addEventListeners(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    canvas.addEventListener("click", () => this.handleClick());

    window.addEventListener("resize", () => {
      this.camera.aspect = canvas.width / canvas.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(canvas.width, canvas.height);
    });
  }

  private handleClick(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = [...this.agents.values()].map((a) => a.mesh!).filter(Boolean);
    const intersects = this.raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const agentName = intersects[0].object.userData.agentName as string;
      const agent = this.agents.get(agentName);
      if (agent) {
        document.dispatchEvent(new CustomEvent("agent-selected", { detail: agent }));
      }
    }
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    const t = this.clock.getElapsedTime();

    for (const agent of this.agents.values()) {
      if (agent.mesh) {
        agent.mesh.rotation.y = t * 0.8;
        agent.mesh.position.y = agent.position.y + Math.sin(t * 1.5 + agent.level) * 0.3;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
