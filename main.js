import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Lensflare, LensflareElement } from "three/examples/jsm/objects/Lensflare.js";

const nasaApiKey = "CH3TuB34hg317ulEggcZCMlKgCCPYQeTzdzJDNCz";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000814);
scene.fog = new THREE.Fog(0x000814, 180, 250);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.3;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.5;

const loader = new THREE.TextureLoader();
loader.manager.onLoad = () => console.log("All Textures Loaded!");
loader.manager.onError = (url) => console.error("Error Loading Texture:", url);

const ambientLight = new THREE.AmbientLight(new THREE.Color(0.13, 0.13, 0.13), 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(new THREE.Color(1.0, 1.0, 1.0), 10.0, 1000, 0.5);
pointLight.position.set(0, 0, 0);
pointLight.castShadow = false;
scene.add(pointLight);

const fillLight = new THREE.PointLight(new THREE.Color(0.2, 0.4, 1.0), 2.0, 100, 1);
fillLight.position.set(50, 50, -100);
scene.add(fillLight);

const sunMaterial = new THREE.MeshBasicMaterial({
  map: loader.load("/Sun.jpg"),
  emissive: new THREE.Color(1.5, 1.2, 0.8),
  emissiveIntensity: 1.8,
  toneMapped: false,
  color: new THREE.Color(1.2, 1.1, 0.9)
});
const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 64), sunMaterial);
scene.add(sun);

const textureLoader = new THREE.TextureLoader();
const textureFlare0 = textureLoader.load("/Lensflare.png");
const textureFlare2 = textureLoader.load("/_Lensflare.png");
const lensflare = new Lensflare();
lensflare.addElement(new LensflareElement(textureFlare0, 512, 0, new THREE.Color(1, 0.9, 0.8)));
lensflare.addElement(new LensflareElement(textureFlare2, 128, 0.2, new THREE.Color(1, 1, 0.6)));
lensflare.addElement(new LensflareElement(textureFlare2, 64, 0.4, new THREE.Color(0.8, 0.8, 1)));
lensflare.addElement(new LensflareElement(textureFlare2, 32, 0.6, new THREE.Color(1, 0.8, 0.6)));
sun.add(lensflare);

function toTitleCase(str) {
  if (!str) return "";
  return str.toLowerCase().split(' ').map(function (word) {
    return (word.charAt(0).toUpperCase() + word.slice(1));
  }).join(' ');
}

async function fetchAsteroidOrbitalElements(designation = 'Ceres') {
  const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${designation}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.orb) {
      const orb = data.orb;
      return {
        a: parseFloat(orb.a),
        e: parseFloat(orb.e),
        i: parseFloat(orb.i),
        om: parseFloat(orb.om),
        w: parseFloat(orb.w),
        ma: parseFloat(orb.ma)
      };
    }
  } catch (err) {
    console.error('Asteroid API Error:', err);
  }
  return null;
}

function keplerToCartesian(orb, epochJD = 2460000) {
  const deg2rad = Math.PI / 180;
  const a = orb.a;
  const e = orb.e;
  const i = orb.i * deg2rad;
  const om = orb.om * deg2rad;
  const w = orb.w * deg2rad;
  let M = orb.ma * deg2rad;
  let E = M;
  for (let j = 0; j < 10; j++) {
    E = M + e * Math.sin(E);
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const xOrb = r * Math.cos(nu);
  const yOrb = r * Math.sin(nu);
  const x = xOrb * (Math.cos(w) * Math.cos(om) - Math.sin(w) * Math.sin(om) * Math.cos(i)) - yOrb * (Math.sin(w) * Math.cos(om) + Math.cos(w) * Math.sin(om) * Math.cos(i));
  const y = xOrb * (Math.cos(w) * Math.sin(om) + Math.sin(w) * Math.cos(om) * Math.cos(i)) + yOrb * (Math.cos(w) * Math.cos(om) * Math.cos(i) - Math.sin(w) * Math.sin(om));
  const z = xOrb * Math.sin(w) * Math.sin(i) + yOrb * Math.cos(w) * Math.sin(i);
  return { x, y, z };
}

async function fetchNeos() {
  const url = `https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=${nasaApiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.near_earth_objects || [];
  } catch (err) {
    console.error('NEO API Error:', err);
    return [];
  }
}

async function fetchSentryObjects() {
  const url = 'https://ssd-api.jpl.nasa.gov/sentry.api';
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
  } catch (err) {
    console.error('Sentry API Error:', err);
    return [];
  }
}

async function fetchComets() {
  const url = 'https://ssd-api.jpl.nasa.gov/cad.api?body=COM';
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
  } catch (err) {
    console.error('Comet API Error:', err);
    return [];
  }
}

async function fetchFamousAsteroids() {
  const famousAsteroidNames = [
    'Apophis', 'Bennu', 'Ryugu', 'Didymos', 'Dimorphos', 'Itokawa',
    'Psyche', 'Vesta', 'Ceres', 'Pallas', 'Hygiea', 'Eros', 'Gaspra',
    'Ida', 'Mathilde', 'Steins', 'Lutetia', 'Dinkinesh', 'Toutatis',
    'Florence', 'Icarus', 'Geographos', 'Castalia', 'Toro', 'Amor',
    'Apollo', 'Anteros', 'Ganymed', 'Ivar', 'Daphne', 'Europa', 'Davida',
    'Interamnia', 'Hebe', 'Iris', 'Flora', 'Metis', 'Parthenope',
    'Eunomia', 'Juno', 'Astraea', 'Thisbe', 'Cybele', 'Herculina',
    'Sylvia', 'Patroclus', 'Hektor', 'Euphrosyne', 'Fortuna', 'Massalia',
    'Lutetia', 'Kleopatra', 'Dactyl', 'Linus', 'Eurybates', 'Polymele',
    'Leucus', 'Orus', 'Donaldjohanson'
  ];
  const asteroidData = [];
  for (const asteroid of famousAsteroidNames) {
    try {
      const orb = await fetchAsteroidOrbitalElements(asteroid);
      if (orb) {
        asteroidData.push({ name: asteroid, orb: orb });
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Error Fetching ${asteroid}:`, error);
    }
  }
  return asteroidData;
}

const realAsteroids = [];
const cometObjects = [];
const famousAsteroids = [];

async function addRealAsteroids() {
  try {
    const famousData = await fetchFamousAsteroids();
    console.log(`Fetched ${famousData.length} Famous Asteroids`);
    const auToScene = 15;

    for (const data of famousData) {
      const pos = keplerToCartesian(data.orb);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 + Math.random() * 0.1, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0x00ff00,
          emissive: 0x003300
        })
      );
      mesh.position.set(pos.x * auToScene, pos.y * auToScene, pos.z * auToScene);
      mesh.userData = { type: 'famous', name: data.name, data: data };
      scene.add(mesh);
      famousAsteroids.push(mesh);

      const orbitPoints = [];
      for (let i = 0; i <= 100; i++) {
        const angle = (i / 100) * Math.PI * 2;
        const fakeOrb = { ...data.orb, ma: angle * 180 / Math.PI };
        const orbitPos = keplerToCartesian(fakeOrb);
        orbitPoints.push(new THREE.Vector3(
          orbitPos.x * auToScene,
          orbitPos.y * auToScene,
          orbitPos.z * auToScene
        ));
      }
      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3
      });
      const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
      scene.add(orbitLine);
    }

    const neoObjects = await fetchNeos();
    console.log(`Fetched ${neoObjects.length} NEOs`);

    for (let i = 0; i < Math.min(30, neoObjects.length); i++) {
      const neo = neoObjects[i];
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff5555,
          emissive: 0x330000
        })
      );
      mesh.userData = { type: 'neo', data: neo };
      scene.add(mesh);
      realAsteroids.push(mesh);
    }

    const sentryObjects = await fetchSentryObjects();
    console.log(`Fetched ${sentryObjects.length} Sentry Objects`);

    for (let i = 0; i < Math.min(20, sentryObjects.length); i++) {
      const obj = sentryObjects[i];
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18 + Math.random() * 0.1, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffaa00,
          emissive: 0x332200
        })
      );
      mesh.userData = { type: 'sentry', data: obj };
      scene.add(mesh);
      realAsteroids.push(mesh);
    }
  } catch (error) {
    console.error('Error Adding Real Asteroids:', error);
  }
}

async function addComets() {
  try {
    const comets = await fetchComets();
    console.log(`Fetched ${comets.length} Comets`);

    for (let i = 0; i < Math.min(15, comets.length); i++) {
      const comet = comets[i];
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x55aaff,
          emissive: 0x002233
        })
      );

      const tailGeometry = new THREE.ConeGeometry(0.08, 3, 8);
      const tailMaterial = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.7
      });
      const tail = new THREE.Mesh(tailGeometry, tailMaterial);
      tail.rotation.z = Math.PI;
      tail.position.x = -1.5;
      mesh.add(tail);

      const distance = 30 + Math.random() * 40;
      const angle = Math.random() * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * distance,
        (Math.random() - 0.5) * 10,
        Math.sin(angle) * distance
      );

      mesh.userData = { type: 'comet', data: comet };
      scene.add(mesh);
      cometObjects.push(mesh);
    }
  } catch (error) {
    console.error('Error Adding Comets:', error);
  }
}

const asteroidBelts = {
  main: [],
  inner: [],
  outer: [],
  middle: [],
  trojans: [],
  kuiper: [],
  scattered: [],
  oort: []
};

