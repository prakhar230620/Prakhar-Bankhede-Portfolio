'use strict';

/* ═══════════════════════════════════════════════════════════════
   PRAKHAR BANKHEDE PORTFOLIO — MAIN JS
   Three.js 3D scene + physically-accurate particle simulations
═══════════════════════════════════════════════════════════════ */

const GITHUB_USERNAME = 'prakhar230620';

const TYPEWRITER_LINES = [
  'Developer.',
  'Author.',
  'Builder.',
  'AI/ML Engineer.',
];

const LANG_COLORS = {
  JavaScript: '#F0D060', Python: '#4B8BBE', TypeScript: '#5A98D8',
  HTML: '#D86030', CSS: '#7860A8', Go: '#00ADD8', Rust: '#DE8060',
  Java: '#B07219', Shell: '#89e051', default: '#6A6460',
};

/* ═══════════════════════════════════════════════════════════════
   THREE.JS SCENE
═══════════════════════════════════════════════════════════════ */
(function initThreeJS() {
  const canvas = document.getElementById('threeCanvas');
  if (!canvas || !window.THREE) return;

  /* ── CRITICAL FIX: Canvas must stay behind all page content ── */
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '-1';          // behind everything
  canvas.style.pointerEvents = 'none'; // clicks pass through

  const W = window.innerWidth, H = window.innerHeight;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  // Camera positioned for clean centered view
  const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 500);
  camera.position.set(0, 4, 42);
  camera.lookAt(0, 0, 0);

  /* ── Background wireframe decorations ── */
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xC9A96E, wireframe: true, opacity: 0.13, transparent: true });
  const wireMat2 = new THREE.MeshBasicMaterial({ color: 0x8A7050, wireframe: true, opacity: 0.08, transparent: true });

  const mkMesh = (geo, mat, px, py, pz, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(geo, mat.clone());
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, 0);
    scene.add(m);
    return m;
  };

  const ico = mkMesh(new THREE.IcosahedronGeometry(5, 1), wireMat, 14, 3, -12);
  const ico2 = mkMesh(new THREE.IcosahedronGeometry(3.5, 1), wireMat2, -14, -5, -18);
  const tor = mkMesh(new THREE.TorusGeometry(4, 0.45, 8, 32), wireMat2, -10, 9, -20, Math.PI / 4, 0);
  const oct = mkMesh(new THREE.OctahedronGeometry(3, 0), wireMat, 9, -10, -14);
  const tet = mkMesh(new THREE.TetrahedronGeometry(2, 0), wireMat2, -5, 13, -10, 0.5, 0.3);
  const box = mkMesh(new THREE.BoxGeometry(2.5, 2.5, 2.5), wireMat2, -9, -13, -12, 0.4, 0.6);

  /* ═══════════════════════════════════════════════════════════
     PARTICLE SYSTEM SETUP
  ═══════════════════════════════════════════════════════════ */
  const isMobile = window.innerWidth < 768;
  const N_PER = isMobile ? 800 : 2000;
  const NUM_SHAPES = 7;
  const N = N_PER * NUM_SHAPES;
  const SPACING_Y = 36; // Vertical distance between shapes
  const FRICTION = 0.970;
  const MR = 10;     // mouse repulsion radius
  const MF = 0.09;   // mouse repulsion force

  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const basePos = new Float32Array(N * 3);
  const spawnPos = new Float32Array(N * 3);
  const colW = new Float32Array(N); // per-particle color weight 0..1

  const rng = () => (Math.random() - 0.5) * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const PI2 = Math.PI * 2;
  const PHI = (1 + Math.sqrt(5)) / 2;

  // Axis-angle rotation helper
  const rotVec = (x, y, z, ax, ay, az, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    const L = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    ax /= L; ay /= L; az /= L;
    return [
      (t * ax * ax + c) * x + (t * ax * ay - s * az) * y + (t * ax * az + s * ay) * z,
      (t * ax * ay + s * az) * x + (t * ay * ay + c) * y + (t * ay * az - s * ax) * z,
      (t * ax * az - s * ay) * x + (t * ay * az + s * ax) * y + (t * az * az + c) * z,
    ];
  };

  /* ─────────────────────────────────────────────────────────
     SHAPE GENERATORS
  ───────────────────────────────────────────────────────── */

  // 1. SPHERE
  const makeSphere = (offsetIdx, offsetY) => {
    const R = 13;
    for (let i = 0; i < N_PER; i++) {
      const idx = offsetIdx + i;
      const theta = PI2 * i / PHI;
      const phi = Math.acos(1 - 2 * (i + 0.5) / N_PER);
      spawnPos[idx * 3] = R * Math.sin(phi) * Math.cos(theta);
      spawnPos[idx * 3 + 1] = R * Math.cos(phi) + offsetY;
      spawnPos[idx * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
      colW[idx] = 0.5 + 0.5 * Math.cos(phi);
    }
  };

  // 2. CUBE
  const makeCube = (offsetIdx, offsetY) => {
    const S = 10;
    const ptsPerFace = Math.floor(N_PER / 6);
    const gridSize = Math.floor(Math.sqrt(ptsPerFace));
    let i = 0;
    for (let face = 0; face < 6; face++) {
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          if (i >= N_PER) break;
          const idx = offsetIdx + i;
          const u = -1 + 2 * (col + 0.5) / gridSize;
          const v = -1 + 2 * (row + 0.5) / gridSize;
          switch (face) {
            case 0: spawnPos[idx * 3] = u * S; spawnPos[idx * 3 + 1] = v * S + offsetY; spawnPos[idx * 3 + 2] = S; break;
            case 1: spawnPos[idx * 3] = u * S; spawnPos[idx * 3 + 1] = v * S + offsetY; spawnPos[idx * 3 + 2] = -S; break;
            case 2: spawnPos[idx * 3] = S; spawnPos[idx * 3 + 1] = u * S + offsetY; spawnPos[idx * 3 + 2] = v * S; break;
            case 3: spawnPos[idx * 3] = -S; spawnPos[idx * 3 + 1] = u * S + offsetY; spawnPos[idx * 3 + 2] = v * S; break;
            case 4: spawnPos[idx * 3] = u * S; spawnPos[idx * 3 + 1] = S + offsetY; spawnPos[idx * 3 + 2] = v * S; break;
            case 5: spawnPos[idx * 3] = u * S; spawnPos[idx * 3 + 1] = -S + offsetY; spawnPos[idx * 3 + 2] = v * S; break;
          }
          colW[idx] = 0.5;
          i++;
        }
      }
    }
    while (i < N_PER) {
      const idx = offsetIdx + i;
      spawnPos[idx * 3] = 0; spawnPos[idx * 3 + 1] = offsetY; spawnPos[idx * 3 + 2] = S; colW[idx] = 0.5; i++;
    }
  };

  // 3. PYRAMID
  const makePyramid = (offsetIdx, offsetY) => {
    const HALF = 10, H = 14, apex = [0, H / 2, 0];
    const baseCorners = [[-HALF, -H / 2, -HALF], [HALF, -H / 2, -HALF], [HALF, -H / 2, HALF], [-HALF, -H / 2, HALF]];
    const aBase = 4 * HALF * HALF, aTri = HALF * Math.sqrt(H * H + HALF * HALF);
    const totalA = aBase + 4 * aTri, pBase = aBase / totalA;
    const nBase = Math.floor(N_PER * pBase);
    const nSide = Math.floor((N_PER - nBase) / 4);

    let idxNum = 0;
    const gB = Math.floor(Math.sqrt(nBase));
    for (let r = 0; r < gB; r++) {
      for (let c = 0; c < gB; c++) {
        if (idxNum >= nBase) break;
        const idx = offsetIdx + idxNum;
        spawnPos[idx * 3] = -HALF + 2 * HALF * (c + 0.5) / gB;
        spawnPos[idx * 3 + 1] = -H / 2 + offsetY;
        spawnPos[idx * 3 + 2] = -HALF + 2 * HALF * (r + 0.5) / gB;
        colW[idx] = 0.25; idxNum++;
      }
    }
    for (let f = 0; f < 4; f++) {
      const b0 = baseCorners[f], b1 = baseCorners[(f + 1) % 4];
      const gS = Math.floor(Math.sqrt(nSide));
      for (let r = 0; r < gS; r++) {
        for (let c = 0; c < gS; c++) {
          if (idxNum >= N_PER) break;
          const rv1 = (r + 0.5) / gS, rv2 = (c + 0.5) / gS;
          let u1 = rv1, u2 = rv2;
          if (u1 + u2 > 1) { u1 = 1 - u1; u2 = 1 - u2; }
          const la = 1 - u1 - u2, lb = u1, lc = u2;
          const idx = offsetIdx + idxNum;
          spawnPos[idx * 3] = la * apex[0] + lb * b0[0] + lc * b1[0];
          spawnPos[idx * 3 + 1] = la * apex[1] + lb * b0[1] + lc * b1[1] + offsetY;
          spawnPos[idx * 3 + 2] = la * apex[2] + lb * b0[2] + lc * b1[2];
          colW[idx] = 0.3 + 0.7 * ((spawnPos[idx * 3 + 1] - offsetY + H / 2) / H);
          idxNum++;
        }
      }
    }
    while (idxNum < N_PER) {
      const idx = offsetIdx + idxNum;
      spawnPos[idx * 3] = 0; spawnPos[idx * 3 + 1] = H / 2 + offsetY; spawnPos[idx * 3 + 2] = 0; colW[idx] = 1.0;
      idxNum++;
    }
  };

  // 4. WORMHOLE 
  const makeWormhole = (offsetIdx, offsetY) => {
    const THROAT = 3.5, HALF_H = 13, TILT_X = 0.35;
    const cosT = Math.cos(TILT_X), sinT = Math.sin(TILT_X);

    for (let i = 0; i < N_PER; i++) {
      const idx = offsetIdx + i;
      const t = (i + 0.5) / N_PER; // 0..1
      const y = (t - 0.5) * 2 * HALF_H;
      const r = Math.sqrt(THROAT * THROAT + y * y * 0.75);

      const angle = PI2 * i / PHI;
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);

      const yT = y * cosT - z * sinT;
      const zT = y * sinT + z * cosT;

      spawnPos[idx * 3] = x; spawnPos[idx * 3 + 1] = yT + offsetY; spawnPos[idx * 3 + 2] = zT;
      colW[idx] = Math.exp(-Math.abs(y) / (HALF_H * 0.4));
    }
  };

  // 5. INFINITY 
  function makeInfinity(offsetIdx, offsetY) {
    const a = 12, THICK = 0.8;
    const STEPS = 2000;
    const arcLen = new Float32Array(STEPS + 1);
    let prev = { x: a, y: 0 };
    arcLen[0] = 0;
    for (let s = 1; s <= STEPS; s++) {
      const t = (s / STEPS) * PI2;
      const denom = 1 + Math.sin(t) * Math.sin(t);
      const cx = (a * Math.cos(t)) / denom;
      const cy = (a * Math.sin(t) * Math.cos(t)) / denom;
      const dx = cx - prev.x, dy = cy - prev.y;
      arcLen[s] = arcLen[s - 1] + Math.sqrt(dx * dx + dy * dy);
      prev = { x: cx, y: cy };
    }
    const totalArc = arcLen[STEPS];

    const findT = (target) => {
      let lo = 0, hi = STEPS;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (arcLen[mid] < target) lo = mid; else hi = mid;
      }
      const frac = (target - arcLen[lo]) / (arcLen[lo + 1] - arcLen[lo] + 1e-8);
      return ((lo + frac) / STEPS) * PI2;
    };

    for (let i = 0; i < N_PER; i++) {
      const idx = offsetIdx + i;
      const t = findT((i / N_PER) * totalArc);
      const denom = 1 + Math.sin(t) * Math.sin(t);
      const lx = (a * Math.cos(t)) / denom;
      const ly = (a * Math.sin(t) * Math.cos(t)) / denom;
      const dt = 0.001;
      const d2 = 1 + Math.sin(t + dt) * Math.sin(t + dt);
      const tx2 = (a * Math.cos(t + dt)) / d2 - lx, ty2 = (a * Math.sin(t + dt) * Math.cos(t + dt)) / d2 - ly;
      const tlen = Math.sqrt(tx2 * tx2 + ty2 * ty2) + 1e-8;
      const nx = -ty2 / tlen, ny = tx2 / tlen;

      const cross = ((i * PHI) % 1) * 2 - 1;
      const zpos = (((i * Math.SQRT2) % 1) * 2 - 1) * 0.4;

      const w = cross * THICK;
      spawnPos[idx * 3] = lx + nx * w;
      spawnPos[idx * 3 + 1] = ly + ny * w + offsetY;
      spawnPos[idx * 3 + 2] = zpos;
      colW[idx] = 0.4 + 0.6 * Math.abs(Math.cos(t));
    }
  };

  // 5. GLOBE
  const makeGlobe = (offsetIdx, offsetY) => {
    const R = 13;
    let idxNum = 0;
    const nLong = 10, nLat = 8;
    const pPerLong = Math.floor((N_PER * 0.4) / nLong);
    const pPerLat = Math.floor((N_PER * 0.3) / nLat);

    for (let j = 0; j < nLong; j++) {
      const theta = (j / nLong) * Math.PI;
      for (let i = 0; i < pPerLong; i++, idxNum++) {
        const idx = offsetIdx + idxNum;
        if (idx >= offsetIdx + N_PER) break;
        const phi = (i / pPerLong) * PI2;
        spawnPos[idx * 3] = R * Math.sin(phi) * Math.cos(theta);
        spawnPos[idx * 3 + 1] = R * Math.cos(phi) + offsetY;
        spawnPos[idx * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
        colW[idx] = 0.4;
      }
    }
    for (let j = 1; j < nLat; j++) {
      const phi = (j / nLat) * Math.PI;
      const rR = R * Math.sin(phi), rY = R * Math.cos(phi);
      for (let i = 0; i < pPerLat; i++, idxNum++) {
        const idx = offsetIdx + idxNum;
        if (idx >= offsetIdx + N_PER) break;
        const theta = (i / pPerLat) * PI2;
        spawnPos[idx * 3] = rR * Math.cos(theta);
        spawnPos[idx * 3 + 1] = rY + offsetY;
        spawnPos[idx * 3 + 2] = rR * Math.sin(theta);
        colW[idx] = 0.4;
      }
    }
    const nCont = 5;
    const pPerC = Math.floor((N_PER - idxNum) / nCont);
    for (let c = 0; c < nCont; c++) {
      const sPh = Math.random() * Math.PI, sTh = Math.random() * PI2;
      for (let i = 0; i < pPerC; i++, idxNum++) {
        const idx = offsetIdx + idxNum;
        if (idx >= offsetIdx + N_PER) break;
        const phi = sPh + rng() * 0.5, theta = sTh + rng() * 0.5;
        spawnPos[idx * 3] = R * Math.sin(phi) * Math.cos(theta);
        spawnPos[idx * 3 + 1] = R * Math.cos(phi) + offsetY;
        spawnPos[idx * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
        colW[idx] = 0.8 + 0.2 * Math.random();
      }
    }
    while (idxNum < N_PER) {
      const idx = offsetIdx + idxNum;
      spawnPos[idx * 3] = 0; spawnPos[idx * 3 + 1] = offsetY; spawnPos[idx * 3 + 2] = 0;
      colW[idx] = 0; idxNum++;
    }
  };

  // 6. GALAXY
  const makeGalaxy = (offsetIdx, offsetY) => {
    const PITCH = 14 * Math.PI / 180;
    const R_MAX = 18, DISK_H = 0.6, BULGE_R = 4.5;
    const INCL = 55 * Math.PI / 180;
    const nBulge = Math.floor(N_PER * 0.25);
    const nArms = N_PER - nBulge;
    let idxNum = 0;

    for (let i = 0; i < nBulge; i++, idxNum++) {
      const idx = offsetIdx + i;
      const r = BULGE_R * Math.pow(Math.random(), 2);
      const theta = PI2 * Math.random(), phi = Math.acos(2 * Math.random() - 1);
      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.cos(phi) * 0.7;
      let z = r * Math.sin(phi) * Math.sin(theta);
      colW[idx] = 1.0;
      const cosI = Math.cos(INCL), sinI = Math.sin(INCL);
      spawnPos[idx * 3] = x; spawnPos[idx * 3 + 1] = y * cosI - z * sinI + offsetY; spawnPos[idx * 3 + 2] = y * sinI + z * cosI;
    }

    for (let i = 0; i < nArms; i++, idxNum++) {
      const idx = offsetIdx + idxNum;
      const arm = i % 2, t = Math.pow(Math.random(), 1.2);
      const r = 1.8 + (R_MAX - 1.8) * t;
      const wTheta = Math.log(r / 1.8) / Math.tan(PITCH);
      const armOff = arm * Math.PI;
      const clusterFreq = 6;
      const clusterAmp = Math.pow(Math.sin(t * Math.PI * clusterFreq), 3) > 0.5 ? 1.2 : 0.4;
      const theta = wTheta + armOff + (rng() * clusterAmp);
      let x = r * Math.cos(theta), z = r * Math.sin(theta);
      let y = rng() * DISK_H * Math.exp(-r / R_MAX) * 3;
      colW[idx] = Math.exp(-r / R_MAX) * 0.7 + (clusterAmp > 1 ? 0.3 : 0.1);
      const cosI = Math.cos(INCL), sinI = Math.sin(INCL);
      spawnPos[idx * 3] = x; spawnPos[idx * 3 + 1] = y * cosI - z * sinI + offsetY; spawnPos[idx * 3 + 2] = y * sinI + z * cosI;
    }
  };

  /* ── Shape list (7 shapes) ── */
  const shapes = [
    makeSphere, makeCube, makePyramid, makeWormhole,
    makeGlobe, makeGalaxy, makeInfinity
  ];

  /* ── Init All Shapes Vertically ── */
  const shapeAngles = new Float32Array(shapes.length);

  const shapeRot = [
    [0, 1, 0, 0.0025],      // sphere: Y spin
    [0.15, 1, 0.1, 0.0028], // cube: slight wobble
    [0, 1, 0, 0.0020],      // pyramid: Y spin
    [0, 1, 0, 0.0018],      // wormhole: slow Y spin
    [0.05, 1, 0.05, 0.002], // globe: planet spin
    [0, 1, 0, 0.0015],      // galaxy: disk normal
    [0, 0, 1, 0.0022],      // infinity: in-plane spin
  ];

  const shapePalettes = [
    [[1.0, 0.85, 0.50], [0.30, 0.40, 0.70]], // sphere: gold → blue
    [[0.90, 0.95, 1.0], [0.40, 0.50, 0.60]], // cube: white-blue → grey
    [[1.0, 0.75, 0.35], [0.50, 0.30, 0.10]], // pyramid: amber → brown
    [[0.60, 0.90, 1.0], [0.10, 0.20, 0.50]], // wormhole: cyan → deep blue
    [[1.0, 0.85, 0.50], [0.30, 0.40, 0.70]], // globe: gold → blue (sync with sphere)
    [[1.0, 0.90, 0.60], [0.25, 0.30, 0.60]], // galaxy: warm → cool blue
    [[0.80, 1.0, 0.80], [0.20, 0.50, 0.30]], // infinity: mint → dark green
  ];

  const colors = new Float32Array(N * 3);

  // Init all 7 shapes spaced out vertically
  for (let s = 0; s < shapes.length; s++) {
    const startIdx = s * N_PER;
    const offsetY = -s * SPACING_Y;

    shapes[s](startIdx, offsetY);

    // Set colors
    const [hot, cold] = shapePalettes[s];
    for (let i = 0; i < N_PER; i++) {
      const idx = startIdx + i;
      const w = Math.max(0, Math.min(1, colW[idx]));
      colors[idx * 3] = cold[0] + w * (hot[0] - cold[0]);
      colors[idx * 3 + 1] = cold[1] + w * (hot[1] - cold[1]);
      colors[idx * 3 + 2] = cold[2] + w * (hot[2] - cold[2]);

      basePos[idx * 3] = spawnPos[idx * 3];
      basePos[idx * 3 + 1] = spawnPos[idx * 3 + 1];
      basePos[idx * 3 + 2] = spawnPos[idx * 3 + 2];

      pos[idx * 3] = basePos[idx * 3] + rng() * 100;
      pos[idx * 3 + 1] = basePos[idx * 3 + 1] + rng() * 100;
      pos[idx * 3 + 2] = basePos[idx * 3 + 2] + rng() * 100;

      vel[idx * 3] = rng() * 0.03;
      vel[idx * 3 + 1] = rng() * 0.03;
      vel[idx * 3 + 2] = rng() * 0.02;
    }
  }

  // BufferGeometry
  const pGeo = new THREE.BufferGeometry();
  const pAttr = new THREE.BufferAttribute(pos, 3);
  pAttr.setUsage(THREE.DynamicDrawUsage);
  pGeo.setAttribute('position', pAttr);
  const cAttr = new THREE.BufferAttribute(colors, 3);
  pGeo.setAttribute('color', cAttr);

  const pMat = new THREE.PointsMaterial({
    size: 0.20, transparent: true, opacity: 0.75,
    sizeAttenuation: true, vertexColors: true,
  });
  const cloud = new THREE.Points(pGeo, pMat);
  scene.add(cloud);

  /* ── Mouse tracking ── */
  let mouseWorld = new THREE.Vector3();
  let mv = { x: 0, y: 0 };

  window.addEventListener('mousemove', e => {
    mv.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mv.y = (e.clientY / window.innerHeight - 0.5) * 2;
    const ndc = new THREE.Vector3(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1, 0.5
    );
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    mouseWorld = camera.position.clone().add(dir.multiplyScalar(dist));
  }, { passive: true });

  let scrollY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ── Animate & Physics Loop ── */
  let frame = 0;

  const animate = () => {
    requestAnimationFrame(animate);
    frame += 0.006;

    // Wireframe rotations
    ico.rotation.y += 0.003; ico.rotation.x += 0.001;
    ico2.rotation.y -= 0.004; ico2.rotation.x -= 0.002;
    tor.rotation.z += 0.005; tor.rotation.x += 0.002;
    oct.rotation.y += 0.006; oct.rotation.z += 0.003;
    tet.rotation.x += 0.004; tet.rotation.y += 0.005;
    box.rotation.x += 0.003; box.rotation.z += 0.004;

    // Accumulate rotation for each shape
    for (let s = 0; s < shapes.length; s++) {
      shapeAngles[s] += shapeRot[s][3];
    }

    // Particle physics
    for (let i = 0; i < N; i++) {
      const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
      const s = Math.floor(i / N_PER);
      const offsetY = -s * SPACING_Y;
      const [rAx, rAy, rAz, rSpd] = shapeRot[s];

      if (rSpd > 0) {
        // Rotate points around their local Y-center
        const localY = spawnPos[iy] - offsetY;
        const [rx, ry, rz] = rotVec(spawnPos[ix], localY, spawnPos[iz], rAx, rAy, rAz, shapeAngles[s]);
        basePos[ix] = rx;
        basePos[iy] = ry + offsetY;
        basePos[iz] = rz;
      } else {
        basePos[ix] = spawnPos[ix];
        basePos[iy] = spawnPos[iy];
        basePos[iz] = spawnPos[iz];
      }

      // Mouse repulsion
      const dx = pos[ix] - mouseWorld.x, dy = pos[iy] - mouseWorld.y, dz = pos[iz] - mouseWorld.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < MR * MR && d2 > 0.001) {
        const d = Math.sqrt(d2), f = (1 - d / MR) * MF;
        vel[ix] += dx / d * f; vel[iy] += dy / d * f; vel[iz] += dz / d * f * 0.5;
      }

      // Micro turbulence
      vel[ix] += Math.sin(pos[iy] * 0.12 + frame * 0.8) * 0.0004;
      vel[iy] += Math.cos(pos[ix] * 0.12 + frame * 0.6) * 0.0004;
      vel[iz] += Math.sin(pos[iz] * 0.10 + frame * 0.7) * 0.0003;

      // Spring to base
      const SPRING = 0.009;
      vel[ix] += (basePos[ix] - pos[ix]) * SPRING;
      vel[iy] += (basePos[iy] - pos[iy]) * SPRING;
      vel[iz] += (basePos[iz] - pos[iz]) * SPRING;

      // Damping
      vel[ix] *= FRICTION; vel[iy] *= FRICTION; vel[iz] *= FRICTION;

      // Speed cap
      const spd2 = vel[ix] * vel[ix] + vel[iy] * vel[iy] + vel[iz] * vel[iz];
      if (spd2 > 0.42) { const sc = Math.sqrt(0.42 / spd2); vel[ix] *= sc; vel[iy] *= sc; vel[iz] *= sc; }

      pos[ix] += vel[ix]; pos[iy] += vel[iy]; pos[iz] += vel[iz];
    }

    pAttr.needsUpdate = true;

    // Camera: strictly calculate scroll position every frame
    const sElem = document.documentElement || document.body;
    const currentScrollY = window.pageYOffset || sElem.scrollTop || document.body.scrollTop || 0;
    const maxScroll = Math.max(1, sElem.scrollHeight - window.innerHeight);

    // Perfectly map the total scrollable height to the total span of the 7 shapes
    const scrollFrac = Math.min(1, Math.max(0, currentScrollY / maxScroll));
    const targetCamY = 4 - scrollFrac * (shapes.length - 1) * SPACING_Y;

    camera.position.x += (mv.x * 3 - camera.position.x) * 0.028;
    // Tighter damping for camera to stick to the scroll immediately
    camera.position.y += (targetCamY - mv.y * 2 - camera.position.y) * 0.08;

    // Look straight ahead at the target grid
    camera.lookAt(camera.position.x, camera.position.y - 4, 0);

    renderer.render(scene, camera);
  };
  animate();
})();

