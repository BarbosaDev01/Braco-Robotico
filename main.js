"use strict";

/* ══════════════════════════════════════════════════════
 * main.js — BraçoBot 3D · Fisioterapia Remota
 *
 * Organização:
 *   1. Classe Articulacao        — modelo de uma junta
 *   2. Classe BracoRobotico      — braço completo + exercícios
 *   3. Classe ControladorRemoto  — parser de comandos remotos
 *   4. Setup Three.js            — cena, câmera, iluminação
 *   5. Construção do braço 3D    — geometrias hierárquicas
 *   6. updateArm3D()             — aplica ângulos ao modelo 3D
 *   7. Orbit Controls            — câmera orbital manual
 *   8. Loop de renderização      — animate()
 *   9. Instanciação e wire-up    — conecta tudo
 *  10. Funções de UI             — sliders, botões, log, status
 * ══════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════
 * 1. CLASSE: Articulacao
 *
 * Representa uma única junta do braço robótico.
 * Responsabilidades:
 *  - Armazenar o ângulo atual
 *  - Aplicar limites físicos (clamp) ao movimento
 *  - Converter graus para radianos (usado pelo Three.js)
 * ══════════════════════════════════════════════════════ */
class Articulacao {
  /**
   * @param {string} nome     - Identificador da articulação
   * @param {number} init     - Ângulo inicial em graus
   * @param {number} min      - Limite mínimo de rotação
   * @param {number} max      - Limite máximo de rotação
   */
  constructor(nome, init = 0, min = 0, max = 180) {
    this.nome   = nome;
    this.angulo = init;
    this.min    = min;
    this.max    = max;
  }

  /**
   * Move a articulação para um ângulo alvo.
   * O Math.max/min garante que nunca saia dos limites físicos.
   * @param {number} valor - ângulo desejado em graus
   * @returns {number} ângulo efetivamente aplicado
   */
  moverPara(valor) {
    this.angulo = Math.max(this.min, Math.min(this.max, valor));
    return this.angulo;
  }

  /**
   * Getter que retorna o ângulo atual em radianos.
   * Conveniente para uso direto com Three.js (rotation.z).
   */
  get rad() {
    return this.angulo * Math.PI / 180;
  }
}


/* ══════════════════════════════════════════════════════
 * 2. CLASSE: BracoRobotico
 *
 * Agrega três articulações e gerencia a execução de
 * exercícios de fisioterapia como sequências assíncronas
 * de movimentos (keyframes com delay entre passos).
 * ══════════════════════════════════════════════════════ */
class BracoRobotico {
  constructor() {
    // Criação das três articulações com seus limites físicos
    this.ombro    = new Articulacao("Ombro",    90,   0, 180);
    this.cotovelo = new Articulacao("Cotovelo", 45,   0, 150);
    this.pulso    = new Articulacao("Pulso",     0, -45,  45);

    // Flag que bloqueia comandos enquanto um exercício está rodando
    this.busy = false;

    /* ── Biblioteca de exercícios de fisioterapia ─────
     * Cada exercício é uma sequência de "passos" (keyframes).
     * Cada passo define: ângulo do ombro (s), cotovelo (e),
     * pulso (w) e o delay em ms antes do próximo passo.
     * ─────────────────────────────────────────────────*/
    this.exercicios = {

      // Exercício 1: Flexão e extensão do ombro
      flexaoOmbro: {
        desc: "Flexão do ombro",
        passos: [
          { s: 30,  e: 45, w: 0,  d: 650 },
          { s: 90,  e: 45, w: 0,  d: 650 },
          { s: 150, e: 45, w: 0,  d: 650 },
          { s: 90,  e: 45, w: 0,  d: 650 },
          { s: 30,  e: 45, w: 0,  d: 650 },
          { s: 90,  e: 45, w: 0,  d: 600 },
        ]
      },

      // Exercício 2: Flexão e extensão do cotovelo
      flexaoCotovelo: {
        desc: "Flexão do cotovelo",
        passos: [
          { s: 90, e: 10,  w: 0,  d: 650 },
          { s: 90, e: 75,  w: 0,  d: 650 },
          { s: 90, e: 140, w: 0,  d: 650 },
          { s: 90, e: 75,  w: 0,  d: 650 },
          { s: 90, e: 10,  w: 0,  d: 650 },
          { s: 90, e: 45,  w: 0,  d: 600 },
        ]
      },

      // Exercício 3: Mobilização completa — todas as juntas
      rotacaoCompleta: {
        desc: "Mobilização completa",
        passos: [
          { s: 45,  e: 20,  w: -20, d: 550 },
          { s: 90,  e: 80,  w: 0,   d: 550 },
          { s: 135, e: 130, w: 20,  d: 550 },
          { s: 90,  e: 80,  w: 0,   d: 550 },
          { s: 45,  e: 20,  w: -20, d: 550 },
          { s: 90,  e: 45,  w: 0,   d: 550 },
        ]
      },

      // Exercício 4: Reabilitação gradual — amplitude crescente
      reabilitacao: {
        desc: "Reabilitação gradual",
        passos: [
          { s: 80,  e: 40, w: 0,   d: 750 },
          { s: 100, e: 55, w: 5,   d: 750 },
          { s: 75,  e: 35, w: -5,  d: 750 },
          { s: 110, e: 70, w: 10,  d: 750 },
          { s: 70,  e: 25, w: -10, d: 750 },
          { s: 90,  e: 45, w: 0,   d: 700 },
        ]
      }
    };

    log("BraçoBot-3D inicializado.", "info");
  }