function createEnhancedAsteroidBelt() {
  const innerCount = 150;
  const innerInnerRadius = 19.5;
  const innerOuterRadius = 21.5;

  for (let i = 0; i < innerCount; i++) {
    const angle = (i / innerCount) * Math.PI * 2 + Math.random() * 0.5;
    const radius = innerInnerRadius + Math.random() * (innerOuterRadius - innerInnerRadius);
    const size = 0.01 + Math.random() * 0.06;

    const asteroidType = Math.random();
    let color;
    if (asteroidType < 0.5) {
      color = new THREE.Color(0.4, 0.26, 0.13);
    } else if (asteroidType < 0.8) {
      color = new THREE.Color(0.6, 0.6, 0.6);
    } else {
      color = new THREE.Color(0.5, 0.4, 0.3);
    }

    const asteroidGeo = new THREE.SphereGeometry(size, 6, 6);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.1),
      emissiveIntensity: 0.15,
      roughness: 1.0,
      metalness: asteroidType > 0.8 ? 0.3 : 0.1,
      toneMapped: false
    });

    const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
    asteroid.position.x = Math.cos(angle) * radius;
    asteroid.position.z = Math.sin(angle) * radius;
    asteroid.position.y = (Math.random() - 0.5) * 0.8;

    asteroid.rotation.x = Math.random() * Math.PI;
    asteroid.rotation.y = Math.random() * Math.PI;
    asteroid.rotation.z = Math.random() * Math.PI;

    scene.add(asteroid);
    asteroidBelts.inner.push({
      mesh: asteroid,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
      },
      orbitSpeed: 0.003 + Math.random() * 0.002,
      radius: radius,
      angle: angle,
      type: 'innerBelt'
    });
  }

  const middleCount = 200;
  const middleInnerRadius = 21.5;
  const middleOuterRadius = 23.5;

  for (let i = 0; i < middleCount; i++) {
    const angle = (i / middleCount) * Math.PI * 2 + Math.random() * 0.5;
    const radius = middleInnerRadius + Math.random() * (middleOuterRadius - middleInnerRadius);
    const size = 0.01 + Math.random() * 0.07;

    const asteroidType = Math.random();
    let color;
    if (asteroidType < 0.4) {
      color = new THREE.Color(0.4, 0.26, 0.13);
    } else if (asteroidType < 0.75) {
      color = new THREE.Color(0.6, 0.6, 0.6);
    } else {
      color = new THREE.Color(0.5, 0.4, 0.3);
    }

    const asteroidGeo = new THREE.SphereGeometry(size, 6, 6);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.12),
      emissiveIntensity: 0.18,
      roughness: 1.0,
      metalness: asteroidType > 0.75 ? 0.3 : 0.1,
      toneMapped: false
    });

    const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
    asteroid.position.x = Math.cos(angle) * radius;
    asteroid.position.z = Math.sin(angle) * radius;
    asteroid.position.y = (Math.random() - 0.5) * 1.0;

    asteroid.rotation.x = Math.random() * Math.PI;
    asteroid.rotation.y = Math.random() * Math.PI;
    asteroid.rotation.z = Math.random() * Math.PI;

    scene.add(asteroid);
    asteroidBelts.middle.push({
      mesh: asteroid,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
      },
      orbitSpeed: 0.0025 + Math.random() * 0.002,
      radius: radius,
      angle: angle,
      type: 'middleBelt'
    });
  }

  const outerCount = 150;
  const outerInnerRadius = 23.5;
  const outerOuterRadius = 25.5;

  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * Math.PI * 2 + Math.random() * 0.5;
    const radius = outerInnerRadius + Math.random() * (outerOuterRadius - outerInnerRadius);
    const size = 0.01 + Math.random() * 0.08;

    const asteroidType = Math.random();
    let color;
    if (asteroidType < 0.3) {
      color = new THREE.Color(0.4, 0.26, 0.13);
    } else if (asteroidType < 0.7) {
      color = new THREE.Color(0.6, 0.6, 0.6);
    } else {
      color = new THREE.Color(0.5, 0.4, 0.3);
    }

    const asteroidGeo = new THREE.SphereGeometry(size, 6, 6);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.1),
      emissiveIntensity: 0.2,
      roughness: 1.0,
      metalness: asteroidType > 0.7 ? 0.3 : 0.1,
      toneMapped: false
    });

    const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
    asteroid.position.x = Math.cos(angle) * radius;
    asteroid.position.z = Math.sin(angle) * radius;
    asteroid.position.y = (Math.random() - 0.5) * 1.2;

    asteroid.rotation.x = Math.random() * Math.PI;
    asteroid.rotation.y = Math.random() * Math.PI;
    asteroid.rotation.z = Math.random() * Math.PI;

    scene.add(asteroid);
    asteroidBelts.outer.push({
      mesh: asteroid,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
      },
      orbitSpeed: 0.002 + Math.random() * 0.0015,
      radius: radius,
      angle: angle,
      type: 'outerBelt'
    });
  }
}

function createJupiterTrojans() {
  const asteroidCount = 100;
  const jupiterDistance = 25;

  for (let i = 0; i < asteroidCount / 2; i++) {
    const baseAngle = Math.PI / 3;
    const angle = baseAngle + (Math.random() - 0.5) * 1.0;
    const radius = jupiterDistance + (Math.random() - 0.5) * 4;
    const size = 0.02 + Math.random() * 0.05;

    const asteroidGeo = new THREE.SphereGeometry(size, 6, 6);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.35, 0.25, 0.15),
      emissive: new THREE.Color(0.15, 0.1, 0.05),
      emissiveIntensity: 0.2,
      roughness: 1.0,
      metalness: 0.05,
      toneMapped: false
    });

    const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
    asteroid.position.x = Math.cos(angle) * radius;
    asteroid.position.z = Math.sin(angle) * radius;
    asteroid.position.y = (Math.random() - 0.5) * 1.0;

    scene.add(asteroid);
    asteroidBelts.trojans.push({
      mesh: asteroid,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.015,
        y: (Math.random() - 0.5) * 0.015,
        z: (Math.random() - 0.5) * 0.015
      },
      orbitSpeed: 0.000084,
      radius: radius,
      angle: angle,
      type: 'trojanL4'
    });
  }

  for (let i = 0; i < asteroidCount / 2; i++) {
    const baseAngle = -Math.PI / 3;
    const angle = baseAngle + (Math.random() - 0.5) * 1.0;
    const radius = jupiterDistance + (Math.random() - 0.5) * 4;
    const size = 0.02 + Math.random() * 0.05;

    const asteroidGeo = new THREE.SphereGeometry(size, 6, 6);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.35, 0.25, 0.15),
      emissive: new THREE.Color(0.15, 0.1, 0.05),
      emissiveIntensity: 0.2,
      roughness: 1.0,
      metalness: 0.05,
      toneMapped: false
    });

    const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
    asteroid.position.x = Math.cos(angle) * radius;
    asteroid.position.z = Math.sin(angle) * radius;
    asteroid.position.y = (Math.random() - 0.5) * 1.0;

    scene.add(asteroid);
    asteroidBelts.trojans.push({
      mesh: asteroid,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.015,
        y: (Math.random() - 0.5) * 0.015,
        z: (Math.random() - 0.5) * 0.015
      },
      orbitSpeed: 0.000084,
      radius: radius,
      angle: angle,
      type: 'trojanL5'
    });
  }
}

function createKuiperBelt() {
  const asteroidCount = 200;
  const innerRadius = 44;
  const outerRadius = 58;

  for (let i = 0; i < asteroidCount; i++) {
    const angle = (i / asteroidCount) * Math.PI * 2 + Math.random() * 1.0;
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    const size = 0.03 + Math.random() * 0.08;

    const asteroidType = Math.random();
    let color;
    if (asteroidType < 0.3) {
      color = new THREE.Color(0.6, 0.7, 0.8);
    } else if (asteroidType < 0.6) {
      color = new THREE.Color(0.5, 0.4, 0.3);
    } else {
      color = new THREE.Color(0.7, 0.5, 0.4);
    }

    const asteroidGeo = new THREE.SphereGeometry(size, 6, 6);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.2),
      emissiveIntensity: 0.4,
      roughness: 0.9,
      metalness: 0.05,
      toneMapped: false
    });

    const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
    asteroid.position.x = Math.cos(angle) * radius;
    asteroid.position.z = Math.sin(angle) * radius;
    asteroid.position.y = (Math.random() - 0.5) * 3.0;

    asteroid.rotation.x = Math.random() * Math.PI;
    asteroid.rotation.y = Math.random() * Math.PI;
    asteroid.rotation.z = Math.random() * Math.PI;

    scene.add(asteroid);
    asteroidBelts.kuiper.push({
      mesh: asteroid,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.01,
        y: (Math.random() - 0.5) * 0.01,
        z: (Math.random() - 0.5) * 0.01
      },
      orbitSpeed: 0.0000015 + Math.random() * 0.000002,
      radius: radius,
      angle: angle,
      type: 'kuiper'
    });
  }
}

function createScatteredDisk() {
  const asteroidCount = 80;
  const innerRadius = 58;
  const outerRadius = 80;

  for (let i = 0; i < asteroidCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    const size = 0.04 + Math.random() * 0.1;

    const color = new THREE.Color(0.6, 0.3, 0.2);

    const asteroidGeo = new THREE.SphereGeometry(size, 6, 6);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.25),
      emissiveIntensity: 0.5,
      roughness: 1.0,
      metalness: 0.02,
      toneMapped: false
    });

    const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
    asteroid.position.x = Math.cos(angle) * radius;
    asteroid.position.z = Math.sin(angle) * radius;
    asteroid.position.y = (Math.random() - 0.5) * 10.0;

    asteroid.rotation.x = Math.random() * Math.PI;
    asteroid.rotation.y = Math.random() * Math.PI;
    asteroid.rotation.z = Math.random() * Math.PI;

    scene.add(asteroid);
    asteroidBelts.scattered.push({
      mesh: asteroid,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.008,
        y: (Math.random() - 0.5) * 0.008,
        z: (Math.random() - 0.5) * 0.008
      },
      orbitSpeed: 0.0000008 + Math.random() * 0.000001,
      radius: radius,
      angle: angle,
      type: 'scattered'
    });
  }
}

