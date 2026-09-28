import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { ethers } from 'ethers';
import './styles.css';
import burnWorld from './assets/burn-world.jfif';
import tweet2 from './assets/tweet2.jfif';

const CRONOS = {
  chainId: '0x19',
  chainName: 'Cronos Mainnet',
  nativeCurrency: { name: 'Cronos', symbol: 'CRO', decimals: 18 },
  rpcUrls: ['https://evm.cronos.org'],
  blockExplorerUrls: ['https://cronoscan.com']
};

const TOKEN_ADDRESS = '0xad4db17e25fc62c43470c084cae5f239aa2f8bfa';
const BUY_URL = 'https://launch.cronos.com/token/0xad4db17e25fc62c43470c084cae5f239aa2f8bfa';

const hotspots = {
  // Screen positions match the actual artwork: bag/barrel, falling coins, and pot/fire.
  bag: { label: 'THE BAG', sub: 'THE MISSION', x: 0.56, y: 0.18, target: [0.46, 2.75, 6.0] },
  fire: { label: 'THE FIRE', sub: 'THE FORGE', x: 0.48, y: 0.84, target: [-0.15, -3.10, 5.4] },
  loot: { label: 'THE LOOT', sub: 'THE TREASURE', x: 0.34, y: 0.52, target: [-1.20, -0.20, 5.6] }
};

