window.onload = () => {
  "use strict";

  if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js");
  }
};

import './style.css'

import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://kstijikahvlsvqgryowq.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzdGlqaWthaHZsc3ZxZ3J5b3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzM5Nzk0NzQsImV4cCI6MTk4OTU1NTQ3NH0.0dcLA-H2UNc7ihLP4YcJou9dLsiBqKd9B2hnmp2BrtI"
const supabase = createClient(supabaseUrl, supabaseKey)

// supabase table plays-public
  // id: uuid
  // created_at: timestamptz
  // user_name: text
  // score: integer

// check if the user already put in his name (local storage)
if (localStorage.getItem("userName") === null || localStorage.getItem("userName") === "" || localStorage.getItem("userName") === "Anonymous") {
  const userNameInput = prompt("Please enter your name for the highscore list");
  if (userNameInput === null || userNameInput === "") {
    localStorage.setItem("userName", "Anonymous");
  } else {
    localStorage.setItem("userName", userNameInput);
  }
}
let userName = localStorage.getItem("userName");
document.getElementById("gameContainer").style.display = "none";

// load the highscore list
loadHighscoreList();

// global variables
var container,
  scene,
  camera,
  renderer,
  controls,
  sceneObjects = {},
  isMouseDown = false,
  clock,
  deltaTime,
  planeLookAt,
  headingTo = { right: 0, up: 0 },
  invertedControls = false,
  torusScore = 0,
  hasScored = false,
  startTime = null,
  timeLeft = 60,
  sun,
  water,
  isFlying = true,
  showFlightVectors = false,
  planeIsUpsideDown = false,
  invertedControlsDivTimeout = null,
  isGameOver = false,
  speed = 0;

// global constants
const torusScale = 0.2;
const torusRadius = 2 * torusScale;
const torusTube = 0.3 * torusScale;
const torusSpawnRadius = 120 * torusScale;
const torusAmount = 200;
const extraTorusAmount = 20;
const obstacleAmount = 300;
const obstacleRadius = 0.2;
const planeWingSize = 0.08;
const distanceOfCameraFromPlane = 1.5;
const basePlaneRotateFactor = 0.01;

// initialize the scene and run the animation loop after pressing start button

document.getElementById("startButton").addEventListener("click", () => {
  document.getElementById("startButton").style.display = "none";
  document.getElementById("startButton").removeEventListener("click", () => { });
  document.getElementById("highscoreList").style.display = "none";
  init().then(() => {
    animate();
  });
});

/**
 * Initializes the flight simulator game
 */
async function init() {

  document.getElementById("gameContainer").style.display = "initial";

  // config for three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // resize the renderer when the window is resized
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // add a clock
  clock = new THREE.Clock();
  deltaTime = 0;

  // add the renderer to the dom
  camera.position.set(4, 8, 17);

  initDevControls();

  placeTorusObjects();
  placeObstaclesObjects();

  // add a point light to the top of the scene
  const pointLight = new THREE.PointLight(0xffffff, 1, 1000);
  pointLight.position.set(0, torusSpawnRadius, -100);
  scene.add(pointLight);
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.5))

  // init ocean and sky
  await initOceanAndSky();

  // add the plane
  await initFlying();
  startTime = new Date().getTime();

  // add event listener on mouse click for a boost
  document.addEventListener("click", () => { speed += 10 });

  // check if the controls should be inverted
  if (localStorage.getItem("invertedControls") === "true") invertedControls = true;
  showInvertedControlsDiv();

  // add the canvas and remove the loading div
  document.getElementById("gameContainer").appendChild(renderer.domElement);
  document.getElementById("gameContainer").removeChild(document.getElementById("loading"));

}


/**
 * Initializes the ocean and sky
 * !!! This code and the textures are directly from three.js !!!
 */
