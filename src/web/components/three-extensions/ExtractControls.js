/**
 * ExtractControls
 *
 * @author walker https://github.com/liumingzw
 */

import * as THREE from 'three';
import ThreeUtils from './ThreeUtils';

const SIZE = 125;

/**
 *
 * @param camera
 * @param domElement
 * @param remapBox2
 * @param cornerPositions { leftTop, leftBottom, rightBottom, rightTop }
 * @constructor
 */
THREE.ExtractControls = function (camera, domElement, remapBox2, cornerPositions) {
    THREE.Object3D.call(this);

    this.position.z = 0.1;

    // TODO: pass size to the control
    const size = SIZE;

    if (!remapBox2) {
        // TODO: hardcoded bound size
        remapBox2 = new THREE.Box2(
            new THREE.Vector2(-size / 2, -size / 2),
            new THREE.Vector2(size / 2, size / 2)
        );
    }

    if (!cornerPositions) {
        const pos = size / 2;
        cornerPositions = {
            leftTop: new THREE.Vector3(-pos, pos, 0),
            leftBottom: new THREE.Vector3(-pos, -pos, 0),
            rightBottom: new THREE.Vector3(pos, -pos, 0),
            rightTop: new THREE.Vector3(pos, pos, 0)
        };
    }

    this.enabled = true;

    let leftTopGizmo, leftBottomGizmo, rightTopGizmo, rightBottomGizmo;
    let dashedLine;
    const gizmoArr = [];
    let selectedGizmo;

    const scope = this;
    const raycaster = new THREE.Raycaster();

    function init() {
        leftTopGizmo = generateGizmo();
        leftBottomGizmo = generateGizmo();
        rightTopGizmo = generateGizmo();
        rightBottomGizmo = generateGizmo();

        scope.add(leftTopGizmo);
        scope.add(leftBottomGizmo);
        scope.add(rightTopGizmo);
        scope.add(rightBottomGizmo);

        gizmoArr.push(leftTopGizmo);
        gizmoArr.push(leftBottomGizmo);
        gizmoArr.push(rightTopGizmo);
        gizmoArr.push(rightBottomGizmo);

        leftTopGizmo.position.copy(cornerPositions.leftTop);
        leftBottomGizmo.position.copy(cornerPositions.leftBottom);
        rightTopGizmo.position.copy(cornerPositions.rightTop);
        rightBottomGizmo.position.copy(cornerPositions.rightBottom);

        const geometry = new THREE.Geometry();
        dashedLine = new THREE.Line(geometry, new THREE.LineDashedMaterial({
            color: 0x28a7e1,
            scale: 1,
            dashSize: 4,
            gapSize: 3
        }));
        scope.add(dashedLine);
        updateDashedLine();
    }

    function addListeners() {
        domElement.addEventListener('mousedown', onMouseDown, false);
        domElement.addEventListener('mousemove', onMouseMove, false);
        domElement.addEventListener('mouseup', onMouseUp, false);
    }

    function removeListeners() {
        domElement.removeEventListener('mousedown', onMouseDown, false);
        domElement.removeEventListener('mousemove', onMouseMove, false);
        domElement.removeEventListener('mouseup', onMouseUp, false);
    }

    function dispose() {
        removeListeners();
    }

    function onMouseDown(event) {
        if (!scope.enabled || !scope.visible) {
            return;
        }

        if (event.button === THREE.MOUSE.LEFT) {
            event.preventDefault();
            raycaster.setFromCamera(ThreeUtils.getMouseXY(event, domElement), camera);
            const intersects = raycaster.intersectObjects(gizmoArr);
            if (intersects.length > 0) {
                selectedGizmo = intersects[0].object;
            }
        }
    }

    function onMouseMove(event) {
        if (!scope.visible) {
            return;
        }
        event.preventDefault();
        raycaster.setFromCamera(ThreeUtils.getMouseXY(event, domElement), camera);
        const intersects = raycaster.intersectObjects(gizmoArr);
        if (intersects.length > 0) {
            domElement.style.cursor = 'all-scroll';
        } else {
            domElement.style.cursor = 'default';
        }

        if (!scope.enabled || !selectedGizmo) {
            return;
        }

        const pos = ThreeUtils.getEventWorldPosition(event, domElement, camera);

        if (pos.x < remapBox2.min.x) {
            pos.x = remapBox2.min.x;
        }
        if (pos.x > remapBox2.max.x) {
            pos.x = remapBox2.max.x;
        }
        if (pos.y < remapBox2.min.y) {
            pos.y = remapBox2.min.y;
        }
        if (pos.y > remapBox2.max.y) {
            pos.y = remapBox2.max.y;
        }

        if (selectedGizmo === leftTopGizmo) {
            if (pos.x > 0) {
                pos.x = 0;
            }
            if (pos.y < 0) {
                pos.y = 0;
            }
            selectedGizmo.position.copy(pos);
        } else if (selectedGizmo === leftBottomGizmo) {
            if (pos.x > 0) {
                pos.x = 0;
            }
            if (pos.y > 0) {
                pos.y = 0;
            }
            selectedGizmo.position.copy(pos);
        } else if (selectedGizmo === rightTopGizmo) {
            if (pos.x < 0) {
                pos.x = 0;
            }
            if (pos.y < 0) {
                pos.y = 0;
            }
            selectedGizmo.position.copy(pos);
        } else if (selectedGizmo === rightBottomGizmo) {
            if (pos.x < 0) {
                pos.x = 0;
            }
            if (pos.y > 0) {
                pos.y = 0;
            }
            selectedGizmo.position.copy(pos);
        }

        updateDashedLine();
    }

    function onMouseUp() {
        selectedGizmo = null;
    }

    function updateDashedLine() {
        const geometry = dashedLine.geometry;
        geometry.vertices = [];
        geometry.vertices.push(rightTopGizmo.position);
        geometry.vertices.push(rightBottomGizmo.position);
        geometry.vertices.push(leftBottomGizmo.position);
        geometry.vertices.push(leftTopGizmo.position);
        geometry.vertices.push(rightTopGizmo.position);
        geometry.verticesNeedUpdate = true;
        dashedLine.computeLineDistances();
    }

    function generateGizmo() {
        const gizmo = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshBasicMaterial({ color: 0x000000, visible: false, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
        );
        {
            const geometry = new THREE.CircleGeometry(2.5, 64);
            const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const circle = new THREE.Mesh(geometry, material);
            gizmo.add(circle);
        }
        {
            const geometry = new THREE.CircleGeometry(1.8, 64);
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const circle = new THREE.Mesh(geometry, material);
            gizmo.add(circle);
        }
        return gizmo;
    }

    function getCornerPositions() {
        return {
            leftTop: leftTopGizmo.position.clone(),
            leftBottom: leftBottomGizmo.position.clone(),
            rightBottom: rightBottomGizmo.position.clone(),
            rightTop: rightTopGizmo.position.clone()
        };
    }

    function resetCornerPositions() {
        rightTopGizmo.position.copy(cornerPositions.rightTop);
        rightBottomGizmo.position.copy(cornerPositions.rightBottom);
        leftTopGizmo.position.copy(cornerPositions.leftTop);
        leftBottomGizmo.position.copy(cornerPositions.leftBottom);
        updateDashedLine();
    }

    addListeners();
    init();

    // API
    this.dispose = dispose;
    this.getCornerPositions = getCornerPositions;
    this.resetCornerPositions = resetCornerPositions;
};

THREE.ExtractControls.prototype = Object.assign(Object.create(THREE.Object3D.prototype), {
    constructor: THREE.ExtractControls
});

export default THREE.ExtractControls;