function App() {
  const mountRef = useRef(null);
  const [focus, setFocus] = useState(null);
  const [wallet, setWallet] = useState('');
  const [burnPulse, setBurnPulse] = useState(false);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const worldRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x071008, 0.028);

    const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 0, 11.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);
    worldRef.current = world;

    const loader = new THREE.TextureLoader();
    const texture = loader.load(burnWorld);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // A subtle 2.5D relief: the original artwork remains the hero, while the plane has
    // depth and the camera can travel through it instead of behaving like a flat image.
    const aspect = 1163 / 1352;
    const planeH = 9.4;
    const planeW = planeH * aspect;
    const geo = new THREE.PlaneGeometry(planeW, planeH, 140, 160);

    const vertex = `
      uniform float uTime;
      uniform float uDepth;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        float center = 1.0 - distance(uv, vec2(0.5));
        float lower = smoothstep(0.95, 0.0, uv.y);
        p.z += (center * 0.18 + lower * 0.10) * uDepth;
        p.x += sin(uv.y * 5.0 + uTime * 0.18) * 0.008 * uDepth;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }
    `;
    const fragment = `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      void main(){
        vec4 c = texture2D(uMap, vUv);
        float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0-vUv.x);
        float warm = smoothstep(0.68, 0.95, 1.0-vUv.y);
        c.rgb *= 0.93 + 0.07 * edge;
        c.rgb += vec3(0.025,0.012,0.0) * warm;
        gl_FragColor = c;
      }
    `;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture }, uTime: { value: 0 }, uDepth: { value: 1 } },
      vertexShader: vertex,
      fragmentShader: fragment
    });
    const backdrop = new THREE.Mesh(geo, mat);
    backdrop.position.set(0, 0.05, -0.65);
    world.add(backdrop);

    // The side/top/bottom filler is the same artwork, enlarged and softened.
    // This keeps the world immersive on wide screens instead of exposing flat empty space.
    const bgGeo = new THREE.PlaneGeometry(30, 22);
    const bgVertex = `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `;
    const bgFragment = `
      uniform sampler2D uMap;
      varying vec2 vUv;
      vec2 coverUv(vec2 uv){
        float target = 30.0 / 22.0;
        float source = 1163.0 / 1352.0;
        vec2 scale = source > target ? vec2(target / source, 1.0) : vec2(1.0, source / target);
        return (uv - 0.5) * scale + 0.5;
      }
      void main(){
        vec2 uv = coverUv(vUv);
        vec2 px = vec2(0.0065, 0.0065);
        vec4 c = vec4(0.0);
        c += texture2D(uMap, uv - px * 2.0) * 0.08;
        c += texture2D(uMap, uv - px) * 0.14;
        c += texture2D(uMap, uv) * 0.24;
        c += texture2D(uMap, uv + px) * 0.14;
        c += texture2D(uMap, uv + px * 2.0) * 0.08;
        c.rgb *= vec3(0.16,0.21,0.14);
        c.rgb += vec3(0.008,0.006,0.002);
        c.a = 1.0;
        gl_FragColor = c;
      }
    `;
    const bgMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture } },
      vertexShader: bgVertex,
      fragmentShader: bgFragment,
      depthWrite: false
    });
    const shell = new THREE.Mesh(bgGeo, bgMat);
    shell.position.z = -1.9;
    world.add(shell);

    // 3D coins: these are deliberately sparse so the original composition stays dominant.
    const coinGroup = new THREE.Group();
    world.add(coinGroup);
    const coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.045, 20);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0x1c4da7, metalness: 0.65, roughness: 0.28, emissive: 0x061a45, emissiveIntensity: 0.35 });
    for (let i = 0; i < 42; i++) {
      const c = new THREE.Mesh(coinGeo, coinMat.clone());
      const t = Math.random();
      c.position.set(-1.45 + Math.sin(i * 1.7) * 0.9 + t * 1.2, -1.2 + t * 3.0, 0.25 + Math.random() * 1.1);
      c.rotation.set(Math.random() * 2, Math.random() * Math.PI, Math.random() * 2);
      c.scale.setScalar(0.55 + Math.random() * 0.75);
      c.userData.phase = Math.random() * 6.28;
      coinGroup.add(c);
    }

    // Fire + ember particles in actual 3D space.
    const emberCount = 420;
    const positions = new Float32Array(emberCount * 3);
    const sizes = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.05;
      positions[i*3] = -0.15 + Math.cos(a) * r;
      positions[i*3+1] = -3.65 + Math.random() * 3.4;
      positions[i*3+2] = 0.2 + Math.random() * 1.6;
      sizes[i] = 1.5 + Math.random() * 4;
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    emberGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const emberMat = new THREE.PointsMaterial({ color: 0xffb22e, size: 0.045, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const embers = new THREE.Points(emberGeo, emberMat);
    world.add(embers);

    const ambient = new THREE.AmbientLight(0x6c8b62, 1.8);
    scene.add(ambient);
    const fireLight = new THREE.PointLight(0xff8b24, 4.5, 9);
    fireLight.position.set(-0.15, -3.05, 2.2);
    world.add(fireLight);
    const warmLight = new THREE.PointLight(0xffc85a, 1.1, 5);
    warmLight.position.set(1.2, -0.5, 1.4);
    world.add(warmLight);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const cameraHome = new THREE.Vector3(0, 0, 11.4);
    const cameraTarget = new THREE.Vector3(0, 0, 11.4);
    let targetLook = new THREE.Vector3(0, 0, -1);
    let time = 0;

    function onPointerMove(e) {
      pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
    }
    function onResize() {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    }
    function onWheel(e) {
      e.preventDefault();
      const amount = Math.sign(e.deltaY);
      cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z + amount * 0.42, 5.0, 11.4);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('resize', onResize);
    window.addEventListener('wheel', onWheel, { passive: false });

    function focusZone(zone) {
      const t = hotspots[zone];
      if (!t) return;
      setFocus(zone);
      cameraTarget.set(t.target[0], t.target[1], t.target[2]);
      targetLook.set(t.target[0], t.target[1], 0);
    }
    window.__burnFocus = focusZone;
    window.__burnHome = () => {
      setFocus(null);
      cameraTarget.copy(cameraHome);
      targetLook.set(0,0,-1);
    };

    function animate() {
      time += 0.016;
      pointer.x += (pointer.tx - pointer.x) * 0.035;
      pointer.y += (pointer.ty - pointer.y) * 0.035;

      mat.uniforms.uTime.value = time;
      world.rotation.y += ((pointer.x * 0.035) - world.rotation.y) * 0.035;
      world.rotation.x += ((-pointer.y * 0.018) - world.rotation.x) * 0.035;

      camera.position.lerp(cameraTarget, 0.035);
      camera.position.x += pointer.x * 0.11;
      camera.position.y -= pointer.y * 0.07;
      const look = new THREE.Vector3(targetLook.x, targetLook.y, 0);
      camera.lookAt(look);

      fireLight.intensity = 4.1 + Math.sin(time * 9.5) * 0.7 + Math.sin(time * 15.2) * 0.35;
      embers.rotation.y = Math.sin(time * 0.16) * 0.12;
      embers.position.y = Math.sin(time * 0.7) * 0.08;
      coinGroup.children.forEach((c, i) => {
        c.rotation.x += 0.01 + i * 0.0002;
        c.rotation.z += 0.006;
        c.position.y += Math.sin(time * 1.2 + c.userData.phase) * 0.0018;
      });
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('wheel', onWheel);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      bgGeo.dispose();
      bgMat.dispose();
      texture.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus('Install a Cronos-compatible wallet such as MetaMask.');
      return;
    }
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CRONOS.chainId }] });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [CRONOS] });
        } else throw switchError;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWallet(`${address.slice(0, 6)}…${address.slice(-4)}`);
      setStatus('Connected to Cronos.');
    } catch (e) {
      setStatus(e?.message || 'Wallet connection cancelled.');
    }
  };

  const burn = () => {
    setBurnPulse(true);
    setStatus('THE FIRE IS HOT. Open the launch page to make the trade.');
    setTimeout(() => setBurnPulse(false), 1200);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(TOKEN_ADDRESS);
    setCopied(true);
    setStatus('Full contract address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className={`app ${burnPulse ? 'burning' : ''}`}>
      <div className="world" ref={mountRef} />
      <div className="grain" />
      <div className="vignette" />

      <aside className={`panel ${focus ? 'show' : 'show world-panel'}`}>
        {!focus && <>
          <div className="panel-kicker">·CRONOS CHAIN </div>
          <h2>BURN</h2>
          <p>A burn-powered meme coin on Cronos.</p>
          <div className="panel-row">
            <button className="panel-btn" onClick={() => window.__burnFocus?.('bag')}>EXPLORE →</button>
            <button className="panel-btn hot" onClick={burn}>BURN IT</button>
          </div>
        </>}
        {focus === 'bag' && <>
          <div className="panel-kicker">· BURN</div><h2>CONTRACT<br /><em>ADDRESS</em></h2>
          <p onClick={copyAddress} style={{ cursor: 'pointer', color: '#e7b768', textDecoration: 'underline', textDecorationColor: '#e7b768', fontSize: '12px' }}>{copied ? 'Copied!' : '0xad4db...2f8bfa'}</p>
          <button className="panel-btn" onClick={() => window.__burnFocus?.('loot')}>HOW TO BUY →</button>
        </>}
        {focus === 'fire' && <>
          <div className="panel-kicker">· THE LORE</div>
          <img src={tweet2} alt="Lore" style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain' }} />
          <div className="panel-row"><button className="panel-btn" onClick={() => window.__burnHome?.()}>HOME</button><a className="panel-btn" href="https://x.com/Fwiz/status/2100663121702744509" target="_blank" rel="noreferrer">X ↗</a></div>
        </>}
        {focus === 'loot' && <>
          <div className="panel-kicker">· HOW TO BUY</div><h2>BURN<em></em></h2>
          <p><strong>1</strong><br />Fund a Cronos wallet</p>
          <p><strong>2</strong><br />go to cronos launch<br />Connect your wallet</p>
          <p><strong>3</strong><br />Swap CRO → BURN<br />double check the contract <span onClick={copyAddress} style={{ cursor: 'pointer', color: '#e7b768', textDecoration: 'underline', textDecorationColor: '#e7b768', fontSize: '12px' }}>{copied ? 'Copied!' : '0xad4db...2f8bfa'}</span></p>
          <div className="panel-row"><button className="panel-btn" onClick={() => window.__burnFocus?.('fire')}>THE LORE →</button><a className="panel-btn hot" href={BUY_URL} target="_blank" rel="noreferrer">BUY ON CRONOS ↗</a></div>
        </>}
      </aside>

      <div className="bottom-ui">
        <button onClick={() => window.__burnHome?.()} className={!focus ? 'active' : ''}>HOME</button>
        <button onClick={() => window.__burnFocus?.('bag')} className={focus === 'bag' ? 'active' : ''}>CA</button>
        <button onClick={() => window.__burnFocus?.('loot')} className={focus === 'loot' ? 'active' : ''}>BUY</button>
        <button onClick={() => window.__burnFocus?.('fire')} className={focus === 'fire' ? 'active' : ''}>LORE</button>
      </div>

      <div className="status">{status}</div>
      <footer><span>CRONOS MAINNET</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