async function initOceanAndSky() {

  // water
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
  water = new Water(
    waterGeometry,
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg', function (texture) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; }),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: scene.fog !== undefined
    }
  );
  water.rotation.x = - Math.PI / 2;
  scene.add(water);

  // sky
  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);
  const parameters = {
    elevation: 0.4,
    azimuth: 180
  };
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  let renderTarget;

  // sun
  const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
  const theta = THREE.MathUtils.degToRad(parameters.azimuth);
  sun = new THREE.Vector3();
  sun.setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms['sunPosition'].value.copy(sun);
  water.material.uniforms['sunDirection'].value.copy(sun).normalize();

  // environment
  if (renderTarget !== undefined) renderTarget.dispose();
  renderTarget = pmremGenerator.fromScene(sky);
  scene.environment = renderTarget.texture;
}

/**
 * Quits the game and shows a game over message
 */
async function gameOver() {

  // remove the plane
  scene.remove(sceneObjects.modelPlane);

  // stop the game
  isFlying = false;
  isGameOver = true;

  // set cursor to default
  document.body.style.cursor = "pointer";

  // show game over message and score in the middle of the screen
  const gameOverDiv = document.getElementById("gameOverDiv");
  const gameOverScreen = document.getElementById("gameOverScreen");
  gameOverScreen.style.display = "flex";
  gameOverDiv.innerHTML = "Game over! </br> Your score is: " + torusScore;

  // save the score to supabase
  await saveScore(userName, torusScore);

  // show restart button
  const restartButton = document.getElementById("restartButton");
  restartButton.onclick = () => {
    window.location.reload();
  }
}


/**
 * Inverts the controls and saves the setting in the local storage
 */
function invertControls() {
  invertedControls = !invertedControls;
  localStorage.setItem("invertedControls", invertedControls);
  showInvertedControlsDiv();
}


/**
 * Shows a alert with if the controls are inverted or not for 3 seconds
 */
function showInvertedControlsDiv() {
  const textIfTrue = "Inverted Controls: On <br/> The airplane will follow your mouse cursor. <br/> This setting is saved in your browser and can be toggled by pressing 'I'.";
  const textIfFalse = "Inverted Controls: Off <br/> The control direction is realisitc like in a real airplane. <br/> This setting is saved in your browser and can be toggled by pressing 'I'.";
  document.getElementById("invertedControls").innerHTML = invertedControls ? textIfTrue : textIfFalse;
  document.getElementById("invertedControls").style.display = "block";
  if (invertedControlsDivTimeout != null) {
    clearTimeout(invertedControlsDivTimeout);
    invertedControlsDivTimeout = null;
  }
  invertedControlsDivTimeout = setTimeout(() => {
    document.getElementById("invertedControls").style.display = "none";
  }, 3000);

  // set touch click event listener
  document.getElementById("invertedControls").ontouchstart = () => {
    invertControls();
  }

}


/**
 * Initialize developer controls / keyboard shortcuts and experimental features
 */
function initDevControls() {

  window.addEventListener("keydown", event => {
    switch (event.key) {

      case "k":
      case "K":

        // toogle vector visibility
        showFlightVectors = !showFlightVectors;

        break;

      case "f":
      case "F":

        // go back to flight school
        location.href = "/?redirect-from=flight-simulator";

        break;

      case "i":
      case "I":

        invertControls();

        break;

      case "p":
      case "P":

        // pause the game
        if (isGameOver) break;
        if (isFlying) {
          isFlying = false;
          document.getElementById("time").innerHTML = "Paused";
        } else {
          isFlying = true;
        }

        break;

    }
  });

}


/**
 * Animates the scene
 */
async function animate() {

  requestAnimationFrame(animate);

  deltaTime = clock.getDelta();

  if (isFlying) {
    handleFlying();
    handleScore();
    handleObstacleCollision();
    handlePlaneOutOfBounds();
  }
  handleTime();

  water.material.uniforms['time'].value += 0.05 * deltaTime;
  renderer.render(scene, camera);
}


/**
 * Handles the collision detection between the plane and the torus objects
 * If plane collides with a torus, the torus is removed from the scene and the score is updated
 */