/* ═══════════════════════════════════════════════════════════════
   CURSOR
═══════════════════════════════════════════════════════════════ */
const cursor = document.getElementById('cursor');
let cx = 0, cy = 0, tx = 0, ty = 0;
window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
(function animCursor() {
  cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
  if (cursor) cursor.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
  requestAnimationFrame(animCursor);
})();
document.querySelectorAll('a,button,[data-tilt],[tabindex]').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('c-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('c-hover'));
});

/* ═══════════════════════════════════════════════════════════════
   NAV
═══════════════════════════════════════════════════════════════ */
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const drawer = document.getElementById('navDrawer');
const btt = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  navbar.classList.toggle('scrolled', y > 60);
  if (btt) { btt.hidden = y < 300; btt.classList.toggle('show', y >= 300); }
}, { passive: true });

btt?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

hamburger.addEventListener('click', () => {
  const open = hamburger.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', open);
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', !open);
  document.body.style.overflow = open ? 'hidden' : '';
});

document.querySelectorAll('.nav__drawer-link').forEach(l => {
  l.addEventListener('click', () => {
    hamburger.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  });
});

const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav__link');
sections.forEach(s => {
  new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        document.querySelector(`.nav__link[data-section="${e.target.id}"]`)?.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -40% 0px' }).observe(s);
});