  /* ── Métodos de movimentação direta ─────────────── */

  moverOmbro(v)    { this.ombro.moverPara(v);    this._sync(); }
  moverCotovelo(v) { this.cotovelo.moverPara(v); this._sync(); }
  moverPulso(v)    { this.pulso.moverPara(v);    this._sync(); }

  /* ── Execução assíncrona de exercícios ──────────── */

  /**
   * Executa um exercício completo, passo a passo.
   * O uso de async/await + setTimeout simula o tempo real
   * entre os movimentos, como faria um microcontrolador
   * com timers de hardware.
   *
   * @param {string} nome - chave do exercício na biblioteca
   */
  async executarExercicio(nome) {
    const ex = this.exercicios[nome];

    if (!ex) {
      log(`Exercício "${nome}" não encontrado.`, "err");
      return;
    }
    if (this.busy) {
      log("Braço em movimento. Aguarde.", "warn");
      return;
    }

    this.busy = true;
    setStatus(true);
    log(`▶ ${ex.desc}`, "ok");

    // Itera pelos keyframes do exercício
    for (const p of ex.passos) {
      this.ombro.moverPara(p.s);
      this.cotovelo.moverPara(p.e);
      this.pulso.moverPara(p.w);
      this._sync();
      log(`  ○ S:${p.s}° E:${p.e}° W:${p.w}°`);
      await aguardar(p.d); // espera antes do próximo passo
    }

    this.busy = false;
    setStatus(false);
    log("✓ Exercício concluído.", "ok");
  }

  /* ── Reset à posição de repouso ─────────────────── */

  reset() {
    this.ombro.moverPara(90);
    this.cotovelo.moverPara(45);
    this.pulso.moverPara(0);
    this._sync();
    log("⟳ Posição inicial restaurada.", "warn");
  }

  /* ── Estado atual ───────────────────────────────── */

  /** Retorna os ângulos atuais das três articulações */
  estado() {
    return {
      s: this.ombro.angulo,
      e: this.cotovelo.angulo,
      w: this.pulso.angulo
    };
  }

  /* ── Privados ────────────────────────────────────── */

  /** Notifica o sistema 3D e a UI após qualquer mudança */
  _sync() {
    updateArm3D();
    updateUI();
  }
}


/* ══════════════════════════════════════════════════════
 * 3. CLASSE: ControladorRemoto
 *
 * Simula o recebimento e parse de comandos enviados
 * remotamente por um fisioterapeuta (como se viessem
 * via WebSocket ou HTTP de um servidor Node.js).
 *
 * Em um sistema real, esta classe receberia objetos JSON
 * via WebSocket e chamaria os métodos do BracoRobotico.
 * ══════════════════════════════════════════════════════ */
