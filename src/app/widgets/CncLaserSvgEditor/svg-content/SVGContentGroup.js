import { createSVGElement, getBBox, toString } from '../element-utils';
import { NS } from '../lib/namespaces';
// import SelectorManager from './SelectorManager';
import OperatorPoints from './OperatorPoints';
import { getTransformList } from '../element-transform';
import { recalculateDimensions } from '../element-recalculate';

class SVGContentGroup {
    counter = 0;

    selectedElements = [];

    constructor(options) {
        const { svgContent, scale } = options;

        this.svgContent = svgContent;
        this.scale = scale;

        this.backgroundGroup = document.createElementNS(NS.SVG, 'g');
        this.backgroundGroup.setAttribute('id', 'svg-data-background');

        this.group = document.createElementNS(NS.SVG, 'g');
        this.group.setAttribute('id', 'svg-data');

        this.svgContent.append(this.backgroundGroup);
        this.svgContent.append(this.group);
        // this.selectorManager = new SelectorManager({
        //     getRoot: () => this.svgContent,
        //     scale: this.scale
        // });
        this.operatorPoints = new OperatorPoints({
            getRoot: () => this.svgContent,
            scale: this.scale
        });
        this.operatorPoints = new OperatorPoints({
            getRoot: () => this.svgContent,
            scale: this.scale
        });
    }

    // for create new elem
    getId() {
        return `id${this.counter}`;
    }

    // for create new elem
    getNextId() {
        this.counter++;
        return `id${this.counter}`;
    }

    getScreenCTM() {
        return this.group.getScreenCTM();
    }

    getChildNodes() {
        return this.group.childNodes;
    }

    updateScale(scale) {
        this.operatorPoints.updateScale(scale);
        for (const childNode of this.getChildNodes()) {
            childNode.setAttribute('stroke-width', 1 / scale);
        }
    }

    svgToString() {
        const out = [];

        for (const childNode of this.group.childNodes) {
            const width = Number(childNode.getAttribute('width'));
            const height = Number(childNode.getAttribute('height'));

            const svgs = [];
            svgs.push('<svg');
            svgs.push(` width="${width}" height="${height}" xmlns="${NS.SVG}"`);
            svgs.push('>');
            const childOutput = toString(childNode, 1);
            if (childOutput) {
                svgs.push('\n');
                svgs.push(childOutput);
            }
            svgs.push('\n');
            svgs.push('</svg>');
            out.push(svgs.join(''));
        }

        return out;
    }

    findSVGElement(id) {
        return this.group.querySelector(`#${id}`);
    }

    getSelected() {
        return this.selectedElements[0];
    }

    deleteElement(elem) {
        if (elem) {
            this.operatorPoints.showGrips(false);
            this.selectedElements = this.selectedElements.filter(v => v !== elem);
            elem.remove();
        }
    }

    addSVGBackgroundElement(data) {
        if (data.attr && data.attr.id) {
            const existingElement = this.backgroundGroup.querySelector(`#${data.attr.id}`);
            if (existingElement) {
                existingElement.remove();
            }
        }
        const element = createSVGElement(data);
        this.backgroundGroup.append(element);
        return element;
    }

    addSVGElement(data) {
        if (data.attr && data.attr.id) {
            const existingElement = this.findSVGElement(data.attr.id);
            if (existingElement && data.element !== existingElement.tagName) {
                existingElement.remove();
            }
        }
        data.attr = Object.assign({
            id: this.getNextId()
        }, data.attr);
        const element = createSVGElement(data);
        this.group.append(element);
        return element;
    }

    clearSelection() {
        this.operatorPoints.showGrips(false);
        for (const elem of this.selectedElements) {
            elem.setAttribute('fill', '#e7f2fd');
        }
        this.selectedElements = [];
    }

    addToSelection(elements) {
        for (const elem of elements) {
            if (!this.selectedElements.includes(elem)) {
                console.log(elem);
                elem.setAttribute('fill', '#8888FF');
                this.selectedElements.push(elem);
            }
        }
        this.operatorPoints.resizeGrips(this.selectedElements);
        this.operatorPoints.showGrips(true);
        this.operatorPoints.resetTransformList();
    }

    // after element transform
    resetSelection(transformation) {
        this.operatorPoints.resizeGrips(this.selectedElements);
        this.setSelectorTransformList(transformation);
    }