function createOortCloud() {
  const asteroidCount = 50;
  const innerRadius = 80;
  const outerRadius = 120;

  for (let i = 0; i < asteroidCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    const size = 0.05 + Math.random() * 0.12;

    const color = new THREE.Color(0.8, 0.6, 0.9);

    const asteroidGeo = new THREE.SphereGeometry(size, 6, 6);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color.clone().multiplyScalar(0.3),
      emissiveIntensity: 0.6,
      roughness: 1.0,
      metalness: 0.01,
      toneMapped: false
    });

    const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
    asteroid.position.x = Math.cos(angle) * radius;
    asteroid.position.z = Math.sin(angle) * radius;
    asteroid.position.y = (Math.random() - 0.5) * 20.0;

    asteroid.rotation.x = Math.random() * Math.PI;
    asteroid.rotation.y = Math.random() * Math.PI;
    asteroid.rotation.z = Math.random() * Math.PI;

    scene.add(asteroid);
    asteroidBelts.oort.push({
      mesh: asteroid,
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.005,
        y: (Math.random() - 0.5) * 0.005,
        z: (Math.random() - 0.5) * 0.005
      },
      orbitSpeed: 0.0000003 + Math.random() * 0.0000005,
      radius: radius,
      angle: angle,
      type: 'oort'
    });
  }
}

createEnhancedAsteroidBelt();
createJupiterTrojans();
createKuiperBelt();
createScatteredDisk();
createOortCloud();