/* ═══════════════════════════════════════════════════════════════
   TYPEWRITER
═══════════════════════════════════════════════════════════════ */
const twEl = document.getElementById('typewriter');
let li = 0, ci = 0, del = false;
function type() {
  if (!twEl) return;
  const cur = TYPEWRITER_LINES[li];
  twEl.textContent = del ? cur.slice(0, --ci) : cur.slice(0, ++ci);
  if (!del && ci === cur.length) { del = true; setTimeout(type, 1600); return; }
  if (del && ci === 0) { del = false; li = (li + 1) % TYPEWRITER_LINES.length; setTimeout(type, 400); return; }
  setTimeout(type, del ? 40 : 75);
}
setTimeout(type, 800);

/* ═══════════════════════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════════════════════ */
(() => {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
})();

/* ═══════════════════════════════════════════════════════════════
   COUNTERS
═══════════════════════════════════════════════════════════════ */
const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, target = parseInt(el.dataset.target, 10);
    let v = 0; const step = target / 60;
    const t = setInterval(() => { v = Math.min(v + step, target); el.textContent = Math.floor(v) + (v >= target ? '+' : ''); if (v >= target) clearInterval(t); }, 18);
    counterObs.unobserve(el);
  });
}, { threshold: 0.6 });
document.querySelectorAll('.counter').forEach(el => counterObs.observe(el));