function handleScore() {

  if (!sceneObjects.modelPlane) return;

  const planePosition = sceneObjects.modelPlane.position;

  if (planePosition.y < 0) {
    gameOver();
    return;
  }

  let nearestTorus = null;

  // check if plane intersects with a torus
  for (let i = 0; i < scene.children.length; i++) {
    if (scene.children[i].name !== "torus" && scene.children[i].name !== "extraTorus") continue;

    // get nearest torus
    const torus = scene.children[i];
    if (!nearestTorus) {
      nearestTorus = torus;
    } else {
      const distanceToTorus = torus.position.distanceTo(planePosition);
      const distanceToNearestTorus = nearestTorus.position.distanceTo(planePosition);
      if (distanceToTorus < distanceToNearestTorus) {
        nearestTorus = torus;
      }
    }
  }

  // check if plane intersects with the nearest torus
  const distanceToCenter = nearestTorus.position.distanceTo(planePosition);

  // check if the planes position is inside the torus
  const boundingBox = new THREE.Box3().setFromObject(nearestTorus);
  if (boundingBox.containsPoint(planePosition)) {

    // check the distance to the center of the torus
    if (distanceToCenter < torusRadius - 0.5 * torusTube && !hasScored) {
      nearestTorus.material.color.set(0x00ff00);
      nearestTorus.material.needsUpdate = true;
      torusScore = nearestTorus.name === "extraTorus" ? torusScore + 5 : torusScore + 1;
      hasScored = true;
      document.getElementById("score").innerHTML = "Score: " + torusScore;

      // remove the torus after 1 second
      setTimeout(() => {
        scene.remove(nearestTorus);
        hasScored = false;
      }, 500);
    }

    if (distanceToCenter > torusRadius - planeWingSize - 0.5 * torusTube && distanceToCenter < torusRadius + torusTube + planeWingSize) {
      gameOver();
    }
  }
}


/**
 * Decreases the time and checks if the time is up
 */
function handleTime() {

  if (isFlying == false) {
    startTime += deltaTime * 1000;
    return;
  }

  const currentTime = new Date().getTime();
  timeLeft = 60 - Math.floor((currentTime - startTime) / 1000);
  document.getElementById("time").innerHTML = "Time left: " + timeLeft;

  if (timeLeft <= 0) {
    gameOver();
  }
}


/*
 * Chechs if the plane collides with an object
 */
function handleObstacleCollision() {
  for (let i = 0; i < scene.children.length; i++) {
    if (scene.children[i].name !== "obstacle") continue;
    if (scene.children[i].position.distanceTo(sceneObjects.modelPlane.position) < obstacleRadius + planeWingSize) {
      gameOver();
    }
  }
}


/**
 * Turns the plane around if to far away from the center
 * This is to prevent the plane from flying away
 */
function handlePlaneOutOfBounds() {

  if (sceneObjects.modelPlane.position.distanceTo(new THREE.Vector3(0, 0, 0)) - 10 > torusSpawnRadius) {

    // turn the plane around
    sceneObjects.modelPlane.lookAt(new THREE.Vector3(0, 10, 0));

    // show outOfBounds div for 3 seconds
    document.getElementById("outOfBounds").style.display = "block";
    setTimeout(() => {
      document.getElementById("outOfBounds").style.display = "none";
    }, 3000);
  }
}


/**
 * Initializes the flying controls
 */