const celestialBodies = [
  {
    name: "Mercury",
    size: 0.5,
    dist: 8,
    speed: 0.0041,
    initialAngle: 2.1,
    texture: "Mercury.jpg",
    roughness: 1,
    metalness: 0.02,
    type: "planet",
    info: "Closest Planet To The Sun. Surface Temperatures Range From -173°c To 427°c. Has No Atmosphere And No Moons.",
    discoveryYear: "Ancient",
    moons: []
  },
  {
    name: "Venus",
    size: 0.9,
    dist: 11,
    speed: 0.0016,
    initialAngle: 4.8,
    texture: "Venus.jpg",
    roughness: 0.6,
    metalness: 0.05,
    type: "planet",
    info: "Hottest Planet In Our Solar System With Surface Temperatures Of 462°c. Has A Thick, Toxic Atmosphere Of Carbon Dioxide.",
    discoveryYear: "Ancient",
    moons: []
  },
  {
    name: "Earth",
    size: 1,
    dist: 15,
    speed: 0.001,
    initialAngle: 3.45,
    texture: "Earth.jpg",
    roughness: 0.5,
    metalness: 0.01,
    type: "planet",
    info: "The Only Known Planet With Life. 71% Of Surface Covered By Water. Has One Natural Satellite.",
    discoveryYear: "N/A",
    moons: [
      { name: "Moon", size: 0.27, dist: 2.5, speed: 0.037, color: new THREE.Color(0.53, 0.53, 0.53), info: "Earth's Only Natural Satellite. Formed 4.5 Billion Years Ago.", initialAngle: 1.2 }
    ]
  },
  {
    name: "Mars",
    size: 0.8,
    dist: 19,
    speed: 0.00053,
    initialAngle: 0.9,
    texture: "Mars.jpg",
    roughness: 0.75,
    metalness: 0.02,
    type: "planet",
    info: "The Red Planet. Has The Largest Volcano (Olympus Mons) And Canyon (Valles Marineris) In The Solar System.",
    discoveryYear: "Ancient",
    moons: [
      { name: "Phobos", size: 0.05, dist: 1.5, speed: 0.32, color: new THREE.Color(0.4, 0.26, 0.13), info: "Largest Moon Of Mars. Orbits Mars 3 Times Per Day.", initialAngle: 0.5 },
      { name: "Deimos", size: 0.03, dist: 2.2, speed: 0.08, color: new THREE.Color(0.4, 0.26, 0.13), info: "Smaller, Outer Moon Of Mars. Takes 30 Hours To Orbit Mars.", initialAngle: 2.1 }
    ]
  },
  {
    name: "Vesta",
    size: 0.15,
    dist: 20.5,
    speed: 0.00029,
    initialAngle: 5.2,
    color: new THREE.Color(0.8, 0.8, 0.8),
    roughness: 1.0,
    metalness: 0.1,
    type: "asteroid",
    info: "Second-Largest Asteroid. Has A Differentiated Interior With Basaltic Surface. Visited By Dawn Spacecraft.",
    discoveryYear: "1807",
    moons: []
  },
  {
    name: "Pallas",
    size: 0.12,
    dist: 21.2,
    speed: 0.00022,
    initialAngle: 1.8,
    color: new THREE.Color(0.67, 0.67, 0.67),
    roughness: 1.0,
    metalness: 0.05,
    type: "asteroid",
    info: "Third-Largest Asteroid. Highly Inclined Orbit. Possibly A Protoplanet.",
    discoveryYear: "1802",
    moons: []
  },
  {
    name: "Jupiter",
    size: 2,
    dist: 25,
    speed: 0.000084,
    initialAngle: 2.7,
    texture: "Jupiter.jpg",
    roughness: 0.9,
    metalness: 0.0,
    type: "planet",
    info: "Largest Planet In Our Solar System. Great Red Spot Is A Storm Larger Than Earth. Has 95 Known Moons.",
    discoveryYear: "Ancient",
    moons: [
      { name: "Io", size: 0.15, dist: 3.5, speed: 0.56, color: new THREE.Color(1.0, 1.0, 0.6), info: "Most Volcanically Active Body In The Solar System.", initialAngle: 0.8 },
      { name: "Europa", size: 0.13, dist: 4.2, speed: 0.28, color: new THREE.Color(0.53, 0.81, 0.92), info: "Ice-Covered Moon With Subsurface Ocean. Potential For Life.", initialAngle: 1.5 },
      { name: "Ganymede", size: 0.22, dist: 5.1, speed: 0.14, color: new THREE.Color(0.55, 0.49, 0.42), info: "Largest Moon In The Solar System. Has Its Own Magnetic Field.", initialAngle: 3.2 },
      { name: "Callisto", size: 0.20, dist: 6.0, speed: 0.06, color: new THREE.Color(0.41, 0.41, 0.41), info: "Most Heavily Cratered Body In The Solar System.", initialAngle: 4.9 },
      { name: "Amalthea", size: 0.08, dist: 2.8, speed: 2.0, color: new THREE.Color(0.6, 0.4, 0.2), info: "Fifth Largest Moon Of Jupiter. Irregular Potato Shape.", initialAngle: 5.2 },
      { name: "Himalia", size: 0.05, dist: 7.5, speed: 0.013, color: new THREE.Color(0.5, 0.5, 0.5), info: "Largest Irregular Moon Of Jupiter.", initialAngle: 2.1 },
      { name: "Lysithea", size: 0.02, dist: 8.2, speed: 0.010, color: new THREE.Color(0.4, 0.4, 0.4), info: "Small Irregular Moon In Jupiter's Prograde Group.", initialAngle: 4.7 },
      { name: "Elara", size: 0.03, dist: 8.0, speed: 0.011, color: new THREE.Color(0.45, 0.45, 0.45), info: "Irregular Moon Discovered In 1905.", initialAngle: 1.8 }
    ]
  },
  {
    name: "Saturn",
    size: 1.7,
    dist: 31,
    speed: 0.000034,
    initialAngle: 5.8,
    texture: "Saturn.jpg",
    hasRings: true,
    roughness: 0.9,
    metalness: 0.0,
    type: "planet",
    info: "Famous For Its Prominent Ring System. Less Dense Than Water. Has 146 Known Moons.",
    discoveryYear: "Ancient",
    moons: [
      { name: "Mimas", size: 0.06, dist: 2.8, speed: 1.05, color: new THREE.Color(0.7, 0.7, 0.7), info: "Death Star-Like Appearance With Giant Herschel Crater.", initialAngle: 0.9 },
      { name: "Enceladus", size: 0.08, dist: 3.2, speed: 0.73, color: new THREE.Color(0.94, 0.97, 1.0), info: "Ice Geysers From South Pole. Subsurface Ocean.", initialAngle: 4.1 },
      { name: "Tethys", size: 0.09, dist: 3.7, speed: 0.52, color: new THREE.Color(0.8, 0.8, 0.85), info: "Heavily Cratered Icy Moon With Large Odysseus Crater.", initialAngle: 2.7 },
      { name: "Dione", size: 0.09, dist: 4.1, speed: 0.37, color: new THREE.Color(0.75, 0.75, 0.8), info: "Ice Cliffs And Wispy Terrain On Trailing Hemisphere.", initialAngle: 5.5 },
      { name: "Rhea", size: 0.12, dist: 4.8, speed: 0.22, color: new THREE.Color(0.7, 0.7, 0.75), info: "Second Largest Moon Of Saturn With Thin Oxygen Atmosphere.", initialAngle: 1.3 },
      { name: "Titan", size: 0.21, dist: 5.5, speed: 0.063, color: new THREE.Color(1.0, 0.65, 0.0), info: "Has Thick Atmosphere And Liquid Methane Lakes.", initialAngle: 2.3 },
      { name: "Hyperion", size: 0.04, dist: 6.2, speed: 0.048, color: new THREE.Color(0.6, 0.5, 0.4), info: "Chaotic Rotation And Sponge-Like Appearance.", initialAngle: 3.8 },
      { name: "Iapetus", size: 0.11, dist: 7.0, speed: 0.014, color: new THREE.Color(0.3, 0.3, 0.3), info: "Two-Tone Coloration, Dark Leading Hemisphere.", initialAngle: 0.5 },
      { name: "Phoebe", size: 0.03, dist: 8.5, speed: 0.006, color: new THREE.Color(0.25, 0.25, 0.25), info: "Retrograde Irregular Moon, Likely Captured Asteroid.", initialAngle: 4.9 }
    ]
  },
  {
    name: "Uranus",
    size: 1.2,
    dist: 37,
    speed: 0.000012,
    initialAngle: 1.2,
    texture: "Uranus.jpg",
    roughness: 0.85,
    metalness: 0.0,
    type: "planet",
    info: "Ice Giant Tilted On Its Side (98° Axial Tilt). Has Faint Rings And 28 Known Moons.",
    discoveryYear: "1781",
    moons: [
      { name: "Ariel", size: 0.08, dist: 2.2, speed: 0.39, color: new THREE.Color(0.6, 0.6, 0.65), info: "Youngest Surface Among Uranian Moons With Fault Valleys.", initialAngle: 2.1 },
      { name: "Umbriel", size: 0.08, dist: 2.5, speed: 0.23, color: new THREE.Color(0.4, 0.4, 0.45), info: "Darkest Of Uranus's Major Moons.", initialAngle: 4.8 },
      { name: "Titania", size: 0.11, dist: 3.0, speed: 0.12, color: new THREE.Color(0.55, 0.55, 0.6), info: "Largest Moon Of Uranus With Deep Canyons.", initialAngle: 1.7 },
      { name: "Oberon", size: 0.10, dist: 3.4, speed: 0.075, color: new THREE.Color(0.5, 0.5, 0.55), info: "Outermost Major Moon With Ancient Cratered Surface.", initialAngle: 5.3 },
      { name: "Miranda", size: 0.06, dist: 1.8, speed: 0.67, color: new THREE.Color(0.53, 0.53, 0.53), info: "Most Unusual Moon With Extreme Geological Features.", initialAngle: 3.7 },
      { name: "Puck", size: 0.03, dist: 1.5, speed: 1.18, color: new THREE.Color(0.45, 0.45, 0.5), info: "Small Irregular Moon Discovered By Voyager 2.", initialAngle: 0.8 }
    ]
  },
  {
    name: "Neptune",
    size: 1.1,
    dist: 42,
    speed: 0.0000061,
    initialAngle: 6.1,
    texture: "Neptune.jpg",
    roughness: 0.85,
    metalness: 0.0,
    type: "planet",
    info: "Windiest Planet With Speeds Up To 2,100 Km/h. Deep Blue Color From Methane In Atmosphere.",
    discoveryYear: "1846",
    moons: [
      { name: "Triton", size: 0.11, dist: 3.0, speed: 0.17, color: new THREE.Color(0.53, 0.81, 0.92), info: "Largest Moon Of Neptune. Orbits Retrograde. Nitrogen Geysers.", initialAngle: 0.9 },
      { name: "Nereid", size: 0.02, dist: 4.8, speed: 0.003, color: new THREE.Color(0.5, 0.5, 0.5), info: "Highly Eccentric Orbit, Likely Captured Kuiper Belt Object.", initialAngle: 3.2 },
      { name: "Proteus", size: 0.03, dist: 2.2, speed: 0.89, color: new THREE.Color(0.4, 0.4, 0.4), info: "Largest Irregular-Shaped Moon Of Neptune.", initialAngle: 5.7 },
      { name: "Larissa", size: 0.015, dist: 1.8, speed: 1.81, color: new THREE.Color(0.35, 0.35, 0.35), info: "Small Inner Moon Discovered By Voyager 2.", initialAngle: 2.4 }
    ]
  },
  {
    name: "Ceres",
    size: 0.3,
    dist: 22,
    speed: 0.00022,
    color: new THREE.Color(0.6, 0.6, 0.6),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "Largest Object In Asteroid Belt. Has Water Ice And Possible Subsurface Ocean. Visited By Dawn Spacecraft.",
    discoveryYear: "1801",
    moons: []
  },
  {
    name: "Pluto",
    size: 0.4,
    dist: 48,
    speed: 0.000004,
    initialAngle: 5.3,
    color: new THREE.Color(0.82, 0.71, 0.55),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "Former Ninth Planet. Has Heart-Shaped Nitrogen Plains. Binary System With Charon.",
    discoveryYear: "1930",
    moons: [
      { name: "Charon", size: 0.2, dist: 1.8, speed: 0.16, color: new THREE.Color(0.5, 0.5, 0.5), info: "Largest Moon Relative To Its Parent Planet. Tidally Locked To Pluto.", initialAngle: 1.8 }
    ]
  },
  {
    name: "Eris",
    size: 0.35,
    dist: 52,
    speed: 0.0000018,
    initialAngle: 2.7,
    color: new THREE.Color(0.9, 0.9, 0.98),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "Most Massive Dwarf Planet. Discovery Led To Pluto's Reclassification. Very Reflective Surface.",
    discoveryYear: "2005",
    moons: [
      { name: "Dysnomia", size: 0.04, dist: 2.0, speed: 0.067, color: new THREE.Color(0.6, 0.6, 0.6), info: "Only Known Moon Of Eris.", initialAngle: 4.5 }
    ]
  },
  {
    name: "Makemake",
    size: 0.25,
    dist: 50,
    speed: 0.0000032,
    initialAngle: 1.9,
    color: new THREE.Color(0.55, 0.27, 0.07),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "Third-Largest Dwarf Planet. Reddish Surface Likely Due To Organic Compounds. No Atmosphere.",
    discoveryYear: "2005",
    moons: [
      { name: "MK 2", size: 0.02, dist: 1.5, speed: 0.083, color: new THREE.Color(0.4, 0.4, 0.4), info: "Small, Dark Moon Of Makemake.", initialAngle: 0.7 }
    ]
  },
  {
    name: "Haumea",
    size: 0.28,
    dist: 51,
    speed: 0.0000035,
    initialAngle: 4.2,
    color: new THREE.Color(1.0, 1.0, 1.0),
    roughness: 0.8,
    metalness: 0.1,
    type: "dwarf",
    info: "Elongated Dwarf Planet That Spins Every 4 Hours. Has Ring System And Crystalline Water Ice Surface.",
    discoveryYear: "2004",
    moons: [
      { name: "Hi'iaka", size: 0.05, dist: 2.2, speed: 0.02, color: new THREE.Color(0.87, 0.87, 0.87), info: "Larger Moon Of Haumea.", initialAngle: 2.9 },
      { name: "Namaka", size: 0.03, dist: 1.8, speed: 0.056, color: new THREE.Color(0.8, 0.8, 0.8), info: "Smaller, Inner Moon Of Haumea.", initialAngle: 5.1 }
    ]
  },
  {
    name: "Sedna",
    size: 0.2,
    dist: 65,
    speed: 0.00000009,
    initialAngle: 0.1,
    color: new THREE.Color(0.55, 0.0, 0.0),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "Extremely Distant Object In Extended Scattered Disk. Takes 11,400 Years To Orbit The Sun.",
    discoveryYear: "2003",
    moons: []
  },
  {
    name: "Quaoar",
    size: 0.18,
    dist: 54,
    speed: 0.0000035,
    initialAngle: 3.1,
    color: new THREE.Color(0.4, 0.26, 0.13),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "Classical Kuiper Belt Object. Has Ring System And One Known Moon.",
    discoveryYear: "2002",
    moons: [
      { name: "Weywot", size: 0.02, dist: 1.6, speed: 0.083, color: new THREE.Color(0.33, 0.33, 0.33), info: "Moon Of Quaoar.", initialAngle: 1.3 }
    ]
  },
  {
    name: "Orcus",
    size: 0.16,
    dist: 49,
    speed: 0.000004,
    initialAngle: 5.7,
    color: new THREE.Color(0.18, 0.31, 0.31),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "Plutino In 2:3 Resonance With Neptune. Sometimes Called 'Anti-Pluto'.",
    discoveryYear: "2004",
    moons: [
      { name: "Vanth", size: 0.06, dist: 1.9, speed: 0.1, color: new THREE.Color(0.27, 0.27, 0.27), info: "Large Moon Of Orcus.", initialAngle: 4.8 }
    ]
  },
  {
    name: "Gonggong",
    size: 0.19,
    dist: 56,
    speed: 0.0000018,
    initialAngle: 2.4,
    color: new THREE.Color(0.5, 0.0, 0.13),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "Red-Colored Scattered Disk Object. Has Slow Rotation Period Of 22 Hours.",
    discoveryYear: "2007",
    moons: [
      { name: "Xiangliu", size: 0.03, dist: 1.7, speed: 0.1, color: new THREE.Color(0.4, 0.4, 0.4), info: "Moon Of Gonggong.", initialAngle: 3.8 }
    ]
  },
  {
    name: "Varuna",
    size: 0.12,
    dist: 53,
    speed: 0.0000027,
    initialAngle: 4.7,
    color: new THREE.Color(0.41, 0.41, 0.41),
    roughness: 1.0,
    metalness: 0.0,
    type: "tno",
    info: "Large Classical Kuiper Belt Object. Elongated Shape With Rapid Rotation.",
    discoveryYear: "2000",
    moons: []
  },
  {
    name: "Ixion",
    size: 0.11,
    dist: 49.5,
    speed: 0.000004,
    initialAngle: 0.8,
    color: new THREE.Color(0.55, 0.27, 0.07),
    roughness: 1.0,
    metalness: 0.0,
    type: "tno",
    info: "Plutino With Very Red Surface. May Have Experienced Thermal Evolution.",
    discoveryYear: "2001",
    moons: []
  },
  {
    name: "Salacia",
    size: 0.13,
    dist: 50.3,
    speed: 0.0000035,
    initialAngle: 2.9,
    color: new THREE.Color(0.6, 0.6, 0.65),
    roughness: 1.0,
    metalness: 0.0,
    type: "tno",
    info: "Large Trans-Neptunian Object With A Known Moon.",
    discoveryYear: "2004",
    moons: [
      { name: "Actaea", size: 0.04, dist: 1.4, speed: 0.09, color: new THREE.Color(0.5, 0.5, 0.55), info: "Moon Of Salacia, Discovered In 2006.", initialAngle: 1.9 }
    ]
  },
  {
    name: "2007 OR10",
    size: 0.16,
    dist: 55.2,
    speed: 0.0000019,
    initialAngle: 3.7,
    color: new THREE.Color(0.45, 0.15, 0.10),
    roughness: 1.0,
    metalness: 0.0,
    type: "dwarf",
    info: "One Of The Largest Known Dwarf Planets, Very Red In Color.",
    discoveryYear: "2007",
    moons: [
      { name: "S/2016 (225088) 1", size: 0.025, dist: 1.6, speed: 0.08, color: new THREE.Color(0.4, 0.4, 0.4), info: "Small Moon Of 2007 Or10.", initialAngle: 5.1 }
    ]
  }
];