/* ═══════════════════════════════════════════════════════════════
   3D TILT CARDS
═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('[data-tilt]').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2, y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    card.style.transform = `perspective(700px) rotateY(${x * 5}deg) rotateX(${-y * 4}deg)`;
  });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});

/* ═══════════════════════════════════════════════════════════════
   GITHUB API
═══════════════════════════════════════════════════════════════ */
async function loadGitHub() {
  const grid = document.getElementById('githubRepos');
  if (!grid) return;

  // Specific projects to feature (order matters for display)
  const targetNames = [
    'Renasis', 'ToolMines_AI--AWS', 'RecipeReady_Mobile', 'pdfusion', 'Resonance',
    'CENTRAL-AI-16', 'vocalforge', 'ytgenius', 'int-proj', 'TouchCSS'
  ];

  const projectDescriptions = {
    'Renasis': 'AI-powered customer review analysis tool supporting Google Gemini and Groq. Built with Next.js 15 and TypeScript for sentiment analysis and actionable insights.',
    'ToolMines_AI--AWS': 'Backend integration for the ToolMines AI suite using AWS services. Features secure environment management and server-side logic for AI applications.',
    'RecipeReady_Mobile': 'Smart recipe generator that creates custom meals from available ingredients. Built with Next.js, featuring PWA support and dual-AI integration.',
    'pdfusion': 'Comprehensive PDF management tool for merging, splitting, and optimizing PDF documents. Built as a high-performance Next.js web application.',
    'Resonance': 'AI-driven audio processing and signal analysis platform for advanced sound manipulation and intelligent resonance control.',
    'CENTRAL-AI-16': 'Core module of the Central AI ecosystem, focusing on Python-based backend services and high-scale AI model orchestration.',
    'vocalforge': 'Advanced AI voice interaction platform. Features offline PWA capabilities and voice-to-text/text-to-voice using the Gemini API.',
    'ytgenius': 'Intelligent YouTube content analyzer that provides summaries and key insights from video transcripts using AI.',
    'int-proj': 'Advanced integration framework for connecting multiple AI services and streamlining data workflows for modern AI pipelines.',
    'TouchCSS': 'Key Code X — A Visual CSS development studio. Features interactive editors for shadows, filters, and animations with real-time AI-powered code explanations.'
  };

  try {
    // Fetch 100 repos to ensure we catch all featured ones from the 50+ total
    const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100&type=public`);
    if (!res.ok) throw new Error();

    const allRepos = await res.json();

    // Filter by the target list (case-insensitive)
    let repos = allRepos.filter(r =>
      targetNames.some(name => r.name.toLowerCase() === name.toLowerCase())
    );

    // Sort to match the targetNames order
    repos.sort((a, b) => {
      const idxA = targetNames.findIndex(n => n.toLowerCase() === a.name.toLowerCase());
      const idxB = targetNames.findIndex(n => n.toLowerCase() === b.name.toLowerCase());
      return idxA - idxB;
    });

    const pl = document.getElementById('githubProfileLink'), sg = document.getElementById('socialGithub');
    const url = `https://github.com/${GITHUB_USERNAME}`;
    if (pl) pl.href = url; if (sg) sg.href = url;

    grid.innerHTML = '';

    repos.forEach((repo, index) => {
      const color = LANG_COLORS[repo.language] || LANG_COLORS.default;
      const topics = (repo.topics || []).slice(0, 3).map(t => `<span class="repo-card__topic">${esc(t)}</span>`).join('');
      const card = document.createElement('a');
      card.className = 'repo-card reveal';
      card.href = repo.html_url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.setAttribute('aria-label', `${repo.name} on GitHub`);
      card.style.setProperty('--lang-color', color);

      // Find project description case-insensitively
      const customDesc = Object.entries(projectDescriptions).find(([k]) => k.toLowerCase() === repo.name.toLowerCase())?.[1];
      const description = customDesc || repo.description || 'No description available.';
      
      const displayName = repo.name.toLowerCase() === 'touchcss' ? 'Key Code X' : repo.name;
      
      card.innerHTML = `
        <div class="repo-card__name">${esc(displayName)}</div>
        <div class="repo-card__desc">${esc(description)}</div>
        <div class="repo-card__meta">
          ${repo.language ? `<span class="repo-card__lang" style="--lang-color:${color}">${esc(repo.language)}</span>` : ''}
          <span>★ ${repo.stargazers_count}</span>
        </div>
        ${topics ? `<div class="repo-card__topics">${topics}</div>` : ''}
      `;

      grid.appendChild(card);
      // Staggered reveal
      setTimeout(() => card.classList.add('revealed'), 80 * (index + 1));
    });
  } catch (err) {
    console.error('GitHub Fetch Error:', err);
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;padding:2rem;text-align:center;font-family:'JetBrains Mono',monospace;font-size:.8rem;color:var(--text-3)">Couldn't load repos. <a href="https://github.com/${GITHUB_USERNAME}" target="_blank" rel="noopener" style="color:var(--gold)">View on GitHub ↗</a></div>`;
  }
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
loadGitHub();

/* ═══════════════════════════════════════════════════════════════
   CONTACT FORM
═══════════════════════════════════════════════════════════════ */
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('formSubmit'), txt = document.getElementById('formBtnText');
    txt.textContent = 'Sending…'; btn.disabled = true;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const result = await r.json().catch(() => ({}));

      if (r.ok && result.success) {
        form.querySelectorAll('.field,#formSubmit').forEach(el => el.style.display = 'none');
        document.getElementById('formSuccess').hidden = false;
      }
      else {
        const errMsg = result.error || 'Error — Try Again';
        txt.textContent = errMsg;
        btn.disabled = false;
        console.error('Contact Form Error:', result);
      }
    } catch (err) {
      txt.textContent = 'Network Error — Try Again';
      btn.disabled = false;
      console.error('Fetch error:', err);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   SMOOTH SCROLL
═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   BOOK 3D WRAPPER
═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.book__3d').forEach(bookEl => {
  const faces = Array.from(bookEl.children);
  const wrap = document.createElement('div');
  wrap.className = 'book__3d-inner-wrap';
  faces.forEach(f => wrap.appendChild(f));
  bookEl.appendChild(wrap);
});