class ControladorRemoto {
  /** @param {BracoRobotico} braco - referência ao braço controlado */
  constructor(braco) {
    this.braco = braco;
  }

  /**
   * Processa uma string de comando.
   * Formato: "COMANDO [PARÂMETRO]"
   * Ex: "SET_SHOULDER 120", "RUN_EXERCISE flexaoCotovelo", "RESET"
   *
   * @param {string} raw - string crua do comando recebido
   */
  processar(raw) {
    const partes  = raw.trim().split(/\s+/);
    const comando = partes[0].toUpperCase();
    const param   = partes[1];

    log(`[RX] "${raw}"`, "remote");

    switch (comando) {
      case "SET_SHOULDER":
        this.braco.moverOmbro(Number(param));
        break;

      case "SET_ELBOW":
        this.braco.moverCotovelo(Number(param));
        break;

      case "SET_WRIST":
        this.braco.moverPulso(Number(param));
        break;

      case "RUN_EXERCISE":
        // Converte "FLEXAO_OMBRO" → "flexaoOmbro" (camelCase)
        const nomeEx = param
          ? param.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())
          : null;

        if (nomeEx) this.braco.executarExercicio(nomeEx);
        else        log("Informe o nome do exercício.", "warn");
        break;

      case "RESET":
        this.braco.reset();
        break;

      default:
        log(`Comando desconhecido: "${comando}"`, "err");
    }
  }
}


/* ══════════════════════════════════════════════════════
 * UTILITÁRIO: aguardar
 * Promessa que resolve após X milissegundos.
 * Usada nos exercícios para simular tempo real.
 * ══════════════════════════════════════════════════════ */
const aguardar = ms => new Promise(resolve => setTimeout(resolve, ms));


/* ══════════════════════════════════════════════════════
 * 4. SETUP THREE.JS — CENA, CÂMERA, ILUMINAÇÃO
 * ══════════════════════════════════════════════════════ */

const container = document.getElementById("three-container");
const W = () => container.clientWidth;
const H = () => container.clientHeight;

// ── Renderer ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(W(), H());
renderer.shadowMap.enabled  = true;
renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// ── Cena ──────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog   = new THREE.FogExp2(0x060a12, 0.04); // névoa exponencial

// ── Câmera perspectiva ────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, W() / H(), 0.1, 200);
camera.position.set(4, 3.5, 6);
camera.lookAt(0, 2, 0);

// ── Iluminação ─────────────────────────────────────────
// Luz ambiente — suave, ilumina tudo uniformemente
const ambient = new THREE.AmbientLight(0x1a2a4a, 0.8);
scene.add(ambient);

// Luz direcional principal — simula sol, projeta sombras
const dirLight = new THREE.DirectionalLight(0x90d0ff, 1.2);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far  = 30;
scene.add(dirLight);

// Point lights coloridos — cria a atmosfera sci-fi
const ptA = new THREE.PointLight(0x00e5ff, 1.5, 18); // ciano
ptA.position.set(-3, 5, 3);
scene.add(ptA);

const ptB = new THREE.PointLight(0xa855f7, 1.0, 14); // roxo
ptB.position.set(4, 2, -2);
scene.add(ptB);

// ── Grade de chão ──────────────────────────────────────
const gridHelper = new THREE.GridHelper(20, 20, 0x1a2540, 0x111c30);
scene.add(gridHelper);

// ── Plataforma (base do braço) ─────────────────────────
const platGeo  = new THREE.CylinderGeometry(0.6, 0.7, 0.18, 32);
const platMat  = new THREE.MeshStandardMaterial({ color: 0x0d1f3c, metalness: .9, roughness: .3 });
const platform = new THREE.Mesh(platGeo, platMat);
platform.position.set(0, 0.09, 0);
platform.castShadow = true;
scene.add(platform);