const planetMeshes = [];

celestialBodies.forEach((body) => {
  let material;

  if (body.texture) {
    const texturePath = `/${body.texture}`;
    const texture = loader.load(texturePath);
    material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: body.metalness || 0.05,
      roughness: body.roughness || 1,
      emissive: new THREE.Color(0.0, 0.0, 0.0),
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      color: body.color,
      metalness: body.metalness || 0.05,
      roughness: body.roughness || 1,
      emissive: new THREE.Color(0.0, 0.0, 0.0),
    });
  }

  const geo = new THREE.SphereGeometry(body.size, 64, 64);
  const mesh = new THREE.Mesh(geo, material);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const pivot = new THREE.Object3D();
  pivot.add(mesh);
  mesh.position.x = body.dist;

  if (body.initialAngle !== undefined) {
    pivot.rotation.y = body.initialAngle;
  }

  scene.add(pivot);

  const orbitGeo = new THREE.RingGeometry(
    body.dist - 0.05,
    body.dist + 0.05,
    128
  );

  let orbitColor, glowIntensity, baseOpacity;

  if (body.type === 'dwarf') {
    orbitColor = new THREE.Color(0.8, 0.6, 0.0);
    glowIntensity = 0.08;
    baseOpacity = 0.04;
  } else if (body.type === 'asteroid') {
    orbitColor = new THREE.Color(0.6, 0.3, 0.15);
    glowIntensity = 0.06;
    baseOpacity = 0.03;
  } else if (body.type === 'tno') {
    orbitColor = new THREE.Color(0.4, 0.15, 0.5);
    glowIntensity = 0.1;
    baseOpacity = 0.05;
  } else {
    if (body.dist < 20) {
      orbitColor = new THREE.Color(0.3, 0.5, 0.7);
      glowIntensity = 0.03;
      baseOpacity = 0.02;
    } else if (body.dist < 35) {
      orbitColor = new THREE.Color(0.5, 0.4, 0.7);
      glowIntensity = 0.05;
      baseOpacity = 0.03;
    } else {
      orbitColor = new THREE.Color(0.7, 0.3, 0.4);
      glowIntensity = 0.07;
      baseOpacity = 0.04;
    }
  }

  if (body.dist > 45) {
    glowIntensity *= 1.2;
    baseOpacity *= 1.3;
  }

  let orbitMat;
  try {
    orbitMat = new THREE.MeshBasicMaterial({
      color: orbitColor,
      emissive: orbitColor,
      emissiveIntensity: glowIntensity,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: baseOpacity,
      toneMapped: false,
    });
  } catch (error) {
    console.warn("Emissive Material Failed, Using Basic Material:", error);
    orbitMat = new THREE.MeshBasicMaterial({
      color: orbitColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: baseOpacity * 2,
    });
  }

  const orbit = new THREE.Mesh(orbitGeo, orbitMat);
  orbit.rotation.x = Math.PI / 2;
  orbit.position.y = -0.01;

  if (body.dist > 40) {
    orbit.userData = {
      originalEmissive: glowIntensity,
      pulseSpeed: 0.002 + Math.random() * 0.003,
      pulsePhase: Math.random() * Math.PI * 2
    };
  }

  scene.add(orbit);

  if (body.hasRings) {
    const ringTex = loader.load("/SaturnRing.png");
    const ringGeo = new THREE.RingGeometry(
      body.size + 0.5,
      body.size + 1.2,
      64
    );
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      alphaMap: ringTex,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    ring.receiveShadow = true;
    mesh.add(ring);
  }

  const moons = [];
  if (body.moons && body.moons.length > 0) {
    body.moons.forEach((moonData) => {
      const moonGeo = new THREE.SphereGeometry(moonData.size, 32, 32);
      const moonMat = new THREE.MeshStandardMaterial({
        color: moonData.color,
        roughness: 0.9,
        metalness: 0.1
      });
      const moonMesh = new THREE.Mesh(moonGeo, moonMat);

      const moonPivot = new THREE.Object3D();
      moonPivot.add(moonMesh);
      moonMesh.position.x = moonData.dist;

      if (moonData.initialAngle !== undefined) {
        moonPivot.rotation.y = moonData.initialAngle;
      }

      mesh.add(moonPivot);

      moons.push({
        mesh: moonMesh,
        pivot: moonPivot,
        speed: moonData.speed
      });
    });
  }

  planetMeshes.push({
    mesh,
    pivot,
    speed: body.speed,
    moons: moons,
    type: body.type,
    orbit: orbit
  });
});

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5,
  0.6,
  0.05
);

bloomPass.strength = 0.5;
bloomPass.radius = 0.6;
bloomPass.threshold = 0.05;

composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