async function initFlying() {

  // as further the mouse is right/left of the cross the more the plane is moving right/left
  // headingTo = { right: int, up: int } stores values from 0 to 100 
  // headingTo = { right: -80, up: 5 } would move the plane a bit up and strongly to the left

  // change cursor to crosshair
  document.body.style.cursor = "crosshair";

  window.addEventListener("mousemove", event => {
    headingTo.right = invertedControls ? (event.clientX - window.innerWidth / 2) / 2 : - (event.clientX - window.innerWidth / 2) / 2;
    headingTo.up = invertedControls ? (window.innerHeight / 2 - event.clientY) / 2 : - (window.innerHeight / 2 - event.clientY) / 2;
    document.body.style.cursor = "crosshair";
    if (headingTo.right > 100) { headingTo.right = 100; document.body.style.cursor = "e-resize"; }
    if (headingTo.right < -100) { headingTo.right = -100; document.body.style.cursor = "w-resize"; }
    if (headingTo.up > 100) { headingTo.up = 100; document.body.style.cursor = "n-resize"; }
    if (headingTo.up < -100) { headingTo.up = -100; document.body.style.cursor = "s-resize"; }
  });

  // if its a mobile device, use touch controls
  if ((typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1)) {
    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;
    window.addEventListener("touchstart", event => {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    });
    window.addEventListener("touchmove", event => {
      touchEndX = event.touches[0].clientX;
      touchEndY = event.touches[0].clientY;
      headingTo.right = invertedControls ? (touchEndX - touchStartX) * 1 : -(touchEndX - touchStartX) * 1;
      headingTo.up = invertedControls ? (touchStartY - touchEndY) * 1 : -(touchStartY - touchEndY) * 1;
      if (headingTo.right > 100) { headingTo.right = 100; }
      if (headingTo.right < -100) { headingTo.right = -100; }
      if (headingTo.up > 100) { headingTo.up = 100; }
      if (headingTo.up < -100) { headingTo.up = -100; }
    });
  }

  await createModelPlane();

  camera.lookAt(sceneObjects.modelPlane.position);
}


/**
 * Moves the Plane and the Camera
 */
function handleFlying() {

  if (!sceneObjects.modelPlane) return;

  // get the planes lookAt vector by its quaternion
  let quaternion = sceneObjects.modelPlane.quaternion;
  let planeLookAt = new THREE.Vector3(0, 0, 1);
  planeLookAt.applyQuaternion(quaternion);
  planeLookAt.normalize();

  // planeRotationFactor
  let planeRotationFactor = basePlaneRotateFactor;
  if (planeIsUpsideDown) {
    planeRotationFactor = -basePlaneRotateFactor;
  }

  // manipulate the lookAt vector by the headingTo values
  let turnedBeyondYAxis = false;
  planeLookAt = turnVectorAroundVerticalAxis(planeLookAt, degToRad(headingTo.right * - planeRotationFactor));
  let horizontalTurn = turnVectorAroundHorizontalAxis(planeLookAt, degToRad(headingTo.up * planeRotationFactor));
  planeLookAt = horizontalTurn.newVector;
  turnedBeyondYAxis = horizontalTurn.turnedBeyondYAxis;
  if (turnedBeyondYAxis) planeIsUpsideDown = !planeIsUpsideDown;
  planeLookAt.normalize();

  // set the new lookAt vector
  let newPointToLookAt = new THREE.Vector3(sceneObjects.modelPlane.position.x + planeLookAt.x, sceneObjects.modelPlane.position.y + planeLookAt.y, sceneObjects.modelPlane.position.z + planeLookAt.z);
  sceneObjects.modelPlane.lookAt(newPointToLookAt);

  // move the plane forward (always)
  speed = calcSpeed(speed, planeLookAt.y);
  let newPlanePosition = sceneObjects.modelPlane.position.clone();
  newPlanePosition.addScaledVector(planeLookAt, speed * deltaTime);

  // apply the new position
  sceneObjects.modelPlane.position.set(newPlanePosition.x, newPlanePosition.y, newPlanePosition.z);

  // turn the camera and plane
  if (turnedBeyondYAxis) {
    camera.up.set(0, -camera.up.y, 0);
  }
  if (planeIsUpsideDown) {
    sceneObjects.modelPlane.rotateOnWorldAxis(planeLookAt, degToRad(180));
  }

  // move the camera behind the plane -lookAt
  camera.position.set(newPlanePosition.x, newPlanePosition.y, newPlanePosition.z);
  camera.position.addScaledVector(planeLookAt, -distanceOfCameraFromPlane);
  camera.lookAt(newPlanePosition);

  // tend the plane a little bit to the right/left depending on the headingTo.right value
  sceneObjects.modelPlane.rotateOnWorldAxis(planeLookAt, degToRad(headingTo.right * 0.5));
  sceneObjects.modelPlane.updateMatrixWorld();

}