    setSelectorTransformList(transformation) {
        this.setElementTransformList(this.operatorPoints.operatorPointsGroup, transformation);
    }

    isElementOperator(elem) {
        return elem === this.operatorPoints.operatorPointsGroup;
    }

    updateElementRotate(elem, rotate) {
        const transformList = getTransformList(elem);
        let transformRotate = null;
        let index = 0;
        for (let i = 0; i < transformList.numberOfItems; i++) {
            if (transformList.getItem(i).type === 4) {
                index = i;
                transformRotate = transformList.getItem(i);
            }
        }
        if (!transformRotate) {
            transformRotate = this.svgContent.createSVGTransform();
            transformList.appendItem(transformRotate);
        }
        transformRotate.setRotate(rotate.angle, rotate.x + rotate.width / 2, rotate.y + rotate.height / 2);
        transformList.replaceItem(transformRotate, index);

        recalculateDimensions(this.svgContent, elem);
    }

    updateElementScale(elem, scale) {
        const transformList = getTransformList(elem);
        const transformOrigin = this.svgContent.createSVGTransform();
        const transformScale = this.svgContent.createSVGTransform();
        const transformBack = this.svgContent.createSVGTransform();
        const bBox = getBBox(elem);
        transformOrigin.setTranslate(scale.x, scale.y);
        transformScale.setScale(scale.scaleX, scale.scaleY);
        transformBack.setTranslate(-bBox.x, -bBox.y);

        transformList.appendItem(transformOrigin);
        transformList.appendItem(transformScale);
        transformList.appendItem(transformBack);

        recalculateDimensions(this.svgContent, elem);
    }

    updateElementFlip(elem, flip) {
        const transformList = getTransformList(elem);
        const transformOrigin = this.svgContent.createSVGTransform();
        const transformScale = this.svgContent.createSVGTransform();
        const transformBack = this.svgContent.createSVGTransform();
        const bBox = getBBox(elem);
        transformOrigin.setTranslate(bBox.x + bBox.width, bBox.y + bBox.height);
        transformScale.setScale(((flip & 2) > 0 ? -1 : 1), ((flip & 1) > 0 ? -1 : 1));
        transformBack.setTranslate(-(bBox.x + ((flip & 2) > 0 ? 0 : bBox.width)), -(bBox.y + ((flip & 1) > 0 ? 0 : bBox.height)));

        transformList.appendItem(transformOrigin);
        transformList.appendItem(transformScale);
        transformList.appendItem(transformBack);

        recalculateDimensions(this.svgContent, elem);
    }

    updateElementTranslate(elem, translate) {
        const transformList = getTransformList(elem);
        const transform = this.svgContent.createSVGTransform();
        transform.setTranslate(translate.translateX, translate.translateY);
        transformList.insertItemBefore(transform, 0);
        recalculateDimensions(this.svgContent, elem);
    }

    selectOnly(elems) {
        this.clearSelection();
        elems && this.addToSelection(elems);
    }

    removeAllElements() {
        while (this.group.firstChild) {
            this.deleteElement(this.group.lastChild);
        }
    }

    getSelectedElementVisible() {
        const selectedElement = this.getSelected();
        return selectedElement.visible;
    }

    setSelectedElementVisible(visible) {
        const selectedElement = this.getSelected();
        selectedElement.visible = visible;
    }

    getSelectedElementUniformScalingState() {
        const selectedElement = this.getSelected();
        if (selectedElement.uniformScalingState === undefined) {
            return true;
        }
        return selectedElement.uniformScalingState;
    }

    setSelectedElementUniformScalingState(uniformScalingState) {
        const selectedElement = this.getSelected();
        selectedElement.uniformScalingState = uniformScalingState;
    }

    resetElementTransformList(element, modelGroupTransformation, dx, dy) {
        this.setElementTransformList(element, modelGroupTransformation);

        // const { positionX, positionY } = modelGroupTransformation;
        // todo move to svgModelGroup, size need
        // const center = { x: positionX, y: -positionY };
        // const translate = `translate(${center.x},${center.y})`;
        const translate = `translate(${dx},${dy})`;
        element.setAttribute('transform', translate);
        // const translate = this.svgContent.createSVGTransform();
        // translate.setTranslate(center.x, center.y);
        // const transformList = element.transform.baseVal;
        // transformList.appendItem(translate);
    }