function createDistantStars() {
  const starCount = 1500;
  const starPositions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount * 3; i += 3) {
    const radius = 150 + Math.random() * 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;

    starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i + 2] = radius * Math.cos(phi);
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

  const starMaterial = new THREE.PointsMaterial({
    color: new THREE.Color(1.0, 1.0, 1.0),
    size: 0.7,
    transparent: true,
    opacity: 0.9
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
  return stars;
}

const distantStars = createDistantStars();

let frameCount = 0;
let animationSpeed = 0.4;
let isPaused = false;
let currentDate = new Date();
let timePerFrame = 1000 * 60 * 60 * 24;
let showOrbits = true;
let showAsteroids = true;
let showMoons = true;
let showPlanetLabels = false;
const planetLabels = [];
let followingPlanet = null;
let followOffset = new THREE.Vector3(10, 5, 10);
let lastPlanetPosition = new THREE.Vector3();
let userCameraOffset = new THREE.Vector3();

function createPlanetLabels() {
  planetMeshes.forEach((planetObj, index) => {
    const body = celestialBodies[index];
    const labelDiv = document.createElement('div');
    labelDiv.className = 'planetLabel';
    labelDiv.textContent = toTitleCase(body.name);
    labelDiv.style.display = 'none';
    document.body.appendChild(labelDiv);

    planetLabels.push({
      element: labelDiv,
      planetMesh: planetObj.mesh,
      body: body
    });
  });
}

function updatePlanetLabels() {
  if (!showPlanetLabels) return;

  planetLabels.forEach(label => {
    const vector = new THREE.Vector3();
    label.planetMesh.getWorldPosition(vector);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

    label.element.style.left = x + 'px';
    label.element.style.top = (y - 20) + 'px';

    if (vector.z > 1) {
      label.element.style.display = 'none';
    } else {
      label.element.style.display = showPlanetLabels ? 'block' : 'none';
    }
  });
}

let showMoonLabels = false;
const moonLabels = [];

function createMoonLabels() {
  planetMeshes.forEach((planetObj, planetIndex) => {
    const body = celestialBodies[planetIndex];
    if (body.moons && body.moons.length > 0) {
      body.moons.forEach((moonData, moonIndex) => {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'moonLabel';
        labelDiv.textContent = toTitleCase(moonData.name);
        labelDiv.style.display = 'none';
        document.body.appendChild(labelDiv);

        moonLabels.push({
          element: labelDiv,
          moonMesh: planetObj.moons[moonIndex].mesh,
          moonData: moonData
        });
      });
    }
  });
}

function updateMoonLabels() {
  if (!showMoonLabels) return;

  moonLabels.forEach(label => {
    const vector = new THREE.Vector3();
    label.moonMesh.getWorldPosition(vector);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

    label.element.style.left = x + 'px';
    label.element.style.top = (y - 15) + 'px';

    if (vector.z > 1) {
      label.element.style.display = 'none';
    } else {
      label.element.style.display = showMoonLabels ? 'block' : 'none';
    }
  });
}

createPlanetLabels();
createMoonLabels();

function animate() {
  requestAnimationFrame(animate);

  if (frameCount % 60 === 0) {
    console.log(`Animation Running. Frame: ${frameCount}, Paused: ${isPaused}, Speed: ${animationSpeed}`);
  }
  frameCount++;

  if (!isPaused) {
    let realTimeMultiplier = animationSpeed === 0 ? 0.0001 : animationSpeed;

    if (animationSpeed === 0) {
      currentDate = new Date();
    } else {
      const deltaTime = timePerFrame * realTimeMultiplier / 60;
      currentDate.setTime(currentDate.getTime() + deltaTime);
    }

    sun.rotation.y += 0.002 * realTimeMultiplier;

    planetMeshes.forEach((p) => {
      const cinematicFactor = 1.0;
      p.pivot.rotation.y += p.speed * realTimeMultiplier * cinematicFactor;
      p.mesh.rotation.y += 0.01 * realTimeMultiplier * cinematicFactor;

      if (p.orbit && p.orbit.userData && p.orbit.userData.pulseSpeed) {
        try {
          const time = Date.now() * 0.001;
          const pulse = Math.sin(time * p.orbit.userData.pulseSpeed + p.orbit.userData.pulsePhase) * 0.3 + 0.7;

          if (p.orbit.material.emissiveIntensity !== undefined) {
            p.orbit.material.emissiveIntensity = p.orbit.userData.originalEmissive * pulse;
          }

          if (!p.orbit.userData.originalOpacity) {
            p.orbit.userData.originalOpacity = p.orbit.material.opacity;
          }
          p.orbit.material.opacity = p.orbit.userData.originalOpacity * (0.8 + pulse * 0.2);
        } catch (error) {
          console.warn("Orbit Pulsing Animation Error:", error);
        }
      }

      if (p.moons && p.moons.length > 0) {
        p.moons.forEach((moon) => {
          const moonCinematic = 0.1;
          const adjustedMoonSpeed = moon.speed * moonCinematic;
          moon.pivot.rotation.y += adjustedMoonSpeed * realTimeMultiplier;
          moon.mesh.rotation.y += 0.02 * realTimeMultiplier;
        });
      }
    });

    Object.values(asteroidBelts).forEach(belt => {
      belt.forEach((asteroid) => {
        asteroid.mesh.rotation.x += asteroid.rotationSpeed.x * realTimeMultiplier;
        asteroid.mesh.rotation.y += asteroid.rotationSpeed.y * realTimeMultiplier;
        asteroid.mesh.rotation.z += asteroid.rotationSpeed.z * realTimeMultiplier;

        asteroid.angle += asteroid.orbitSpeed * realTimeMultiplier;
        asteroid.mesh.position.x = Math.cos(asteroid.angle) * asteroid.radius;
        asteroid.mesh.position.z = Math.sin(asteroid.angle) * asteroid.radius;
      });
    });

    distantStars.rotation.y += 0.0001 * realTimeMultiplier;
  }

  controls.update();

  if (followingPlanet) {
    const planetPos = new THREE.Vector3();
    followingPlanet.mesh.getWorldPosition(planetPos);

    if (followingType === 'sun') {
      controls.target.copy(planetPos);
    } else {
      const planetMovement = planetPos.clone().sub(lastPlanetPosition);

      if (!lastPlanetPosition.equals(new THREE.Vector3(0, 0, 0))) {
        camera.position.add(planetMovement);
        controls.target.add(planetMovement);
      } else {
        camera.position.copy(planetPos.clone().add(followOffset));
        controls.target.copy(planetPos);
      }
    }

    lastPlanetPosition.copy(planetPos);
  }

  updatePlanetLabels();
  updateMoonLabels();

  const distanceToSun = camera.position.distanceTo(sun.position);
  const maxDistance = 100;
  const minDistance = 10;
  const normalizedDistance = Math.max(0, Math.min(1, (distanceToSun - minDistance) / (maxDistance - minDistance)));

  if (bloomPass && !isBloomManual) {
    bloomPass.strength = 0.5 + (1 - normalizedDistance) * 1.0;
    bloomPass.radius = 0.6 + (1 - normalizedDistance) * 0.4;
  } else if (bloomPass && isBloomManual) {
    bloomPass.strength = manualBloomStrength;
    bloomPass.radius = 0.6 + (1 - normalizedDistance) * 0.2;
  }

  try {
    composer.render();
  } catch (error) {
    console.error("Composer Rendering Failed, Falling Back To Direct Rendering:", error);
    renderer.render(scene, camera);
  }
}

async function initializeRealObjects() {
  try {
    console.log("Initializing Real-Time NASA Data...");
    await addRealAsteroids();
    await addComets();
    console.log("Real-Time NASA Data Initialization Complete");
  } catch (error) {
    console.error("Error Initializing Real Objects:", error);
  }
}

setTimeout(() => {
  animate();
  initializeRealObjects();
}, 200);

const speedControl = document.getElementById('speedControl');
const speedValue = document.getElementById('speedValue');
if (speedControl && speedValue) {
  speedControl.addEventListener('input', (e) => {
    animationSpeed = parseFloat(e.target.value);
    if (animationSpeed === 0) {
      speedValue.textContent = '0x Real Earth Time';
    } else if (animationSpeed < 1) {
      speedValue.textContent = animationSpeed.toFixed(1) + 'x Slow';
    } else {
      speedValue.textContent = animationSpeed.toFixed(1) + 'x Fast';
    }
    speedValue.textContent = toTitleCase(speedValue.textContent);
  });
}

const hideUIBtn = document.getElementById('hideUIBtn');
const showUIBtn = document.getElementById('showUIBtn');
const uiControls = document.getElementById('uiControls');
const celestialPanel = document.querySelector('.celestialPanel');
const infoPanel = document.querySelector('.info');

if (hideUIBtn && showUIBtn && uiControls) {
  hideUIBtn.addEventListener('click', () => {
    uiControls.classList.add('uiHidden');
    if (celestialPanel) celestialPanel.classList.add('uiHidden');
    if (infoPanel) infoPanel.classList.add('uiHidden');
    showUIBtn.style.display = 'block';
  });

  showUIBtn.addEventListener('click', () => {
    uiControls.classList.remove('uiHidden');
    if (celestialPanel) celestialPanel.classList.remove('uiHidden');
    if (infoPanel) infoPanel.classList.remove('uiHidden');
    showUIBtn.style.display = 'none';
  });
}

let isBloomManual = false;
let manualBloomStrength = 0.5;

const bloomControl = document.getElementById('bloomControl');
const bloomValue = document.getElementById('bloomValue');
if (bloomControl && bloomValue) {
  isBloomManual = true;
  manualBloomStrength = 0.5;
  bloomPass.strength = 0.5;
  bloomControl.value = 0.5;
  bloomValue.textContent = '0.5';

  bloomControl.addEventListener('input', (e) => {
    const strength = parseFloat(e.target.value);
    manualBloomStrength = strength;
    isBloomManual = true;
    bloomPass.strength = strength;
    bloomValue.textContent = strength.toFixed(1);
    const bloomModeBtn = document.getElementById('bloomModeBtn');
    if (bloomModeBtn) {
      bloomModeBtn.textContent = 'Auto Bloom';
      bloomModeBtn.classList.add('active');
    }
    console.log(`Manual Bloom Set To: ${strength}`);
  });
}

const bloomModeBtn = document.getElementById('bloomModeBtn');
if (bloomModeBtn) {
  bloomModeBtn.addEventListener('click', () => {
    isBloomManual = !isBloomManual;
    bloomModeBtn.textContent = toTitleCase(isBloomManual ? 'Auto Bloom' : 'Manual Bloom');
    bloomModeBtn.classList.toggle('active', isBloomManual);

    if (!isBloomManual) {
      console.log('Switched To Automatic Bloom Mode');
    } else {
      console.log('Switched To Manual Bloom Mode');
      bloomPass.strength = manualBloomStrength;
    }
  });

  bloomModeBtn.textContent = toTitleCase(isBloomManual ? 'Auto Bloom' : 'Manual Bloom');
  bloomModeBtn.classList.toggle('active', isBloomManual);
}

const pauseBtn = document.getElementById('pauseBtn');
if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.textContent = toTitleCase(isPaused ? 'Resume' : 'Pause');
    pauseBtn.classList.toggle('active', isPaused);
  });
}

const orbitsBtn = document.getElementById('orbitsBtn');
if (orbitsBtn) {
  orbitsBtn.addEventListener('click', () => {
    showOrbits = !showOrbits;
    orbitsBtn.classList.toggle('active', showOrbits);

    planetMeshes.forEach(planet => {
      if (planet.orbit) {
        planet.orbit.visible = showOrbits;
      }
    });
  });
}

const mainAsteroidsBtn = document.getElementById('mainAsteroidsBtn');
if (mainAsteroidsBtn) {
  mainAsteroidsBtn.addEventListener('click', () => {
    const isVisible = !asteroidBelts.main[0]?.mesh.visible;
    mainAsteroidsBtn.classList.toggle('active', isVisible);

    asteroidBelts.main.forEach(asteroid => {
      asteroid.mesh.visible = isVisible;
    });
  });
}

const trojansBtn = document.getElementById('trojansBtn');
if (trojansBtn) {
  trojansBtn.addEventListener('click', () => {
    const isVisible = !asteroidBelts.trojans[0]?.mesh.visible;
    trojansBtn.classList.toggle('active', isVisible);

    asteroidBelts.trojans.forEach(asteroid => {
      asteroid.mesh.visible = isVisible;
    });
  });
}

const kuiperBtn = document.getElementById('kuiperBtn');
if (kuiperBtn) {
  kuiperBtn.addEventListener('click', () => {
    const isVisible = !asteroidBelts.kuiper[0]?.mesh.visible;
    kuiperBtn.classList.toggle('active', isVisible);

    asteroidBelts.kuiper.forEach(asteroid => {
      asteroid.mesh.visible = isVisible;
    });
  });
}

const scatteredBtn = document.getElementById('scatteredBtn');
if (scatteredBtn) {
  scatteredBtn.addEventListener('click', () => {
    const isVisible = !asteroidBelts.scattered[0]?.mesh.visible;
    scatteredBtn.classList.toggle('active', isVisible);

    asteroidBelts.scattered.forEach(asteroid => {
      asteroid.mesh.visible = isVisible;
    });
  });
}