/**
 * Creates the plane model and adds it to the scene
 */
async function createModelPlane() {

  const planeStartPoint = new THREE.Vector3(torusSpawnRadius * 0.5 + 2, 8, torusSpawnRadius * 0.5 + 2);

  // load the plane model
  const modelPlane = await getMeshFromBlenderModel("glb/low-poly_airplane.glb-low", "https://download1591.mediafire.com/1ukswzole2ag/2otcm1ju178d63g/basic_plane.glb");
  scene.add(modelPlane);

  /** @type { THREE.Mesh } */
  sceneObjects.modelPlane = modelPlane;

  // set the plane position
  sceneObjects.modelPlane.position.set(planeStartPoint.x, planeStartPoint.y, planeStartPoint.z);
  sceneObjects.modelPlane.scale.set(0.002, 0.003, 0.003);
  sceneObjects.modelPlane.lookAt(planeStartPoint.x - 1, planeStartPoint.y, planeStartPoint.z - 1);
}


/**
 * Calculates the speed depending on the y value of the planeLookAt vector and the previous speed
 * @param {number} v0 previous speed
 * @param {*} y y value of the planeLookAt vector 1 = straight up, -1 = straight down
 */
function calcSpeed(v0, y) {

  const g = 9.81;
  const aGravity = g * -y;
  const aThrust = 10;
  const aAirResistance = - v0 * v0 * 0.9;

  const a = aGravity + aThrust + aAirResistance;

  const v1 = v0 + a * deltaTime;

  return v1;
}


/**
 * Places torus objects in the scene at random positions
 */
function placeTorusObjects() {
  for (let i = 0; i < torusAmount + extraTorusAmount; i++) {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(torusRadius, torusTube, 16, 100),
      new THREE.MeshPhongMaterial({ color: 0xff0000 })
    );
    torus.position.set(
      (Math.random() - 0.5) * torusSpawnRadius,
      (Math.random()) * torusSpawnRadius,
      (Math.random() - 0.5) * torusSpawnRadius
    );
    torus.castShadow = true;

    // rotate the torus (either 0 or 90 degrees around the x or z or y axis)
    torus.rotation.x = Math.random() > 0.5 ? Math.PI / 2 : 0;
    torus.rotation.z = Math.random() > 0.5 ? Math.PI / 2 : 0;
    torus.rotation.y = Math.random() > 0.5 ? Math.PI / 2 : 0;
    scene.add(torus);
    torus.name = "torus";

    // if torus is in the extra torus amount, make it gold and name it "extraTorus"
    if (i >= torusAmount) {
      torus.material.color.setHex(0xffd700);
      torus.name = "extraTorus";
    }

    // check if torus intersects with another torus
    let torusIntersects = false;
    for (let j = 0; j < scene.children.length; j++) {
      const otherTorus = scene.children[j];
      if (otherTorus !== torus) {
        const distance = torus.position.distanceTo(otherTorus.position);
        if (distance < 5 * torusScale) {
          torusIntersects = true;
        }
      }
    }
    if (torusIntersects) {
      i -= 1;
      scene.remove(torus);
    }
  }
}


/**
 * Places other objects which the plane can collide with
 * Object types:
 *  - DodecahedronGeometry
 *  - IcosahedronGeometry
 *  - OctahedronGeometry
 *  - TetrahedronGeometry
 */