/* ═══════════════════════════════════════════════════════════════
   PROGRESS BAR ANIMATION
═══════════════════════════════════════════════════════════════ */
(() => {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.style.animationPlayState = 'running'; obs.unobserve(e.target); } });
  }, { threshold: 0.5 });
  document.querySelectorAll('.progress-bar__fill').forEach(f => { f.style.animationPlayState = 'paused'; obs.observe(f); });
})();

/* ═══════════════════════════════════════════════════════════════
   DESKTOP MODE TOAST
   Suggests desktop view to mobile/tablet users for better performance
═══════════════════════════════════════════════════════════════ */
(function initDesktopModeToast() {
  const toast = document.getElementById('desktop-toast');
  const closeBtn = document.getElementById('closeToast');
  if (!toast || !closeBtn) return;

  // Detection: Width < 1024px (Tablets & Phones)
  const isMobileOrTablet = window.innerWidth < 1024;
  const isDismissed = sessionStorage.getItem('desktop-toast-dismissed');

  if (isMobileOrTablet && !isDismissed) {
    // Show after a short delay for better UX
    setTimeout(() => {
      toast.hidden = false;
      // Trigger CSS transition
      requestAnimationFrame(() => {
        toast.classList.add('toast--show');
      });
    }, 2000);
  }

  closeBtn.addEventListener('click', () => {
    toast.classList.remove('toast--show');
    sessionStorage.setItem('desktop-toast-dismissed', 'true');
    // Hide completely after transition
    setTimeout(() => {
      toast.hidden = true;
    }, 600);
  });
})();

