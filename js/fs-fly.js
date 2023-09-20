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

    // check if the headingTo values should be overriden by gamepad values
    if (navigator.getGamepads()[0]) {
        let gamepad = navigator.getGamepads()[0];

        let mappingFunction = (gamepadValue) => {
            if (gamepadValue > 0) return ((gamepadValue + 0.1) ** 5) * 100;
            if (gamepadValue < 0) return ((gamepadValue - 0.1) ** 5) * 100;
        };
        const deadzone = 0.2;
        if (gamepad.axes[0] > deadzone || gamepad.axes[0] < -deadzone) {
            headingTo.right = mappingFunction(gamepad.axes[0]);
        } else {
            headingTo.right = 0;
        }
        if (gamepad.axes[1] > deadzone || gamepad.axes[1] < -deadzone) {
            headingTo.up = mappingFunction(gamepad.axes[1]);
        } else {
            headingTo.up = 0;
        }

        if (gamepad.buttons[0].pressed) {
            speed += 4;
        }
    }

    // if demoMode is enabled, set the headingTo values to the demoMode values
    if (isDemoMode) {

        // old demo mode (simple)
        headingTo.right = demoModeValues.values[demoModeValues.currentIndex].right;
        headingTo.up = demoModeValues.values[demoModeValues.currentIndex].up;
        if (demoModeValues.repetitions > 200) {
            demoModeValues.currentIndex++;
            demoModeValues.repetitions = 0;
        }
        demoModeValues.repetitions++;
        if (demoModeValues.currentIndex >= demoModeValues.values.length) {
            demoModeValues.currentIndex = 0;
        }

        // new demo mode (intelligent - fly trough the nearest torus)

        const frustumIntersect = (() => {
            const p = new THREE.Vector3()

            return (frustum, box, smaller = 3) => {
                const planes = frustum.planes

                for (let i = 0; i < 6; i++) {

                    const plane = planes[i]

                    p.x = plane.normal.x > 0 ? box.max.x : box.min.x
                    p.y = plane.normal.y > 0 ? box.max.y : box.min.y
                    p.z = plane.normal.z > 0 ? box.max.z : box.min.z

                    if (plane.distanceToPoint(p) < 0 + smaller) {
                        return false
                    }
                }

                return true
            }
        })()

        let stabilizedHeadingTo = () => {
            // bring the y value to 0
            let currentY = planeLookAt.clone().y;
            console.log(currentY);
            return { right: 0, up: currentY * - 100 };
        }

        // get the nearest torus which is in front of the plane
        let nearestTorus = null;

        if (!currentChaseTorus) {
            for (let i = 0; i < scene.children.length; i++) {
                if (scene.children[i].name !== "torus" && scene.children[i].name !== "extraTorus") continue;
                // if (scene.children[i].customFields?.isHorizontal) continue;
                // check if the torus is in sight of the camera
                const torus = scene.children[i];
                const torusPosition = torus.position.clone();
                let frustum = new THREE.Frustum();
                frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    
                if (!frustumIntersect(frustum, new THREE.Box3().setFromObject(torus))) continue;
    
                // get nearest torus
                if (!nearestTorus) {
                    nearestTorus = torus;
                } else {
                    const distanceToTorus = torus.position.distanceTo(sceneObjects.modelPlane.position);
                    const distanceToNearestTorus = nearestTorus.position.distanceTo(sceneObjects.modelPlane.position);
                    if (distanceToTorus < distanceToNearestTorus) {
                        nearestTorus = torus;
                    }
                }
            }
    
            // if there is no torus in sight, do nothing
            if (!nearestTorus) headingTo = stabilizedHeadingTo();
    
            // if the nearest torus is nearer than 10, do nothing
            if (nearestTorus?.position.distanceTo(sceneObjects.modelPlane.position) < 0.3) {
                headingTo = stabilizedHeadingTo();
                nearestTorus = null;
            }
    
            // if the nearest torus is the one which should be aborted, do nothing
            if (nearestTorus === abortThisTorusChase) {
                headingTo = stabilizedHeadingTo();
                nearestTorus = null;
            }
    
            // if there is a nearest torus change color to blue with a timeout of 0.1 seconds
            if (nearestTorus) {
                const previousColor = nearestTorus.material.color.getHex();
                nearestTorus.material.color.setHex(0x0000ff);
                setTimeout(() => {
                    nearestTorus.material.color.setHex(previousColor);
                }, 100);
    
                currentChaseTorus = nearestTorus;
                setTimeout(() => {
                    currentChaseTorus = null;
                }, 5000);
            }
}


        // if there is a torus in sight, fly towards it
        if (currentChaseTorus) {
            automatedFlight = () => {

                let torusPosition = currentChaseTorus.position.clone();
                torusPosition.y = sceneObjects.modelPlane.position.y;
                let vectorToTorus = torusPosition.sub(sceneObjects.modelPlane.position);
                vectorToTorus.normalize();

                // // display the vector
                // for (let i = 0; i < scene.children.length; i++) { if (scene.children[i].name === "vectorToTorus") scene.remove(scene.children[i]) }
                // let vectorToTorusArrow = new THREE.ArrowHelper(vectorToTorus, sceneObjects.modelPlane.position, 10, 0xff0000);
                // vectorToTorusArrow.name = "vectorToTorus";
                // scene.add(vectorToTorusArrow);

                // calculate the angle between planeLookAt and vectorToTorus
                let planeLookAtClone = planeLookAt.clone();
                planeLookAtClone.y = 0;
                let angleToTorusXZ = planeLookAtClone.angleTo(vectorToTorus);
                if (planeLookAtClone.x > vectorToTorus.x) angleToTorusXZ *= -1;
                angleToTorusXZ = THREE.MathUtils.radToDeg(angleToTorusXZ);

                console.log(`angleToTorusXZ: ${angleToTorusXZ.toFixed(2)}`);
                if (angleToTorusXZ > 90 || angleToTorusXZ < -90) {
                    abortThisTorusChase = currentChaseTorus
                    headingTo = stabilizedHeadingTo();
                    return;
                }

                headingTo = { right: angleToTorusXZ * 2, up: 0 };

                // now for y (up/down)
                planeLookAtClone = planeLookAt.clone();
                torusPosition = currentChaseTorus.position.clone();
                vectorToTorus = torusPosition.sub(sceneObjects.modelPlane.position);
                vectorToTorus.x = planeLookAtClone.x;
                vectorToTorus.z = planeLookAtClone.z;
                vectorToTorus.normalize();

                // // display the vector
                // for (let i = 0; i < scene.children.length; i++) { if (scene.children[i].name === "vectorToTorus") scene.remove(scene.children[i]) }
                // vectorToTorusArrow = new THREE.ArrowHelper(vectorToTorus, sceneObjects.modelPlane.position, 10, 0x00ff00);
                // vectorToTorusArrow.name = "vectorToTorus";
                // scene.add(vectorToTorusArrow);

                // calculate the angle between planeLookAt and vectorToTorus
                let angleToTorusY = planeLookAt.angleTo(vectorToTorus);
                if (planeLookAt.y > vectorToTorus.y) angleToTorusY *= -1;
                angleToTorusY = THREE.MathUtils.radToDeg(angleToTorusY);
                
                console.log(`angleToTorusY: ${angleToTorusY.toFixed(2)}`);

                if (angleToTorusY > 90 || angleToTorusY < -90) {
                    abortThisTorusChase = currentChaseTorus
                    headingTo = stabilizedHeadingTo();
                    return;
                }

                headingTo.up = angleToTorusY * 1.8;

                if (planeLookAt.y > 0.9 || planeLookAt.y < -0.9) {
                    abortThisTorusChase = currentChaseTorus
                    headingTo = stabilizedHeadingTo();
                    return;
                }

            }; automatedFlight();
        }
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
    const modelPlane = await getMeshFromBlenderModel("public/glb/low-poly_airplane.glb-low", "https://download1591.mediafire.com/1ukswzole2ag/2otcm1ju178d63g/basic_plane.glb");
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