function placeObstaclesObjects() {
  for (let i = 0; i < obstacleAmount; i++) {

    // switch case to choose a random object type
    const randomObjectType = Math.floor(Math.random() * 4);
    let geometry;
    switch (randomObjectType) {
      case 0:
        geometry = new THREE.DodecahedronGeometry(obstacleRadius, 0);
        break;
      case 1:
        geometry = new THREE.IcosahedronGeometry(obstacleRadius, 0);
        break;
      case 2:
        geometry = new THREE.OctahedronGeometry(obstacleRadius, 0);
        break;
      case 3:
        geometry = new THREE.TetrahedronGeometry(obstacleRadius, 0);
        break;
    }

    // create the object with random grayscale color, position and rotation
    const colorVal = Math.floor(Math.random() * 255);
    const color = "rgb(" + colorVal + "," + colorVal + "," + colorVal + ")";
    const material = new THREE.MeshPhongMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      (Math.random() - 0.5) * torusSpawnRadius,
      (Math.random()) * torusSpawnRadius,
      (Math.random() - 0.5) * torusSpawnRadius
    );
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    mesh.name = "obstacle";
    scene.add(mesh);
  }

}


/**
 * Fetches a gltf model from the given url and returns it
 * @param { string } path the path to the gltf model
 * @param { string } alternativePath the path to the gltf model if the first path is not working
 * @returns { Promise<THREE.Mesh> } mesh mesh of the gltf model
 */
async function getMeshFromBlenderModel(path, alternativePath = "") {

  // @ts-ignore
  const loader = new GLTFLoader();
  let mesh;

  // check if file exists
  const response = await fetch(path);
  if (response.status === 404) {
    console.warn(`local file of model (${path}) not found`);
    if (alternativePath === "") {
      console.warn("no alternative path provided");
      console.error("model not found");
      return;
    }
    console.log(`trying to load model from alternative path (${alternativePath})`);
    path = alternativePath;
  }

  // use three.js to load the model
  await loader.load(
    path,
    (gltf) => {
      mesh = gltf.scene;
      dispatchEvent(new Event("modelLoaded"));
    },
    undefined, (error) => console.error(error)
  )

  // wait till the model is loaded
  await new Promise(resolve => addEventListener("modelLoaded", resolve, { once: true }));

  return mesh;
}


/**
 * Checks if a point is inside a mesh
 * @param { THREE.Vector3 } point point to check
 * @param { THREE.Mesh } mesh mesh to check
 * @returns { boolean } true if the point is inside the mesh
 */
function checkIfPointIsInsideMesh(point, mesh) {
  try {
    mesh.updateMatrixWorld();
    var localPt = mesh.worldToLocal(point.clone());
    return mesh.geometry?.boundingBox?.containsPoint(localPt);
  } catch (error) {
    return false;
  }
}


/**
 * Gets the vector where the camera is looking at
 * @param {THREE.PerspectiveCamera} cam camera to get the vector from
 * @returns {THREE.Vector3} vector where the camera is looking at
 */
function getCameraLookAt(cam) {
  var vector = new THREE.Vector3(0, 0, -1);
  vector.applyQuaternion(cam.quaternion);
  return vector;
}


/**
 * Converts degrees to radians
 * @param {number} deg The angle in degrees
 * @returns {number} The radian value of the given degree
 */
function degToRad(deg) {
  return deg * Math.PI / 180;
}


/**
 * Checks if two meshes are intersecting with each other
 * @param {THREE.Mesh} mesh1 first mesh to check
 * @param {THREE.Mesh} mesh2 second mesh to check
 * @returns {boolean} true if the two meshes are intersecting
 */
function checkCollision(mesh1, mesh2) {
  const box1 = new THREE.Box3().setFromObject(mesh1);
  const box2 = new THREE.Box3().setFromObject(mesh2);
  return box1.intersectsBox(box2);
}


/**
 * Creates a bounding box around the given mesh and shows it in the scene
 * @param { THREE.Mesh } mesh mesh to create the bounding box around
 */
function showBoundingBox(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  // @ts-ignore
  const boxHelper = new THREE.Box3Helper(box, 0xffff00);
  boxHelper.position.copy(mesh.position);
  scene.add(boxHelper);
}