/* ═══════════════════════════════════════════════════════════════
   BOOK READER LOGIC
   Uses PDF.js to render pages + PageFlip for realistic 3D curves
═══════════════════════════════════════════════════════════════ */
const BookReader = (() => {
  let pdf = null;
  let pageFlip = null;
  let totalPages = 0;
  
  const getEl = (id) => document.getElementById(id);

  function showReader() {
    const reader = getEl('book-reader');
    reader.removeAttribute('hidden');
    reader.offsetHeight;
    reader.style.opacity = '1';
    reader.style.pointerEvents = 'auto'; // 'auto' is correct for HTML
    document.body.style.overflow = 'hidden';
  }

  function hideReader() {
    const reader = getEl('book-reader');
    reader.style.opacity = '0';
    reader.style.pointerEvents = 'none';
    setTimeout(() => {
      reader.setAttribute('hidden', '');
      reader.style.opacity = '';
      reader.style.pointerEvents = '';
    }, 500);
    document.body.style.overflow = '';
  }

  async function loadPDF(url) {
    if (pdf) return true;
    try {
      getEl('read-book').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8A8378;font-family:JetBrains Mono,monospace;font-size:0.85rem;gap:1rem"><div class="reader-loader"></div> Loading book…</div>';
      const task = pdfjsLib.getDocument({ url, cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/', cMapPacked: true });
      pdf = await task.promise;
      totalPages = pdf.numPages;
      getEl('totalPagesNum').textContent = totalPages;
      return true;
    } catch (err) {
      console.error('PDF Load Error:', err);
      getEl('read-book').innerHTML = '<div style="color:#C9A96E;padding:2rem;text-align:center">⚠️ Could not load book. Please check the file path.</div>';
      return false;
    }
  }

  async function renderAllPagesToBook() {
    const bookEl = getEl('read-book');
    bookEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#c9a96e;"><div class="reader-loader" style="margin-right:10px"></div> Setting up pages...</div>';
    
    // We get the first page to determine native page aspect ratio
    const samplePage = await pdf.getPage(1);
    const viewport = samplePage.getViewport({ scale: 1 });
    const ratio = viewport.width / viewport.height;
    
    // Determine canvas dimensions based on screen limits
    const isMobile = window.innerWidth < 900;
    const availH = window.innerHeight * (isMobile ? 0.65 : 0.72);
    const availW = (window.innerWidth * 0.9) / (isMobile ? 1 : 2);
    
    let renderH = availH;
    let renderW = renderH * ratio;
    if (renderW > availW) {
      renderW = availW;
      renderH = renderW / ratio;
    }
    
    // Create the page flip instance
    if (pageFlip) {
      pageFlip.destroy();
    }
    
    bookEl.innerHTML = ''; // clear loading text explicitly before initializing

    pageFlip = new St.PageFlip(bookEl, {
      width: Math.floor(renderW),       // Base page width
      height: Math.floor(renderH),      // Base page height
      size: "fixed",                    // FIXED prevents asymmetric shattering/floating layouts
      autoCenter: true,                 // Ensures the book anchors solidly and stops drifting
      drawShadow: true,                 // Ensures standard book shadows render over pages
      maxShadowOpacity: 0.5,            // Realistic book shadow
      showCover: true,
      mobileScrollSupport: false,
      usePortrait: isMobile             // Single page mode on mobile
    });

    // Create empty wrappers for all pages
    const pageNodes = [];
    for(let i = 1; i <= totalPages; i++) {
        const div = document.createElement('div');
        div.className = 'page page-wrapper';
        div.dataset.page = i;
        div.style.backgroundColor = '#fff';
        
        // Add a canvas inside that will lazily load
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.dataset.loaded = 'false';
        
        div.appendChild(canvas);
        pageNodes.push(div);
    }
    
    pageNodes.forEach(node => bookEl.appendChild(node));
    
    // Load pages into PageFlip engine
    pageFlip.loadFromHTML(document.querySelectorAll('.page-wrapper'));

    // Bind page flip event to update UI & trigger lazy render
    pageFlip.on('flip', (e) => {
        let current = e.data + 1; // e.data is 0-indexed page number
        getEl('currentPageNum').textContent = current;
        getEl('prevPage').disabled = current <= 1;
        getEl('nextPage').disabled = current >= totalPages;
        
        // Lazy load the current page and adjacent pages to ensure high quality rendering
        renderLazy(current - 1);
        renderLazy(current);
        renderLazy(current + 1);
        renderLazy(current + 2);
        if(!isMobile) {
            renderLazy(current + 3);
            renderLazy(current + 4);
        }
    });

    // Helper to render pages on demand
    const renderLazy = async (pageNum) => {
        if (pageNum < 1 || pageNum > totalPages) return; // out of bounds
        const pageNode = document.querySelector(`.page-wrapper[data-page="${pageNum}"] canvas`);
        if (!pageNode || pageNode.dataset.loaded === 'true') return;
        
        pageNode.dataset.loaded = 'true'; // mark rendering to avoid dupes
        
        const page = await pdf.getPage(pageNum);
        // We render at 2x scale for sharp high-DPI
        const vp = page.getViewport({ scale: Math.min(window.devicePixelRatio, 2.5) * 1.5 }); 
        pageNode.width = vp.width;
        pageNode.height = vp.height;
        const ctx = pageNode.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
    };

    // Trigger initial renders (cover, page 2, page 3)
    renderLazy(1);
    renderLazy(2);
    renderLazy(3);
    
    // Setup initial UI
    getEl('currentPageNum').textContent = 1;
    getEl('prevPage').disabled = true;
    getEl('nextPage').disabled = totalPages <= 1;
  }

  return {
    async open(url) {
      showReader();
      const ok = await loadPDF(url);
      if (!ok) return;
      await renderAllPagesToBook();
    },
    close: hideReader,
    next() { if(pageFlip) pageFlip.flipNext(); },
    prev() { if(pageFlip) pageFlip.flipPrev(); }
  };
})();

// ── Wire up all Reader buttons ────────────────────────────────
document.getElementById('openReaderBtn')?.addEventListener('click', () => {
  BookReader.open('assets/Books/The Dark Innovation Omnix Chapter-1.pdf');
});
document.getElementById('closeReader')?.addEventListener('click', () => BookReader.close());
document.getElementById('nextPage')?.addEventListener('click', () => BookReader.next());
document.getElementById('prevPage')?.addEventListener('click', () => BookReader.prev());