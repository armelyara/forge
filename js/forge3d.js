// Forge 3D engine — real, manipulable three.js specimens (à la Tashrih).
//  <structure-3d>  rotatable specimen with floating labels + layer-peel (type="rcbeam")
//  <beam-lab>      drag the load along a 3D beam; deflection + moment diagram respond live
// three loaded from esm.sh (bare-specifier safe, no import map).
(() => {
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
  const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm';
  let libP = null;
  const lib = () => (libP ||= (async () => {
    const THREE = await import(THREE_URL);
    const { OrbitControls } = await import(ORBIT_URL);
    return { THREE, OrbitControls };
  })());

  // ---------- shared helpers ----------
  const V = (THREE, a) => new THREE.Vector3(a[0], a[1], a[2]);
  function strut(THREE, group, mat, a, b, r = 0.09, layer) {
    const va = V(THREE, a), vb = V(THREE, b), dir = new THREE.Vector3().subVectors(vb, va);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 14), mat);
    m.position.copy(va).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    if (layer !== undefined) m.userData.layer = layer;
    group.add(m); return m;
  }
  function node(THREE, group, mat, p, r = 0.16, layer) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 20), mat);
    m.position.set(...p); if (layer !== undefined) m.userData.layer = layer; group.add(m); return m;
  }
  function studio(THREE, scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2f36, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(6, 10, 7); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 60;
    key.shadow.camera.left = -14; key.shadow.camera.right = 14; key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
    key.shadow.bias = -0.0004; scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4); fill.position.set(-7, 4, -6); scene.add(fill);
  }
  function contactShadow(THREE, scene, group) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.22 }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
    const b = new THREE.Box3().setFromObject(group);
    g.position.y = b.min.y - 0.02; scene.add(g); return g;
  }

  // ---------- specimen builders ----------
  const builders = {
    truss(THREE, group, m) {
      const zs = [-1.4, 1.4], bottom = [-6, -3, 0, 3, 6], top = [-4.5, -1.5, 1.5, 4.5], yb = 0, yt = 2.3;
      zs.forEach(z => {
        for (let i = 0; i < bottom.length - 1; i++) strut(THREE, group, m.member, [bottom[i], yb, z], [bottom[i + 1], yb, z]);
        for (let i = 0; i < top.length - 1; i++) strut(THREE, group, m.member, [top[i], yt, z], [top[i + 1], yt, z]);
        const seq = [[bottom[0], top[0]], [top[0], bottom[1]], [bottom[1], top[1]], [top[1], bottom[2]], [bottom[2], top[2]], [top[2], bottom[3]], [bottom[3], top[3]], [top[3], bottom[4]]];
        seq.forEach(([lo, hi], i) => { const A = (i % 2 === 0); strut(THREE, group, m.member, [lo, A ? yb : yt, z], [hi, A ? yt : yb, z]); });
        top.forEach(x => node(THREE, group, m.node, [x, yt, z])); bottom.forEach(x => node(THREE, group, m.node, [x, yb, z]));
      });
      bottom.forEach(x => strut(THREE, group, m.member, [x, yb, zs[0]], [x, yb, zs[1]], 0.07));
      top.forEach(x => strut(THREE, group, m.member, [x, yt, zs[0]], [x, yt, zs[1]], 0.07));
      const deck = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.18, 2.8), m.node); deck.position.set(0, 0.12, 0); group.add(deck);
    },
    ibeam(THREE, group, m) {
      const L = 9, bf = 1.6, tf = 0.24, hw = 0.26, D = 2.0;
      const ft = new THREE.Mesh(new THREE.BoxGeometry(L, tf, bf), m.member); ft.position.y = D / 2; group.add(ft);
      const fb = new THREE.Mesh(new THREE.BoxGeometry(L, tf, bf), m.member); fb.position.y = -D / 2; group.add(fb);
      group.add(new THREE.Mesh(new THREE.BoxGeometry(L, D - tf, hw), m.member));
      [-L / 2 + 0.6, L / 2 - 0.6].forEach(x => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, bf + 0.2), m.node); s.position.set(x, -D / 2 - 0.7, 0); group.add(s); });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.8, 12), m.accent); shaft.position.set(0, D / 2 + 1.4, 0); group.add(shaft);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 18), m.accent); head.position.set(0, D / 2 + 0.45, 0); group.add(head);
    },
    // reinforced-concrete beam that opens layer by layer
    rcbeam(THREE, group, m) {
      const L = 8, w = 1.6, h = 2.2;
      // 0 — solid concrete beam + load
      const conc = new THREE.Mesh(new THREE.BoxGeometry(L, h, w),
        new THREE.MeshStandardMaterial({ color: m.member.color.clone(), roughness: 0.85, metalness: 0.05, transparent: true, opacity: 1 }));
      conc.userData.layer = 0; conc.userData.concrete = true; group.add(conc);
      [-L / 2 + 0.4, L / 2 - 0.4].forEach(x => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, w + 0.25), m.node); s.position.set(x, -h / 2 - 0.4, 0); s.userData.layer = 0; group.add(s); });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 12), m.accent); shaft.position.set(0, h / 2 + 1.3, 0); shaft.userData.layer = 0; group.add(shaft);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 16), m.accent); head.position.set(0, h / 2 + 0.42, 0); head.userData.layer = 0; group.add(head);
      // 1 — efforts: neutral axis + compression/tension
      const na = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, w + 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff })); na.userData.layer = 1; group.add(na);
      const comp = new THREE.Mesh(new THREE.BoxGeometry(L * 0.7, 0.5, 0.02),
        new THREE.MeshStandardMaterial({ color: m.accent.color.clone(), transparent: true, opacity: 0.5 })); comp.position.set(0, h / 4, w / 2 + 0.02); comp.userData.layer = 1; group.add(comp);
      const tens = new THREE.Mesh(new THREE.BoxGeometry(L * 0.7, 0.5, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x3f9fb2, transparent: true, opacity: 0.5 })); tens.position.set(0, -h / 4, w / 2 + 0.02); tens.userData.layer = 1; group.add(tens);
      // 2 — section slab (a cut plane)
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.12, h + 0.02, w + 0.02),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, transparent: true, opacity: 0.85 })); slab.userData.layer = 2; group.add(slab);
      // 3 — reinforcement: longitudinal bars + stirrups
      const barMat = m.accent, stirMat = new THREE.MeshStandardMaterial({ color: 0x8fd0dc, metalness: 0.6, roughness: 0.35 });
      const bx = w / 2 - 0.28, by = h / 2 - 0.28;
      [[-bx, -by], [bx, -by], [-bx, -by + 0.44], [bx, -by + 0.44]].forEach(([z, y]) =>
        strut(THREE, group, barMat, [-L / 2 + 0.3, y, z], [L / 2 - 0.3, y, z], 0.07, 3));
      [[-bx, by], [bx, by]].forEach(([z, y]) => strut(THREE, group, barMat, [-L / 2 + 0.3, y, z], [L / 2 - 0.3, y, z], 0.05, 3));
      for (let x = -L / 2 + 0.6; x <= L / 2 - 0.6; x += 1.0) {
        strut(THREE, group, stirMat, [x, by, -bx], [x, by, bx], 0.035, 3);
        strut(THREE, group, stirMat, [x, -by, -bx], [x, -by, bx], 0.035, 3);
        strut(THREE, group, stirMat, [x, -by, -bx], [x, by, -bx], 0.035, 3);
        strut(THREE, group, stirMat, [x, -by, bx], [x, by, bx], 0.035, 3);
      }
    }
  };

  // ================= <structure-3d> =================
  class Structure3D extends HTMLElement {
    static get observedAttributes() { return ['active-layer', 'autorotate']; }
    connectedCallback() { this.style.display = 'block'; this.style.position = 'relative'; this._init(); }
    disconnectedCallback() { this._alive = false; if (this._ro) this._ro.disconnect(); if (this._renderer) this._renderer.dispose(); }
    attributeChangedCallback(n) { if (n === 'active-layer') this._applyLayers?.(); if (n === 'autorotate' && this._controls) this._controls.autoRotate = this.getAttribute('autorotate') !== '0'; }

    async _init() {
      this._alive = true;
      const { THREE, OrbitControls } = await lib(); if (!this._alive) return;
      const col = c => new THREE.Color(c);
      const metal = this.getAttribute('metal') !== '0';
      const mk = (c, met) => new THREE.MeshStandardMaterial({ color: col(c), metalness: met ? 0.85 : 0.12, roughness: met ? 0.35 : 0.8 });
      const m = {
        member: mk(this.getAttribute('member') || '#c9ccd4', metal),
        node: mk(this.getAttribute('node') || this.getAttribute('member') || '#9aa3ad', metal),
        accent: new THREE.MeshStandardMaterial({ color: col(this.getAttribute('accent') || '#d3702f'), metalness: 0.3, roughness: 0.4, emissive: col(this.getAttribute('accent') || '#d3702f'), emissiveIntensity: 0.22 })
      };

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
      this.appendChild(renderer.domElement); this._renderer = renderer;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
      studio(THREE, scene);

      const group = new THREE.Group();
      (builders[this.getAttribute('type')] || builders.truss)(THREE, group, m);
      group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(group);
      const ground = contactShadow(THREE, scene, group);

      const box = new THREE.Box3().setFromObject(group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z);
      group.position.sub(center); ground.position.y -= center.y;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
      controls.minDistance = radius * 0.7; controls.maxDistance = radius * 4;
      controls.autoRotate = this.getAttribute('autorotate') !== '0'; controls.autoRotateSpeed = 0.85;
      camera.position.set(radius * 0.95, radius * 0.62, radius * 1.3);
      this._controls = controls;

      // layer peel
      this._applyLayers = () => {
        const al = parseInt(this.getAttribute('active-layer') ?? '99', 10);
        group.traverse(o => {
          if (o.userData && o.userData.layer !== undefined) {
            const on = o.userData.layer <= al; o.visible = on;
            if (o.material && o.userData.concrete) { o.material.transparent = true; o.material.opacity = al >= 1 ? 0.22 : 1; }
          }
        });
      };
      this._applyLayers();

      // floating labels (Tashrih-style)
      const labels = (() => { try { return JSON.parse(this.getAttribute('labels') || '[]'); } catch { return []; } })();
      const labelEls = labels.map(L => {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;transform:translate(-50%,-120%);pointer-events:none;z-index:3;white-space:nowrap;font-family:"IBM Plex Mono",monospace;transition:opacity .2s;';
        el.innerHTML = `<span style="display:block;font-size:11px;font-weight:500;color:#eef2f4;letter-spacing:.02em;">${L.t}</span>` +
          (L.s ? `<span style="display:block;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:#9fb0b9;margin-top:1px;">${L.s}</span>` : '') +
          `<span style="display:block;width:1px;height:14px;margin:3px auto 0;background:#d3702f;"></span>`;
        this.appendChild(el); return { el, p: new THREE.Vector3(...L.p) };
      });

      const resize = () => { const w = this.clientWidth || 1, h = this.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      this._ro = new ResizeObserver(resize); this._ro.observe(this); resize();

      const tmp = new THREE.Vector3();
      const loop = () => {
        if (!this._alive) return; requestAnimationFrame(loop);
        controls.update();
        renderer.render(scene, camera);
        if (labelEls.length) {
          const w = this.clientWidth, h = this.clientHeight;
          labelEls.forEach(({ el, p }) => {
            tmp.copy(p).add(group.position).project(camera);
            const behind = tmp.z > 1;
            el.style.opacity = behind ? '0' : '0.96';
            el.style.left = ((tmp.x * 0.5 + 0.5) * w) + 'px';
            el.style.top = ((-tmp.y * 0.5 + 0.5) * h) + 'px';
          });
        }
      };
      loop();
    }
  }
  if (!customElements.get('structure-3d')) customElements.define('structure-3d', Structure3D);

  // ================= <beam-lab> =================
  class BeamLab extends HTMLElement {
    connectedCallback() { this.style.display = 'block'; this.style.position = 'relative'; this.style.touchAction = 'none'; this._init(); }
    disconnectedCallback() { this._alive = false; if (this._ro) this._ro.disconnect(); if (this._renderer) this._renderer.dispose(); }

    async _init() {
      this._alive = true;
      const { THREE, OrbitControls } = await lib(); if (!this._alive) return;
      const col = c => new THREE.Color(c);
      const cMember = this.getAttribute('member') || '#aebdc6';
      const cAccent = this.getAttribute('accent') || '#d3702f';
      const cNode = this.getAttribute('node') || '#6f8290';

      const L = 6, worldL = 9, N = 60;
      const wx = xl => (xl / L - 0.5) * worldL;
      const state = { P: 24, a: 3.0 };

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
      this.appendChild(renderer.domElement); this._renderer = renderer;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
      camera.position.set(3.5, 3.2, 12); studio(THREE, scene);

      const matBeam = new THREE.MeshStandardMaterial({ color: col(cMember), metalness: 0.82, roughness: 0.36 });
      const matNode = new THREE.MeshStandardMaterial({ color: col(cNode), metalness: 0.7, roughness: 0.4 });
      const matAccent = new THREE.MeshStandardMaterial({ color: col(cAccent), metalness: 0.3, roughness: 0.4, emissive: col(cAccent), emissiveIntensity: 0.25 });

      const group = new THREE.Group(); scene.add(group);

      // deflectable beam = row of short segments
      const segW = worldL / N + 0.02, segs = [];
      const segGeo = new THREE.BoxGeometry(segW, 0.55, 1.05);
      for (let i = 0; i < N; i++) { const s = new THREE.Mesh(segGeo, matBeam); s.castShadow = true; s.receiveShadow = true; group.add(s); segs.push(s); }
      // supports
      [-worldL / 2, worldL / 2].forEach(x => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 1.4), matNode); s.position.set(x, -1.15, 0); s.castShadow = true; group.add(s); });
      // load handle (draggable)
      const handle = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.7, 14), matAccent); shaft.position.y = 1.25;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.62, 18), matAccent); head.position.y = 0.42;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 12, 28), matAccent); ring.rotation.y = Math.PI / 2;
      const grab = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
      handle.add(shaft, head, ring, grab); handle.castShadow = true; group.add(handle);
      // moment ribbon
      const ribCount = N;
      const ribGeo = new THREE.BufferGeometry();
      const ribPos = new Float32Array(ribCount * 2 * 3), ribIdx = [];
      for (let i = 0; i < ribCount - 1; i++) { const a = i * 2; ribIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      ribGeo.setIndex(ribIdx); ribGeo.setAttribute('position', new THREE.BufferAttribute(ribPos, 3));
      const ribbon = new THREE.Mesh(ribGeo, new THREE.MeshStandardMaterial({ color: col('#3f9fb2'), transparent: true, opacity: 0.55, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.7 }));
      group.add(ribbon);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.2 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -1.75; ground.receiveShadow = true; scene.add(ground);

      const vScale = 0.010, mScale = 0.024, ribZ = -0.75, ribBase = -0.9;
      const defl = (x, P, a) => { const b = L - a; if (x <= a) return P * b * x * (L * L - b * b - x * x) / (6 * L); const xx = L - x, aa = a; return P * a * xx * (L * L - a * a - xx * xx) / (6 * L); };

      function update() {
        const { P, a } = state, b = L - a, R1 = P * b / L, R2 = P * a / L;
        let peak = 0;
        // beam segments follow deflected centreline
        for (let i = 0; i < N; i++) {
          const xl = (i + 0.5) / N * L, x0 = wx(xl);
          const y = -Math.min(1.15, defl(xl, P, a) * vScale);
          const yPrev = -Math.min(1.15, defl(Math.max(0, xl - L / N), P, a) * vScale);
          segs[i].position.set(x0, y, 0);
          segs[i].rotation.z = Math.atan2(y - yPrev, worldL / N);
        }
        // handle
        const hy = -Math.min(1.15, defl(a, P, a) * vScale);
        handle.position.set(wx(a), hy, 0);
        const sc = 0.7 + P / 40; handle.scale.set(1, 0.7 + P / 55, 1);
        // moment ribbon (triangle peaking under load)
        const pos = ribbon.geometry.attributes.position.array;
        for (let i = 0; i < ribCount; i++) {
          const xl = i / (ribCount - 1) * L, x0 = wx(xl);
          const M = xl <= a ? R1 * xl : R2 * (L - xl); peak = Math.max(peak, M);
          const yv = ribBase - Math.min(1.6, M * mScale);
          pos[i * 6 + 0] = x0; pos[i * 6 + 1] = ribBase; pos[i * 6 + 2] = ribZ;
          pos[i * 6 + 3] = x0; pos[i * 6 + 4] = yv; pos[i * 6 + 5] = ribZ;
        }
        ribbon.geometry.attributes.position.needsUpdate = true; ribbon.geometry.computeVertexNormals();
        const Mmax = P * a * b / L;
        read.innerHTML = row('Réaction A', R1.toFixed(1), 'kN') + row('Réaction B', R2.toFixed(1), 'kN') +
          row('Moment max', Mmax.toFixed(1), 'kN·m', cAccent) + row('Charge · position', P + ' kN · ' + a.toFixed(1) + ' m', '');
        pv.textContent = P + ' kN';
      }
      const row = (k, v, u, c) => `<div style="display:flex;justify-content:space-between;gap:14px;padding:5px 0;"><span style="color:#9fb0b9;">${k}</span><span style="color:${c || '#eef2f4'};">${v}<span style="color:#6f828c;"> ${u}</span></span></div>`;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
      controls.minDistance = 7; controls.maxDistance = 20; controls.target.set(0, -0.4, 0);
      controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.9;

      // drag the load
      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
      let dragging = false;
      const setNDC = e => { const r = this.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
      this.addEventListener('pointerdown', e => {
        setNDC(e); ray.setFromCamera(ndc, camera);
        if (ray.intersectObject(grab, true).length) { dragging = true; controls.enabled = false; this.setPointerCapture(e.pointerId); this.style.cursor = 'grabbing'; }
      });
      this.addEventListener('pointermove', e => {
        setNDC(e); ray.setFromCamera(ndc, camera);
        if (dragging) { if (ray.ray.intersectPlane(plane, hit)) { const xl = (hit.x / worldL + 0.5) * L; state.a = Math.max(0.4, Math.min(L - 0.4, xl)); update(); } }
        else { this.style.cursor = ray.intersectObject(grab, true).length ? 'grab' : 'default'; }
      });
      const end = e => { if (dragging) { dragging = false; controls.enabled = true; this.style.cursor = 'grab'; try { this.releasePointerCapture(e.pointerId); } catch { } } };
      this.addEventListener('pointerup', end); this.addEventListener('pointercancel', end);

      // overlays
      const read = document.createElement('div');
      read.style.cssText = 'position:absolute;top:14px;left:16px;z-index:3;pointer-events:none;font-family:"IBM Plex Mono",monospace;font-size:12px;min-width:210px;';
      this.appendChild(read);
      const hint = document.createElement('div');
      hint.textContent = '↔ glissez la charge · faites pivoter la scène';
      hint.style.cssText = 'position:absolute;top:14px;right:16px;z-index:3;pointer-events:none;font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6f828c;';
      this.appendChild(hint);
      const bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;bottom:14px;left:16px;right:16px;z-index:3;display:flex;align-items:center;gap:12px;font-family:"IBM Plex Mono",monospace;font-size:11px;color:#9fb0b9;';
      const pv = document.createElement('span'); pv.style.cssText = 'color:#d3702f;min-width:56px;';
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '5'; slider.max = '40'; slider.step = '1'; slider.value = '24';
      slider.style.cssText = 'flex:1;accent-color:#d3702f;cursor:pointer;'; slider.addEventListener('input', () => { state.P = +slider.value; update(); });
      const lbl = document.createElement('span'); lbl.textContent = 'INTENSITÉ'; lbl.style.letterSpacing = '.08em';
      bar.append(lbl, slider, pv); this.appendChild(bar);

      const resize = () => { const w = this.clientWidth || 1, h = this.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      this._ro = new ResizeObserver(resize); this._ro.observe(this); resize(); update();
      const loop = () => { if (!this._alive) return; requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
      loop();
    }
  }
  if (!customElements.get('beam-lab')) customElements.define('beam-lab', BeamLab);
})();