    setElementTransformList(element, modelGroupTransformation) { // todo 暂时只用在框上，transformation数据暂时没错
        console.log('set', modelGroupTransformation);
        element.transform.baseVal.clear();
        const transformList = element.transform.baseVal;
        const elementsBBox = getBBox(element);
        const transformation = (modelGroupTransformation !== undefined ? modelGroupTransformation : ({
            positionX: elementsBBox.x + elementsBBox.width / 2,
            positionY: elementsBBox.y + elementsBBox.height / 2,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            flip: 0
        }));
        let { positionX, positionY, rotationZ, scaleX, scaleY, flip } = transformation;
        positionX = positionX ?? 0;
        positionY = positionY ?? 0;
        rotationZ = rotationZ ?? 0;
        scaleX = scaleX ?? 1;
        scaleY = scaleY ?? 1;
        flip = flip ?? 0;
        // todo move to svgModelGroup, size need
        const center = { x: 230 + positionX, y: 250 - positionY };

        const translateBack = this.svgContent.createSVGTransform();
        // translateBack.setTranslate(center.x, center.y);
        translateBack.setTranslate(0, 0);
        transformList.insertItemBefore(translateBack, 0);

        const rotate = this.svgContent.createSVGTransform();
        rotate.tag = 'rotate';
        rotate.setRotate(-rotationZ / Math.PI * 180, center.x, center.y);
        transformList.insertItemBefore(rotate, 0);

        const scale = this.svgContent.createSVGTransform();
        scale.tag = 'scale';
        scale.setScale(scaleX * ((flip & 2) ? -1 : 1) / Math.abs(scaleX), scaleY * ((flip & 1) ? -1 : 1) / Math.abs(scaleY));
        transformList.insertItemBefore(scale, 0);

        const translateOrigin = this.svgContent.createSVGTransform();
        translateOrigin.tag = 'translateOrigin';
        translateOrigin.setTranslate(0, 0);
        transformList.insertItemBefore(translateOrigin, 0);

        transformList.getItem(0).tag = 'translateBack';
    }

    getSelectedElementsBBox() {
        const allSelectedElementsBox = this.operatorPoints.getAllSelectedElementsBox();
        return getBBox(allSelectedElementsBox);
    }

    getSelectedElementsCenterPoint() {
        return this.operatorPoints.getCenterPoint();
    }

    translateSelectedElementsOnMouseDown() {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            const transform = this.svgContent.createSVGTransform();
            transform.setTranslate(0, 0);
            transformList.insertItemBefore(transform, 0);
        }
    }

    translateSelectedElementsOnMouseMove(transform) {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            transformList.replaceItem(transform, 0);
        }
    }

    rotateSelectedElementsOnMouseDown() {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            const transform = this.svgContent.createSVGTransform();
            transform.setRotate(0, 0, 0);
            transformList.insertItemBefore(transform, 0);
        }
    }

    rotateSelectedElementsOnMouseMove(transform) {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            transformList.replaceItem(transform, 0);
        }
    }

    translateSelectorOnMouseDown(transform) { // add a new transform to list
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);
        transformList.insertItemBefore(transform, 0);
    }

    translateSelectorOnMouseMove(transform) { // change the new transform
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);
        transformList.replaceItem(transform, 0);
    }

    rotateSelectorOnMouseDown() {
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);
        const transform = this.svgContent.createSVGTransform();
        transform.setRotate(0, 0, 0);
        transformList.insertItemBefore(transform, 0);
    }

    rotateSelectorOnMouseMove(transform) {
        const transformList = getTransformList(this.operatorPoints.operatorPointsGroup);
        transformList.replaceItem(transform, 0);
    }

    transformSelectorOnMouseup() {
    }

    rotateSelectedElements(rotate) {
        for (const elem of this.selectedElements) {
            const transformList = getTransformList(elem);
            const findIndex = (list, type) => {
                for (let k = 0; k < list.length; k++) {
                    if (list.getItem(k).type === type) {
                        return k;
                    }
                }
                return -1;
            };
            let idx = findIndex(transformList, 4);
            if (idx === -1) idx = transformList.numberOfItems - 1;
            transformList.replaceItem(rotate, idx);
        }
    }
}

export default SVGContentGroup;
