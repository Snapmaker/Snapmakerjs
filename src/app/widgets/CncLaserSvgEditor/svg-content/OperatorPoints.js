import { createSVGElement } from '../element-utils';

const GRIP_RADIUS = 8;

class OperatorPoints {
    constructor(svgFactory) {
        this.svgFactory = svgFactory;
        this.scale = svgFactory.scale;

        this.operatorPointsGroup = null;

        // copy from selector
        this.selectedElementsBox = createSVGElement({
            element: 'path',
            attr: {
                id: 'selected-elements-box',
                fill: 'none',
                stroke: '#00b7ee',
                'stroke-width': 1 / this.scale,
                'stroke-dasharray': '2, 1',
                style: 'pointer-events:none'
            }
        });

        // this holds a reference to the grip elements
        this.operatorGripCoords = {
            nw: null,
            n: null,
            ne: null,
            e: null,
            se: null,
            s: null,
            sw: null,
            w: null
        };

        this.operatorGrips = {
            nw: null,
            n: null,
            ne: null,
            e: null,
            se: null,
            s: null,
            sw: null,
            w: null
        };

        this.rotateGripConnector = null;
        this.rotateGrip = null;

        this.initGroup();
    }

    initGroup() {
        this.operatorPointsGroup = createSVGElement({
            element: 'g',
            attr: {
                id: 'operator-points-group'
            }
        });

        this.svgFactory.getRoot().append(this.operatorPointsGroup);
        this.operatorPointsGroup.append(this.selectedElementsBox);

        // grips
        for (const dir of Object.keys(this.operatorGrips)) {
            // TODO: cursor
            const grip = createSVGElement({
                element: 'circle',
                attr: {
                    id: `operator-grip-size-${dir}`,
                    // fill: '#ffffff',
                    fill: '#ffff00',
                    r: GRIP_RADIUS / this.scale,
                    'stroke-width': 2 / this.scale,
                    style: `cursor: ${dir}-resize`,
                    'pointer-events': 'all'
                }
            });
            grip.setAttribute('data-dir', dir);
            grip.setAttribute('data-type', 'resize');
            this.operatorGrips[dir] = grip;
            console.log(grip);
            this.operatorPointsGroup.append(grip);
        }

        this.rotateGripConnector = createSVGElement({
            element: 'line',
            attr: {
                id: 'operator-grip-rotate-connector',
                stroke: '#00b7ee',
                'stroke-width': 1 / this.scale
            }
        });

        this.rotateGrip = createSVGElement({
            element: 'circle',
            attr: {
                id: 'operator-grip-rotate',
                fill: '#00b7ee',
                r: GRIP_RADIUS / this.scale,
                'stroke-width': 2 / this.scale,
                style: 'cursor:url(../../images/rotate.png) 12 12, auto;'
            }
        });
        this.rotateGrip.setAttribute('data-type', 'rotate');

        this.operatorPointsGroup.append(this.rotateGripConnector);
        this.operatorPointsGroup.append(this.rotateGrip);
    }

    updateScale(scale) { // just change the engineer scale
        this.scale = scale;
        this.rotateGripConnector.setAttribute('stroke-width', 1 / this.scale);
        const ny = this.rotateGripConnector.getAttribute('y1');
        this.rotateGripConnector.setAttribute('y2', ny - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('cy', ny - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('r', GRIP_RADIUS / this.scale);
        this.rotateGrip.setAttribute('stroke-width', 2 / this.scale);
        for (const dir of Object.keys(this.operatorGrips)) {
            const grip = this.operatorGrips[dir];
            grip.setAttribute('r', GRIP_RADIUS / this.scale);
            grip.setAttribute('stroke-width', 2 / this.scale);
        }
    }

    getSelectedElementsBox() {
        return this.selectedElementsBox;
    }

    showGrips(show) {
        this.operatorPointsGroup.setAttribute('display', show ? 'inline' : 'none');
    }

    resetTransformList() {}

    updateTransform() {}

    removeGrips() {}

    resizeGrips(elements) {
        if (!elements || elements.length === 0) {
            return;
        }

        // Calculate the bounding
        let bBox = elements[0].getBBox();
        let minX = bBox.x;
        let maxX = bBox.x + bBox.width;
        let minY = bBox.y;
        let maxY = bBox.y + bBox.height;
        for (const element of elements) {
            bBox = element.getBBox();
            minX = Math.min(minX, bBox.x);
            maxX = Math.max(maxX, bBox.x + bBox.width);
            minY = Math.min(minY, bBox.y);
            maxY = Math.max(maxY, bBox.y + bBox.height);
        }

        // set 8 points for resize
        this.operatorGripCoords = {
            nw: [minX, minY],
            ne: [maxX, minY],
            sw: [minX, maxY],
            se: [maxX, maxY],
            n: [(minX + maxX) / 2, minY],
            s: [(minX + maxX) / 2, maxY],
            w: [minX, (minY + maxY) / 2],
            e: [maxX, (minY + maxY) / 2]
        };
        Object.entries(this.operatorGripCoords).forEach(([dir, coords]) => {
            const grip = this.operatorGrips[dir];
            grip.setAttribute('cx', coords[0]);
            grip.setAttribute('cy', coords[1]);
        });
        // set rotation point
        this.rotateGripConnector.setAttribute('x1', (minX + maxX) / 2);
        this.rotateGripConnector.setAttribute('y1', minY);
        this.rotateGripConnector.setAttribute('x2', (minX + maxX) / 2);
        this.rotateGripConnector.setAttribute('y2', minY - GRIP_RADIUS * 9.4 / this.scale);
        this.rotateGrip.setAttribute('cx', (minX + maxX) / 2);
        this.rotateGrip.setAttribute('cy', minY - GRIP_RADIUS * 9.4 / this.scale);

        // resize line box
        const dstr = `M${minX},${minY}
            L${maxX},${minY}
            L${maxX},${maxY}
            L${minX},${maxY} z`;
        this.selectedElementsBox.setAttribute('d', dstr);
    }

    getSelectedElementBBox() {
        return this.operatorPointsGroup.getBBox();
    }
}

export default OperatorPoints;