const moonsBtn = document.getElementById('moonsBtn');
if (moonsBtn) {
  moonsBtn.addEventListener('click', () => {
    showMoons = !showMoons;
    moonsBtn.classList.toggle('active', showMoons);

    planetMeshes.forEach(planet => {
      if (planet.moons) {
        planet.moons.forEach(moon => {
          moon.mesh.visible = showMoons;
        });
      }
    });
  });
}

const labelToggle = document.getElementById('labelToggle');
if (labelToggle) {
  labelToggle.addEventListener('click', () => {
    showPlanetLabels = !showPlanetLabels;
    labelToggle.classList.toggle('active', showPlanetLabels);
    labelToggle.textContent = toTitleCase(showPlanetLabels ? 'Hide Planet Names' : 'Show Planet Names');

    planetLabels.forEach(label => {
      label.element.style.display = showPlanetLabels ? 'block' : 'none';
    });
  });
}

const moonLabelToggle = document.getElementById('moonLabelToggle');
if (moonLabelToggle) {
  moonLabelToggle.addEventListener('click', () => {
    showMoonLabels = !showMoonLabels;
    moonLabelToggle.classList.toggle('active', showMoonLabels);
    moonLabelToggle.textContent = toTitleCase(showMoonLabels ? 'Hide Moon Names' : 'Show Moon Names');

    moonLabels.forEach(label => {
      label.element.style.display = showMoonLabels ? 'block' : 'none';
    });
  });
}

const realAsteroidsBtn = document.getElementById('realAsteroidsBtn');
if (realAsteroidsBtn) {
  realAsteroidsBtn.addEventListener('click', () => {
    const isVisible = !realAsteroids[0]?.visible;
    realAsteroidsBtn.classList.toggle('active', isVisible);

    realAsteroids.forEach(asteroid => {
      asteroid.visible = isVisible;
    });
  });
}

const cometsBtn = document.getElementById('cometsBtn');
if (cometsBtn) {
  cometsBtn.addEventListener('click', () => {
    const isVisible = !cometObjects[0]?.visible;
    cometsBtn.classList.toggle('active', isVisible);

    cometObjects.forEach(comet => {
      comet.visible = isVisible;
    });
  });
}

const allAsteroidsBtn = document.getElementById('allAsteroidsBtn');
if (allAsteroidsBtn) {
  allAsteroidsBtn.addEventListener('click', () => {
    const allVisible = !asteroidBelts.inner[0]?.mesh.visible ||
      !asteroidBelts.middle[0]?.mesh.visible ||
      !asteroidBelts.outer[0]?.mesh.visible ||
      !asteroidBelts.trojans[0]?.mesh.visible ||
      !asteroidBelts.kuiper[0]?.mesh.visible ||
      !asteroidBelts.scattered[0]?.mesh.visible ||
      !asteroidBelts.oort[0]?.mesh.visible;

    allAsteroidsBtn.classList.toggle('active', allVisible);

    Object.values(asteroidBelts).forEach(belt => {
      belt.forEach(asteroid => {
        asteroid.mesh.visible = allVisible;
      });
    });

    if (mainAsteroidsBtn) mainAsteroidsBtn.classList.toggle('active', allVisible);
    if (trojansBtn) trojansBtn.classList.toggle('active', allVisible);
    if (kuiperBtn) kuiperBtn.classList.toggle('active', allVisible);
    if (scatteredBtn) scatteredBtn.classList.toggle('active', allVisible);
  });
}

const planetList = document.getElementById('planetList');
if (planetList) {
  const groupedBodies = {
    planet: celestialBodies.filter(b => b.type === 'planet'),
    dwarf: celestialBodies.filter(b => b.type === 'dwarf'),
    asteroid: celestialBodies.filter(b => b.type === 'asteroid'),
    tno: celestialBodies.filter(b => b.type === 'tno')
  };

  const typeLabels = {
    planet: 'Planets',
    dwarf: 'Dwarf Planets',
    asteroid: 'Major Asteroids',
    tno: 'Trans-Neptunian Objects'
  };

  Object.entries(groupedBodies).forEach(([type, bodies]) => {
    if (bodies.length === 0) return;

    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'categoryHeader';
    categoryHeader.innerHTML = `<strong>${toTitleCase(typeLabels[type])}</strong>`;
    planetList.appendChild(categoryHeader);

    bodies.forEach((body, localIndex) => {
      const globalIndex = celestialBodies.indexOf(body);
      const planetItem = document.createElement('div');
      planetItem.className = `planetItem ${body.type}`;

      const moonText = body.moons && body.moons.length > 0 ?
        `<br><small>Moons: ${body.moons.length}</small>` : '';

      planetItem.innerHTML = `
        <strong>${toTitleCase(body.name)}</strong>
        <br><small>Distance: ${body.dist} AU | Size: ${body.size}</small>
        <br><small>Discovered: ${body.discoveryYear}</small>
        ${moonText}
      `;

      planetItem.addEventListener('click', () => {
        const planet = planetMeshes[globalIndex];
        if (planet) {
          followingPlanet = planet;
          const distance = Math.max(body.size * 8, 15);
          followOffset.set(distance, distance * 0.5, distance);
          lastPlanetPosition.set(0, 0, 0);
          userCameraOffset.set(0, 0, 0);
          const planetPos = new THREE.Vector3();
          planet.mesh.getWorldPosition(planetPos);
          camera.position.copy(planetPos.clone().add(followOffset));
          controls.target.copy(planetPos);
          controls.update();
        }
      });

      planetList.appendChild(planetItem);
    });
  });
}

function showPlanetInfoCard(body, planetIndex) {
  const card = document.getElementById('planetInfoCard');
  const planetName = document.getElementById('planetName');
  const planetIcon = document.getElementById('planetIcon');
  const planetTypeBadge = document.getElementById('planetTypeBadge');
  const orbitalPeriod = document.getElementById('orbitalPeriod');
  const sizeRelative = document.getElementById('sizeRelative');
  const distanceFromSun = document.getElementById('distanceFromSun');
  const discoveryYear = document.getElementById('discoveryYear');
  const planetDescription = document.getElementById('planetDescription');
  const moonsSection = document.getElementById('moonsSection');
  const moonCount = document.getElementById('moonCount');
  const moonsContainer = document.getElementById('moonsContainer');

  planetIcon.textContent = '';
  planetName.textContent = toTitleCase(body.name);

  const typeLabels = {
    'planet': 'Planet',
    'dwarf': 'Dwarf Planet',
    'asteroid': 'Asteroid',
    'tno': 'Tno'
  };
  planetTypeBadge.textContent = toTitleCase(typeLabels[body.type] || 'Celestial Body');

  const orbitalPeriodYears = Math.sqrt(Math.pow(body.dist, 3));
  if (orbitalPeriodYears < 1) {
    orbitalPeriod.textContent = `${Math.round(orbitalPeriodYears * 365)} Days`;
  } else if (orbitalPeriodYears < 10) {
    orbitalPeriod.textContent = `${orbitalPeriodYears.toFixed(1)} Years`;
  } else {
    orbitalPeriod.textContent = `${Math.round(orbitalPeriodYears)} Years`;
  }

  sizeRelative.textContent = `${body.size}x Earth`;
  distanceFromSun.textContent = `${body.dist} AU`;
  discoveryYear.textContent = body.discoveryYear;
  planetDescription.textContent = body.info;

  if (body.moons && body.moons.length > 0) {
    moonsSection.style.display = 'block';
    moonCount.textContent = body.moons.length;

    moonsContainer.innerHTML = '';

    body.moons.forEach((moon, moonIndex) => {
      const moonItem = document.createElement('div');
      moonItem.className = 'moonItem';

      const orbitalPeriodDays = moon.speed > 0 ? (2 * Math.PI / moon.speed).toFixed(1) : 'Unknown';

      moonItem.innerHTML = `
        <div class="moonName">${toTitleCase(moon.name)}</div>
        <div class="moonInfo">
          Size: ${moon.size}x Earth<br>
          Distance: ${moon.dist} Planet Radii<br>
          Period: ${orbitalPeriodDays} Days
        </div>
        <div class="moonFollowBtn">
          <button class="followMoonBtn">Follow</button>
        </div>
      `;

      moonItem.style.cursor = 'pointer';
      const moonNameDiv = moonItem.querySelector('.moonName');
      const moonInfoDiv = moonItem.querySelector('.moonInfo');

      moonNameDiv.addEventListener('click', () => {
        if (moon.info) {
          alert(`${toTitleCase(moon.name)}\n\n${moon.info}`);
        }
      });

      moonInfoDiv.addEventListener('click', () => {
        if (moon.info) {
          alert(`${toTitleCase(moon.name)}\n\n${moon.info}`);
        }
      });

      const followMoonBtn = moonItem.querySelector('.followMoonBtn');
      followMoonBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const planetObj = planetMeshes[planetIndex];
        if (planetObj.moons && planetObj.moons[moonIndex]) {
          followMoon(planetObj.moons[moonIndex].mesh, moon, body.name);
          hidePlanetInfoCard();
        }
      });

      moonsContainer.appendChild(moonItem);
    });
  } else {
    moonsSection.style.display = 'none';
  }

  card.style.display = 'block';

  updateFollowButtonState(planetIndex);
}

let currentPlanetIndex = null;
let followingTarget = null;
let followingType = null;

