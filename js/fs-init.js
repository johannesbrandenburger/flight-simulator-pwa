/**
 * Initializes the flight simulator game
 */
async function init() {

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

    initStats();
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
    checkForPlaneCollision = false;

    // add event listener on mouse click for a boost
    document.addEventListener("click", () => { speed += 10 });

    // check if the controls should be inverted
    if (localStorage.getItem("invertedControls") === "true") invertedControls = true;
    showInvertedControlsDiv();

    // add the canvas and remove the loading div
    document.body.appendChild(renderer.domElement);
    document.body.removeChild(document.getElementById("loading"));

}


/**
 * Initializes the ocean and sky
 * !!! This code and the textures are directly from three.js !!!
 */
async function initOceanAndSky() {

    // water
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    water = new THREE.Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('/public/textures/waternormals.jpg', function (texture) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; }),
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
    const sky = new THREE.Sky();
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
 * Initialize the FPS stats
 */
function initStats() {
    stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '10px';
    stats.domElement.style.top = '80px';
    stats.domElement.id = "stats";
    stats.domElement.style.display = "none";
    document.body.appendChild(stats.domElement);
}


/**
 * Quits the game and shows a game over message
 */
function gameOver() {

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

    // show restart button
    const restartButton = document.getElementById("restartButton");
    restartButton.onclick = () => {
        location.reload();
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
    const impressum = '<br/><a href="https://impressum.brandenburger.dev/">Impressum</a>'
    document.getElementById("invertedControls").innerHTML = (invertedControls ? textIfTrue : textIfFalse) + impressum;
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

            case "j":
            case "J":

                // toggle stats visibility
                stats.domElement.style.display = stats.domElement.style.display === "none" ? "block" : "none";

                break;

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
                pauseGame();

                break;

        }
    });

}

function pauseGame() {
    if (isGameOver) return;
    if (isFlying) {
        isFlying = false;
        document.getElementById("time").innerHTML = "Paused";
    } else {
        isFlying = true;
    }
}