/* ══════════════════════════════════════════════════════
 * 5. CONSTRUÇÃO DO BRAÇO 3D — GEOMETRIAS HIERÁRQUICAS
 *
 * A estrutura usa THREE.Group como "pivô" de rotação.
 * Cada pivot é filho do pivot anterior, formando uma
 * cadeia cinemática: ombro → cotovelo → pulso → garra.
 *
 * Hierarquia de objetos na cena:
 *   scene
 *   └─ pivotShoulder   (rotação = ângulo do ombro)
 *      ├─ jointShoulder (esfera da junta)
 *      ├─ upperArm      (cilindro do braço superior)
 *      └─ pivotElbow    (rotação = ângulo do cotovelo)
 *         ├─ jointElbow  (esfera da junta)
 *         ├─ lowerArm    (cilindro do antebraço)
 *         └─ pivotWrist  (rotação = ângulo do pulso)
 *            ├─ jointWrist (esfera da junta)
 *            ├─ handSeg    (cilindro da mão)
 *            └─ gripperGroup (garra + LED + luz)
 * ══════════════════════════════════════════════════════ */

// Comprimentos dos segmentos (unidades Three.js ≈ metros)
const L_UPPER = 1.8;  // braço superior (ombro → cotovelo)
const L_LOWER = 1.4;  // antebraço (cotovelo → pulso)
const L_HAND  = 0.7;  // mão (pulso → garra)

// ── Materiais ─────────────────────────────────────────
const matShoulder = new THREE.MeshStandardMaterial({ color: 0x00c8ef, emissive: 0x003344, metalness: .7, roughness: .25 });
const matElbow    = new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0x220044, metalness: .7, roughness: .25 });
const matWrist    = new THREE.MeshStandardMaterial({ color: 0x1acea0, emissive: 0x003322, metalness: .7, roughness: .25 });
const matJoint    = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: .95, roughness: .1 });
const matGripper  = new THREE.MeshStandardMaterial({ color: 0x22d3a0, emissive: 0x082e22, metalness: .6, roughness: .3 });

/** Cria um segmento cilíndrico com a origem na base */
function makeCylinder(mat, length, radius = 0.12) {
  const geo  = new THREE.CylinderGeometry(radius * .85, radius, length, 16);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = length / 2; // desloca para que y=0 seja a base
  mesh.castShadow = true;
  return mesh;
}