function updateFollowButtonState(planetIndex) {
  const followBtn = document.getElementById('followPlanetBtn');
  const stopFollowBtn = document.getElementById('stopFollowBtn');
  const currentPlanet = planetMeshes[planetIndex];

  currentPlanetIndex = planetIndex;

  if (followingTarget === currentPlanet && followingType === 'planet') {
    followBtn.textContent = 'Stop Following';
    followBtn.classList.add('following');
    if (stopFollowBtn) {
      stopFollowBtn.style.display = 'block';
      stopFollowBtn.classList.add('active');
    }
  } else {
    followBtn.textContent = 'Follow Planet';
    followBtn.classList.remove('following');
    if (stopFollowBtn && !followingTarget) {
      stopFollowBtn.style.display = 'none';
      stopFollowBtn.classList.remove('active');
    }
  }
}

function followPlanet(planetIndex) {
  const body = celestialBodies[planetIndex];
  const planet = planetMeshes[planetIndex];

  followingTarget = planet;
  followingType = 'planet';
  followingPlanet = planet;
  const distance = Math.max(body.size * 8, 15);
  followOffset.set(distance, distance * 0.5, distance);
  lastPlanetPosition.set(0, 0, 0);
  userCameraOffset.set(0, 0, 0);

  controls.enableZoom = true;
  controls.minDistance = distance * 0.5;
  controls.maxDistance = distance * 3;

  updateFollowButtonState(planetIndex);

  console.log(`Now Following ${body.name}`);
}

function followMoon(moonMesh, moonData, parentPlanetName) {
  followingTarget = moonMesh;
  followingType = 'moon';
  followingPlanet = { mesh: moonMesh };
  const distance = Math.max(moonData.size * 12, 8);
  followOffset.set(distance, distance * 0.5, distance);
  lastPlanetPosition.set(0, 0, 0);
  userCameraOffset.set(0, 0, 0);

  controls.enableZoom = true;
  controls.minDistance = distance * 0.3;
  controls.maxDistance = distance * 4;

  const stopFollowBtn = document.getElementById('stopFollowBtn');
  if (stopFollowBtn) {
    stopFollowBtn.style.display = 'block';
    stopFollowBtn.classList.add('active');
  }

  console.log(`Now Following ${moonData.name} Of ${parentPlanetName}`);
}

function followSun() {
  followingTarget = sun;
  followingType = 'sun';
  followingPlanet = { mesh: sun };

  const sunPos = new THREE.Vector3();
  sun.getWorldPosition(sunPos);

  camera.position.set(sunPos.x + 25, sunPos.y + 12, sunPos.z + 25);
  controls.target.copy(sunPos);

  controls.enableZoom = true;
  controls.minDistance = 10;
  controls.maxDistance = 100;

  lastPlanetPosition.set(0, 0, 0);
  userCameraOffset.set(0, 0, 0);

  const stopFollowBtn = document.getElementById('stopFollowBtn');
  if (stopFollowBtn) {
    stopFollowBtn.style.display = 'block';
    stopFollowBtn.classList.add('active');
  }

  console.log('Now Following The Sun (Zoom Enabled)');
}

function stopFollowingPlanet() {
  followingPlanet = null;
  followingTarget = null;
  followingType = null;
  lastPlanetPosition.set(0, 0, 0);
  userCameraOffset.set(0, 0, 0);

  camera.position.set(0, 30, 70);
  controls.target.set(0, 0, 0);
  controls.reset();

  controls.enableZoom = true;
  controls.minDistance = 0.1;
  controls.maxDistance = 1000;

  hidePlanetInfoCard();

  const followBtn = document.getElementById('followPlanetBtn');
  const stopFollowBtn = document.getElementById('stopFollowBtn');

  if (followBtn) {
    followBtn.textContent = 'Follow Planet';
    followBtn.classList.remove('following');
  }

  if (stopFollowBtn) {
    stopFollowBtn.style.display = 'none';
    stopFollowBtn.classList.remove('active');
  }

  console.log('Stopped Following And Reset View');
}

function hidePlanetInfoCard() {
  const card = document.getElementById('planetInfoCard');
  card.style.display = 'none';
}

function onMouseClick(event) {
  if (event.target.closest('.controls') ||
    event.target.closest('.celestialPanel') ||
    event.target.closest('.info') ||
    event.target.closest('.planetInfoCard')) {
    return;
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  let clickableObjects = [];

  const planetMeshObjects = planetMeshes.map(p => p.mesh);
  clickableObjects = clickableObjects.concat(planetMeshObjects);

  let moonMeshes = [];
  planetMeshes.forEach((planetObj, planetIndex) => {
    if (planetObj.moons && planetObj.moons.length > 0) {
      planetObj.moons.forEach(moon => {
        moonMeshes.push({
          mesh: moon.mesh,
          moonData: moon,
          planetIndex: planetIndex,
          planetName: celestialBodies[planetIndex].name
        });
      });
    }
  });

  clickableObjects.push(sun);

  const intersects = raycaster.intersectObjects(clickableObjects);

  if (intersects.length > 0) {
    const intersectedObject = intersects[0].object;

    if (intersectedObject === sun) {
      followSun();
      return;
    }

    const planetIndex = planetMeshObjects.indexOf(intersectedObject);
    if (planetIndex !== -1) {
      const body = celestialBodies[planetIndex];
      showPlanetInfoCard(body, planetIndex);
    }
  } else {
    hidePlanetInfoCard();
  }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', onMouseClick);

document.getElementById('closePlanetInfo').addEventListener('click', hidePlanetInfoCard);

document.getElementById('followPlanetBtn').addEventListener('click', () => {
  if (currentPlanetIndex !== null) {
    if (followingTarget === planetMeshes[currentPlanetIndex] && followingType === 'planet') {
      stopFollowingPlanet();
    } else {
      followPlanet(currentPlanetIndex);
    }
  }
});

const stopFollowBtn = document.getElementById('stopFollowBtn');
if (stopFollowBtn) {
  stopFollowBtn.addEventListener('click', () => {
    stopFollowingPlanet();
  });
}

const followSunBtn = document.getElementById('followSunBtn');
if (followSunBtn) {
  followSunBtn.addEventListener('click', () => {
    followSun();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const originalPlanetItemHandler = planetItem => {
    const originalHandler = planetItem.onclick;
    planetItem.onclick = function (event) {
      if (originalHandler) originalHandler.call(this, event);

      const planetName = this.querySelector('strong').textContent;
      const planetIndex = celestialBodies.findIndex(body => toTitleCase(body.name) === planetName);
      if (planetIndex !== -1) {
        showPlanetInfoCard(celestialBodies[planetIndex], planetIndex);
      }
    };
  };
});

window.addEventListener('keydown', (event) => {
  switch (event.key.toLowerCase()) {
    case ' ':
      event.preventDefault();
      const pauseBtn = document.getElementById('pauseBtn');
      if (pauseBtn) pauseBtn.click();
      break;
    case 'r':
      stopFollowingPlanet();
      break;
    case 'f':
      stopFollowingPlanet();
      break;
    case 'o':
      const orbitsBtn = document.getElementById('orbitsBtn');
      if (orbitsBtn) orbitsBtn.click();
      break;
    case 'a':
      const asteroidButtons = [
        document.getElementById('mainAsteroidsBtn'),
        document.getElementById('trojansBtn'),
        document.getElementById('kuiperBtn'),
        document.getElementById('scatteredBtn')
      ];

      let foundVisible = false;
      for (let i = 0; i < asteroidButtons.length; i++) {
        if (asteroidButtons[i] && asteroidButtons[i].classList.contains('active')) {
          asteroidButtons[i].click();
          const nextIndex = (i + 1) % asteroidButtons.length;
          if (asteroidButtons[nextIndex]) {
            asteroidButtons[nextIndex].click();
          }
          foundVisible = true;
          break;
        }
      }

      if (!foundVisible && asteroidButtons[0]) {
        asteroidButtons[0].click();
      }
      break;
    case 'm':
      const moonsBtn = document.getElementById('moonsBtn');
      if (moonsBtn) moonsBtn.click();
      break;
    case 'h':
      const hideUIBtn = document.getElementById('hideUIBtn');
      const showUIBtn = document.getElementById('showUIBtn');
      if (hideUIBtn && showUIBtn) {
        if (showUIBtn.style.display === 'block') {
          showUIBtn.click();
        } else {
          hideUIBtn.click();
        }
      }
      break;
    case '+':
    case '=':
      event.preventDefault();
      const speedControl = document.getElementById('speedControl');
      if (speedControl) {
        const currentSpeed = parseFloat(speedControl.value);
        const newSpeed = Math.min(10, currentSpeed + 0.5);
        speedControl.value = newSpeed;
        speedControl.dispatchEvent(new Event('input'));
      }
      break;
    case '-':
      event.preventDefault();
      const speedControlDec = document.getElementById('speedControl');
      if (speedControlDec) {
        const currentSpeed = parseFloat(speedControlDec.value);
        const newSpeed = Math.max(0, currentSpeed - 0.5);
        speedControlDec.value = newSpeed;
        speedControlDec.dispatchEvent(new Event('input'));
      }
      break;
    case 'b':
      event.preventDefault();
      isBloomManual = !isBloomManual;
      const bloomModeBtn = document.getElementById('bloomModeBtn');
      if (bloomModeBtn) {
        bloomModeBtn.textContent = toTitleCase(isBloomManual ? 'Auto Bloom' : 'Manual Bloom');
        bloomModeBtn.classList.toggle('active', isBloomManual);
      }

      if (!isBloomManual) {
        console.log('Switched To Automatic Bloom Mode (Dynamic With Distance)');
      } else {
        console.log('Switched To Manual Bloom Mode (Slider Control)');
        bloomPass.strength = manualBloomStrength;
      }
      break;
  }
});

controls.enablePan = true;
controls.enableZoom = true;
controls.enableRotate = true;
controls.minDistance = 8;
controls.maxDistance = 200;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.3;
controls.target.set(0, 0, 0);

camera.position.set(0, 30, 70);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  updatePlanetLabels();
  updateMoonLabels();
});