/**
 * Turns a vector around the vertical axis (for plane movement)
 * @param { THREE.Vector3 } vector vector to turn
 * @param { number } angle angle to turn
 * @returns { THREE.Vector3 } turned vector
 */
function turnVectorAroundVerticalAxis(vector, angle) {
  let newVector = new THREE.Vector3(vector.x, vector.y, vector.z);
  newVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  return newVector;
}


/**
* Turns a vector around the horizontal axis (for plane movement)
* @param {*} vector vector to turn
* @param {*} angle angle to turn
* @returns { { newVector: THREE.Vector3, turnedBeyondYAxis: boolean  } } new vector and if the vector turned beyond the y axis (to check if the plane is upside down)
*/
function turnVectorAroundHorizontalAxis(vector, angle) {

  // get the horizontal vector
  let horizontalVector = new THREE.Vector3(vector.x, 0, vector.z);
  horizontalVector.normalize();

  if (showFlightVectors) showVector(horizontalVector, sceneObjects.modelPlane.position, "horizontalVector", 0xff0000);

  // get the vertical vector
  let verticalVector = new THREE.Vector3(0, vector.y, 0);
  verticalVector.normalize();

  if (showFlightVectors) showVector(verticalVector, sceneObjects.modelPlane.position, "verticalVector", 0x00ff00);

  // get the cross product of the horizontal and vertical vector
  let crossProduct = new THREE.Vector3();
  crossProduct.crossVectors(horizontalVector, verticalVector);
  crossProduct.normalize();

  // cross product always have to be the right vector (because of the right hand rule)
  if (crossProduct.x < 0) {
    crossProduct.x *= -1;
    crossProduct.y *= -1;
    crossProduct.z *= -1;
  }
  if (vector.z < 0) {
    crossProduct.x *= -1;
    crossProduct.y *= -1;
    crossProduct.z *= -1;
  }

  if (showFlightVectors) showVector(crossProduct, sceneObjects.modelPlane.position, "cross-product", 0x0000ff);

  // rotate the vector around the cross product
  let newVector = new THREE.Vector3(vector.x, vector.y, vector.z);
  newVector.applyAxisAngle(crossProduct, -angle);

  // check if one of the x or z values are 0 to avoid division by 0
  if (newVector.x === 0 || newVector.z === 0 || vector.x === 0 || vector.z === 0) {
    return { newVector, turnedBeyondYAxis: false };
  }

  // check if the vector turned beyond the y axis
  let turnedBeyondYAxis = false;
  if (
    (newVector.x / Math.abs(newVector.x)) !== (vector.x / Math.abs(vector.x)) ||
    (newVector.z / Math.abs(newVector.z)) !== (vector.z / Math.abs(vector.z))
  ) {
    turnedBeyondYAxis = true;
  }

  return { newVector, turnedBeyondYAxis };
}


/**
 * Shows a vector in the scene and if the vector is already shown the previous one will be removed
 * @param { THREE.Vector3 } vector vector to show
 * @param { THREE.Vector3 } position position of the vector
 * @param { string } name name of the vector
 * @param { number } color color of the vector
 */
function showVector(vector, position, name, color = 0xffffff) {
  scene.remove(scene.getObjectByName(name));
  let helper = new THREE.ArrowHelper(vector, position, 1, color);
  helper.name = name;
  scene.add(helper);
}

async function loadHighscoreList() {
  
  let { data, error } = await supabase
    .from('plays-public')
    .select('*')
    .order('score', { ascending: false })
    .limit(10)

  if (error) {
    console.log(error)
  }

  // fill the highscore list
  document.getElementById("highscoreList").innerHTML = "";
  for (let i = 0; i < data.length; i++) {
    document.getElementById("highscoreList").innerHTML += "<li>" + data[i].user_name + ": " + data[i].score + "</li>";
  }


}

async function saveScore(userName, torusScore) {
  let { data, error } = await supabase
    .from('plays-public')
    .insert([
      { user_name: userName, score: torusScore },
    ])

  if (error) {
    console.log(error)
  }

  console.log(data);
}