/** Cria uma esfera para representar uma junta */
function makeJoint(mat, r = 0.16) {
  const geo  = new THREE.SphereGeometry(r, 16, 16);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

// ── PIVOT DO OMBRO ─────────────────────────────────────
const pivotShoulder = new THREE.Group();
pivotShoulder.position.set(0, 0.18, 0); // nasce no topo da plataforma
scene.add(pivotShoulder);

const jointShoulder = makeJoint(matJoint, 0.18);
pivotShoulder.add(jointShoulder);

const upperArm = makeCylinder(matShoulder, L_UPPER, 0.13);
pivotShoulder.add(upperArm);

// ── PIVOT DO COTOVELO ──────────────────────────────────
const pivotElbow = new THREE.Group();
pivotElbow.position.y = L_UPPER; // nasce no topo do braço superior
pivotShoulder.add(pivotElbow);

const jointElbow = makeJoint(matJoint, 0.15);
pivotElbow.add(jointElbow);

const lowerArm = makeCylinder(matElbow, L_LOWER, 0.11);
pivotElbow.add(lowerArm);

// ── PIVOT DO PULSO ─────────────────────────────────────
const pivotWrist = new THREE.Group();
pivotWrist.position.y = L_LOWER; // nasce no topo do antebraço
pivotElbow.add(pivotWrist);

const jointWrist = makeJoint(matJoint, 0.12);
pivotWrist.add(jointWrist);

const handSeg = makeCylinder(matWrist, L_HAND, 0.085);
pivotWrist.add(handSeg);

// ── GARRA (EFETOR FINAL) ───────────────────────────────
const gripperGroup = new THREE.Group();
gripperGroup.position.y = L_HAND; // nasce no topo da mão
pivotWrist.add(gripperGroup);

// Corpo central da garra
const gripBody = new THREE.Mesh(new THREE.BoxGeometry(.18, .12, .18), matGripper);
gripBody.position.y = .06;
gripBody.castShadow = true;
gripperGroup.add(gripBody);

// Dois dedos da garra (esquerdo e direito)
[-1, 1].forEach(side => {
  const finger = new THREE.Mesh(new THREE.BoxGeometry(.05, .18, .05), matGripper);
  finger.position.set(side * .065, .21, 0);
  gripperGroup.add(finger);
});

// LED emissivo na ponta da garra
const ledGeo = new THREE.SphereGeometry(.045, 8, 8);
const ledMat = new THREE.MeshStandardMaterial({
  color: 0x22d3a0,
  emissive: 0x22d3a0,
  emissiveIntensity: 2
});
const led = new THREE.Mesh(ledGeo, ledMat);
led.position.y = .36;
gripperGroup.add(led);

// Ponto de luz na garra — ilumina o ambiente ao redor
const gripLight = new THREE.PointLight(0x22d3a0, .8, 3);
gripLight.position.y = .36;
gripperGroup.add(gripLight);


/* ══════════════════════════════════════════════════════
 * 6. updateArm3D()
 *
 * Aplica os ângulos do modelo lógico (BracoRobotico)
 * aos pivôs 3D (THREE.Group).
 *
 * A conversão: rotation.z = -(angulo - offset) * π/180
 * O offset de 90° alinha o "zero graus" com a vertical.
 * O sinal negativo segue a convenção de mão direita do
 * Three.js (rotação positiva = sentido anti-horário).
 * ══════════════════════════════════════════════════════ */
function updateArm3D() {
  const est = braco.estado();

  pivotShoulder.rotation.z = -(est.s - 90) * Math.PI / 180;
  pivotElbow.rotation.z    = -(est.e - 90) * Math.PI / 180;
  pivotWrist.rotation.z    = -(est.w)      * Math.PI / 180;
}


/* ══════════════════════════════════════════════════════
 * 7. ORBIT CONTROLS — câmera orbital manual
 *
 * Implementação própria (sem OrbitControls externo).
 * Usa coordenadas esféricas (theta, phi, radius):
 *   theta = ângulo horizontal (azimute)
 *   phi   = ângulo vertical   (elevação)
 *   radius = distância ao ponto focal
 * ══════════════════════════════════════════════════════ */
let isDragging = false;
let prevX = 0, prevY = 0;
let theta = 0.85, phi = 0.65, radius = 9;

/** Recalcula a posição da câmera em coordenadas cartesianas */
function updateCamera() {
  camera.position.set(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi) + 1.5,
    radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(0, 1.8, 0);
}
updateCamera();

// Drag com mouse
container.addEventListener("mousedown", e => {
  isDragging = true;
  prevX = e.clientX;
  prevY = e.clientY;
});
window.addEventListener("mouseup", () => { isDragging = false; });
window.addEventListener("mousemove", e => {
  if (!isDragging) return;
  theta += (e.clientX - prevX) * .005;
  phi    = Math.max(.15, Math.min(1.45, phi + (e.clientY - prevY) * .005));
  prevX  = e.clientX;
  prevY  = e.clientY;
  updateCamera();
});

// Zoom com scroll
container.addEventListener("wheel", e => {
  radius = Math.max(3, Math.min(18, radius + e.deltaY * .015));
  updateCamera();
  e.preventDefault();
}, { passive: false });

// Suporte a toque (mobile)
let lastTX = 0, lastTY = 0;
container.addEventListener("touchstart", e => {
  lastTX = e.touches[0].clientX;
  lastTY = e.touches[0].clientY;
});
container.addEventListener("touchmove", e => {
  theta += (e.touches[0].clientX - lastTX) * .005;
  phi    = Math.max(.15, Math.min(1.45, phi + (e.touches[0].clientY - lastTY) * .005));
  lastTX = e.touches[0].clientX;
  lastTY = e.touches[0].clientY;
  updateCamera();
  e.preventDefault();
}, { passive: false });


/* ══════════════════════════════════════════════════════
 * 8. LOOP DE RENDERIZAÇÃO
 *
 * requestAnimationFrame garante sincronismo com o
 * refresh da tela (~60fps). O clock do Three.js fornece
 * o tempo acumulado para animações contínuas (LED, luzes).
 * ══════════════════════════════════════════════════════ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Pulsação do LED da garra (função seno = suave e cíclico)
  ledMat.emissiveIntensity = 1.5 + Math.sin(t * 3) * .5;
  gripLight.intensity      = .5  + Math.sin(t * 3) * .2;

  // Orbita lenta do point light ciano para criar atmosfera dinâmica
  ptA.position.set(
    Math.cos(t * .3) * 5,
    5 + Math.sin(t * .2),
    Math.sin(t * .3) * 3
  );

  renderer.render(scene, camera);
}
animate();

// Redimensionamento responsivo
window.addEventListener("resize", () => {
  renderer.setSize(W(), H());
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
});


/* ══════════════════════════════════════════════════════
 * 9. INSTANCIAÇÃO E WIRE-UP
 * ══════════════════════════════════════════════════════ */
const braco  = new BracoRobotico();
const remoto = new ControladorRemoto(braco);

// Render inicial com os valores padrão
updateArm3D();
updateUI();


/* ══════════════════════════════════════════════════════
 * 10. FUNÇÕES DE UI
 *
 * Conectam os elementos HTML (sliders, botões, input)
 * com os métodos do BracoRobotico e ControladorRemoto.
 * ══════════════════════════════════════════════════════ */

/** Sincroniza todos os elementos visuais com o estado atual do braço */
function updateUI() {
  const e = braco.estado();

  // Atualiza as pills flutuantes sobre o canvas
  document.getElementById("pill-shoulder").textContent = e.s + "°";
  document.getElementById("pill-elbow").textContent    = e.e + "°";
  document.getElementById("pill-wrist").textContent    = e.w + "°";

  // Atualiza os labels ao lado dos sliders
  document.getElementById("lbl-s").textContent = e.s + "°";
  document.getElementById("lbl-e").textContent = e.e + "°";
  document.getElementById("lbl-w").textContent = e.w + "°";

  // Sincroniza as posições dos thumbs dos sliders
  document.getElementById("sl-s").value = e.s;
  document.getElementById("sl-e").value = e.e;
  document.getElementById("sl-w").value = e.w;
}

/** Dispara um exercício pelo nome (chamado pelos botões HTML via onclick) */
function runEx(nome) {
  braco.executarExercicio(nome);
}

/** Retorna o braço à posição de repouso */
function resetArm() {
  braco.reset();
}

/** Lê o campo de texto e envia o comando ao ControladorRemoto */
function sendCmd() {
  const inp = document.getElementById("cmd-in");
  const val = inp.value.trim();
  if (val) {
    remoto.processar(val);
    inp.value = "";
  }
}

// Permite enviar comando pressionando Enter
document.getElementById("cmd-in").addEventListener("keydown", e => {
  if (e.key === "Enter") sendCmd();
});

// Eventos dos sliders — chamam os métodos de movimento direto
document.getElementById("sl-s").addEventListener("input", function () {
  braco.moverOmbro(Number(this.value));
});
document.getElementById("sl-e").addEventListener("input", function () {
  braco.moverCotovelo(Number(this.value));
});
document.getElementById("sl-w").addEventListener("input", function () {
  braco.moverPulso(Number(this.value));
});

/* ── Sistema de Log ──────────────────────────────────── */

/**
 * Adiciona uma entrada no log do painel lateral.
 * @param {string} msg  - mensagem a exibir
 * @param {string} tipo - classe CSS: "info" | "ok" | "warn" | "err" | "remote"
 */
function log(msg, tipo = "") {
  const el  = document.getElementById("log");
  const div = document.createElement("div");
  div.className = "le " + tipo;

  const now = new Date();
  const ts  = [now.getHours(), now.getMinutes(), now.getSeconds()]
               .map(v => String(v).padStart(2, "0")).join(":");

  div.textContent = `[${ts}] ${msg}`;
  el.prepend(div); // mais recente no topo

  // Limita o log a 80 entradas para não vazar memória
  while (el.children.length > 80) el.removeChild(el.lastChild);
}

/* ── Indicador de status no footer ──────────────────── */

/**
 * Alterna o indicador de status entre IDLE e EM MOVIMENTO.
 * @param {boolean} busy
 */
function setStatus(busy) {
  document.getElementById("f-dot").className = "fi-dot" + (busy ? " busy" : "");
  document.getElementById("f-txt").textContent = busy ? "EM MOVIMENTO" : "IDLE";
}
