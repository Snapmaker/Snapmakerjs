// import { Euler, Vector3, Box3, Object3D } from 'three';
// import { Vector3, Group, MeshPhongMaterial } from 'three';
import { Vector3, Group, MeshPhongMaterial, Matrix4, Euler } from 'three';
import EventEmitter from 'events';
// import { EPSILON } from '../../constants';
import uuid from 'uuid';
import Model from './Model';

const materialNormal = new MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 30 });
const materialSelected = new MeshPhongMaterial({ color: 0xf0f0f0 });

const EVENTS = {
    UPDATE: { type: 'update' }
};

// class ModelGroup extends Object3D {
class ModelGroup extends EventEmitter {
    constructor(headType) {
        super();
        this.headType = headType;
        // this.object = new Object3D();
        this.object = new Group();
        this.showObject = new Group();

        this.models = [];

        this.selectedGroup = new Group();
        this.selectedGroup.uniformScalingState = true;
        this.object.add(this.selectedGroup);
        this.selectedModelArray = [];
        this.clipboard = [];
        this.estimatedTime = 0;
        this.selectedModelIDArray = [];

        this.candidatePoints = null;
        this._bbox = null;
    }

    setDataChangedCallback(handler) {
        this.onDataChangedCallback = handler;
    }


    _getEmptyState = () => {
        return {
            mode: '',
            hasModel: this.hasModel(),
            selectedModelIDArray: [],
            selectedModelArray: [],
            transformation: {}
        };
    };

    setUpdateHandler(handler) {
        this._updateView = handler;
    }

    onModelUpdate = () => {
        this.object.dispatchEvent(EVENTS.UPDATE);
    };

    getState() {
        this.selectedModelIDArray.splice(0);
        this.selectedModelArray.forEach((item) => {
            this.selectedModelIDArray.push(item.modelID);
        });

        return {
            selectedModelArray: this.selectedModelArray,
            selectedModelIDArray: this.selectedModelIDArray,
            estimatedTime: this.estimatedTime,
            hasModel: this.hasModel()
        };
    }

    getStateAndUpdateBoundingBox() {
        this.selectedModelIDArray = [];
        this.selectedModelArray.forEach((item) => {
            this.selectedModelIDArray.push(item.modelID);
        });

        return {
            selectedModelArray: this.selectedModelArray,
            selectedModelIDArray: this.selectedModelIDArray,
            estimatedTime: this.estimatedTime,
            hasModel: this.hasModel()
        };
    }


    getModel(modelID) {
        return this.models.find(d => d.modelID === modelID);
    }

    getModelByModelName(modelName) {
        return this.models.find(d => d.modelName === modelName);
    }

    // TODO: Unify method return type, it causes unnecessary calculations.
    getSelectedModelTransformation() {
        // todo
        if (this.selectedModelArray.length === 1) {
            return this.selectedModelArray[0].transformation;
        }
        if (this.selectedModelArray.length > 0) {
            return {
                positionX: this.selectedGroup.position.x,
                positionY: this.selectedGroup.position.y,
                scaleX: this.selectedGroup.scale.x,
                scaleY: this.selectedGroup.scale.y,
                scaleZ: this.selectedGroup.scale.z,
                uniformScalingState: this.selectedGroup.uniformScalingState,
                rotationX: this.selectedGroup.rotation.x,
                rotationY: this.selectedGroup.rotation.y,
                rotationZ: this.selectedGroup.rotation.z,
                // todo, width and height use for 2d
                width: this.selectedGroup.width,
                height: this.selectedGroup.height
            };
        } else {
            return {};
        }
    }

    changeShowOrigin() {
        // todo
        return this.selectedModelArray.length === 1 && this.selectedModelArray[0].changeShowOrigin();
    }

    hideSelectedModel() {
        const models = this.getSelectedModelArray();
        models.forEach((model) => {
            model.visible = false;
        });
        return this.getState();
    }

    showSelectedModel() {
        const models = this.getSelectedModelArray();
        models.forEach((model) => {
            model.visible = true;
        });
        return this.getState();
    }

    _removeSelectedModels() {
        const selectedArray = this.getSelectedModelArray();
        selectedArray.forEach((selected) => {
            // todo, not sure remove here
            console.log('----delete models----');
            selected.meshObject.remove(selected.modelObject3D);

            selected.meshObject.removeEventListener('update', this.onModelUpdate);
            this.models = this.models.filter(model => model !== selected);
        });
    }

    /**
     * Remove selected models and reset selected state.
     */
    // todo, remove mesh obj in 2d
    removeSelectedModel() {
        this._removeSelectedModels();
        this.unselectAllModels();
        this.onDataChangedCallback();
        return this._getEmptyState();
    }

    _removeAllModels() {
        const models = this.getModels();
        for (const model of models) {
            model.meshObject.removeEventListener('update', this.onModelUpdate);
            this.object.remove(model.meshObject);
        }
        this.models.splice(0);
    }

    /**
     * Remove all models.
     */
    removeAllModels() {
        if (this.hasModel()) {
            this._removeAllModels();
            this.unselectAllModels();
        }
        this.onDataChangedCallback();
        return this._getEmptyState();
    }

    // model.transformation.positionZ !== model.meshObject3D.position.z
    bringSelectedModelToFront() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].meshObject.position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.meshObject.position.z = (sorted.length + 2) * margin;
    }

    // keep the origin order
    sendSelectedModelToBack() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].meshObject.position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.meshObject.position.z = 0;
    }

    getSortedModelsByPositionZ() {
        // bubble sort
        const sorted = this.getModels();
        const length = sorted.length;
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < (length - i - 1); j++) {
                if (sorted[j].meshObject.position.z > sorted[j + 1].meshObject.position.z) {
                    const tmp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = tmp;
                }
            }
        }
        return sorted;
    }

    arrangeAllModels2D() {
        const generateCandidatePoints = (minX, minY, maxX, maxY, step) => {
            const computeDis = (point) => {
                return point.x * point.x + point.y * point.y;
            };

            const quickSort = (origArray) => {
                if (origArray.length <= 1) {
                    return origArray;
                } else {
                    const left = [];
                    const right = [];
                    const pivot = origArray.pop();
                    const length = origArray.length;
                    for (let i = 0; i < length; i++) {
                        if (computeDis(origArray[i]) <= computeDis(pivot)) {
                            left.push(origArray[i]);
                        } else {
                            right.push(origArray[i]);
                        }
                    }
                    return [].concat(quickSort(left), pivot, quickSort(right));
                }
            };

            const points = [];
            for (let i = 0; i <= (maxX - minX) / step; i++) {
                for (let j = 0; j <= (maxY - minY) / step; j++) {
                    points.push(
                        {
                            x: minX + step * i,
                            y: minY + step * j
                        }
                    );
                }
            }

            return quickSort(points);
        };

        const setSuitablePosition = (modelGroup, newModel, candidatePoints) => {
            // if (modelGroup.children.length === 0) {
            if (modelGroup.models.length === 0) {
                newModel.meshObject.position.x = 0;
                newModel.meshObject.position.y = 0;
                newModel.transformation.positionX = 0;
                newModel.transformation.positionY = 0;
                return;
            }

            /**
             * check whether the model.bbox intersects the bbox of modelGroup.children
             */
            const intersect = (model) => {
                for (const m of modelGroup.models) {
                    if (model.boundingBox.intersectsBox(m.boundingBox)) {
                        return true;
                    }
                }
                return false;
            };
            for (const p of candidatePoints) {
                newModel.meshObject.position.x = p.x;
                newModel.meshObject.position.y = p.y;
                newModel.transformation.positionX = p.x;
                newModel.transformation.positionY = p.y;
                newModel.computeBoundingBox();
                if (!intersect(newModel, modelGroup)) {
                    return;
                }
            }
        };
        if (!this.candidatePoints) {
            // TODO: replace with real machine size
            this.candidatePoints = generateCandidatePoints(-200, -200, 200, 200, 5);
        }
        const models = this.getModels();
        for (const model of models) {
            model.computeBoundingBox();
            this.object.remove(model.meshObject);
        }
        this.models.splice(0);
        for (const model of models) {
            setSuitablePosition(this, model, this.candidatePoints);
            this.models.push(model);
            this.object.add(model.meshObject);
        }
    }

    removeHiddenMeshObjects() {
        this.removeSelectedObjectParentMatrix();
        this.models.forEach((item) => {
            if (item.visible === true) {
                this.showObject.children.push(item.clone().meshObject);
            }
        });
        this.applySelectedObjectParentMatrix();
    }

    addHiddenMeshObjects() {
        this.showObject.children.splice(0);
    }

    setConvexGeometry(uploadName, convexGeometry) {
        const models = this.models.filter(m => m.uploadName === uploadName);
        if (models.length) {
            for (let idx = 0; idx < models.length; idx++) {
                const model = models[idx];
                model.setConvexGeometry(convexGeometry);
            }
        }
    }

    updateBoundingBox(bbox) {
        this._bbox = bbox;
    }

    totalEstimatedTime() {
        let totalEstimatedTime_ = 0;
        for (const model of this.models) {
            const estimatedTime_ = model.estimatedTime;
            if (typeof estimatedTime_ !== 'number' || !Number.isNaN(estimatedTime_)) {
                totalEstimatedTime_ += estimatedTime_;
            }
        }
        return totalEstimatedTime_;
    }

    undoRedo(models) {
        for (const model of this.models) {
            model.meshObject.removeEventListener('update', this.onModelUpdate);
            this.object.remove(model.meshObject);
            this.selectedGroup.remove(model.meshObject);
        }
        this.models.splice(0);
        for (const model of models) {
            const newModel = model.clone();
            newModel.meshObject.addEventListener('update', this.onModelUpdate);
            newModel.computeBoundingBox();
            this.models.push(newModel);
            this.object.add(newModel.meshObject);
        }
        return this._getEmptyState();
    }

    getModels() {
        const models = [];
        for (const model of this.models) {
            models.push(model);
        }
        return models;
    }


    calculateSelectedGroupPosition() {
        const maxObjectPosition = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
        const minObjectPosition = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        this.selectedGroup.children.forEach((meshObject) => {
            maxObjectPosition.x = Math.max(meshObject.position.x, maxObjectPosition.x);
            maxObjectPosition.y = Math.max(meshObject.position.y, maxObjectPosition.y);
            maxObjectPosition.z = Math.max(meshObject.position.z, maxObjectPosition.z);

            minObjectPosition.x = Math.min(meshObject.position.x, minObjectPosition.x);
            minObjectPosition.y = Math.min(meshObject.position.y, minObjectPosition.y);
        });
        if (this.selectedGroup.children.length > 1) {
            return new Vector3(
                (maxObjectPosition.x + minObjectPosition.x) / 2,
                (maxObjectPosition.y + minObjectPosition.y) / 2,
                maxObjectPosition.z
            );
        } else if (this.selectedGroup.children.length === 1) {
            return new Vector3(
                maxObjectPosition.x,
                maxObjectPosition.y,
                maxObjectPosition.z
            );
        } else {
            return new Vector3(
                0,
                0,
                0
            );
        }
    }

    applySelectedObjectParentMatrix() {
        if (this.selectedGroup.children.length === 1) {
            const meshObject = this.selectedGroup.children[0];
            this.selectedGroup.scale.copy(meshObject.scale);
            this.selectedGroup.rotation.copy(meshObject.rotation);
            this.selectedGroup.uniformScalingState = meshObject.uniformScalingState;
        }
        this.selectedGroup.updateMatrix();
        const newPosition = this.calculateSelectedGroupPosition(this.selectedGroup);
        this.selectedGroup.position.copy(newPosition);
        this.selectedGroup.updateMatrix();
        this.selectedGroup.children.forEach((eachMeshObject) => {
            eachMeshObject.applyMatrix(new Matrix4().getInverse(this.selectedGroup.matrix));
        });
    }

    removeSelectedObjectParentMatrix() {
        if (this.selectedGroup.children.length > 0) {
            this.selectedGroup.children.forEach((eachMeshObject) => {
                eachMeshObject.applyMatrix(this.selectedGroup.matrix);
            });
        }
        this.selectedGroup.children.forEach((meshObject) => {
            const model = this.models.find(d => d.meshObject === meshObject);
            model.onTransform();
        });
    }

    addSelectedModels(modelArray) {
        this.selectedGroup = new Group();
        for (const model of modelArray) {
            if (!this.selectedModelArray.includes(model)) {
                this.selectedModelArray.push(model);
            }
        }
        // TODO: why?
        this.selectedModelArray = [...this.selectedModelArray];

        let state;
        if (this.selectedModelArray.length > 0) {
            const modelState = this.getState();
            state = modelState;
        } else {
            state = this._getEmptyState();
        }
        this.onDataChangedCallback();

        return state;
    }

    emptySelectedModelArray() {
        this.selectedModelArray = [];
        this.onDataChangedCallback();
    }

    // TODO: model or modelID, need rename this method and add docs
    // use for widget
    selectModelById(modelID, isMultiSelect = false) {
        const selectModel = this.models.find(d => d.modelID === modelID);
        this.removeSelectedObjectParentMatrix();
        if (isMultiSelect) {
            if (selectModel) {
                const objectIndex = this.selectedGroup.children.indexOf(selectModel.meshObject);
                if (objectIndex === -1) {
                    this.addModelToSelectedGroup(selectModel);
                } else {
                    this.removeModelFromSelectedGroup(selectModel);
                }
            }
        } else {
            this.unselectAllModels();
            if (selectModel) {
                this.addModelToSelectedGroup(selectModel);
            }
        }
        this.resetSelectedObjectScaleAndRotation();
        this.applySelectedObjectParentMatrix();

        this.onDataChangedCallback();
        return this.getStateAndUpdateBoundingBox();
    }

    // use for canvas
    selectMultiModel(intersect, isMultiSelect) {
        this.removeSelectedObjectParentMatrix();
        if (isMultiSelect) {
            if (intersect) {
                const objectIndex = this.selectedGroup.children.indexOf(intersect.object);
                if (objectIndex === -1) {
                    const model = this.models.find(d => d.meshObject === intersect.object);
                    if (model) {
                        this.addModelToSelectedGroup(model);
                    }
                } else {
                    const model = this.models.find(d => d.meshObject === intersect.object);
                    if (model) {
                        this.removeModelFromSelectedGroup(model);
                    }
                }
            }
        } else {
            this.unselectAllModels();
            if (intersect) {
                const model = this.models.find(d => d.meshObject === intersect.object);
                if (model) {
                    this.addModelToSelectedGroup(model);
                }
            }
        }
        this.resetSelectedObjectScaleAndRotation();
        this.applySelectedObjectParentMatrix();
        this.onDataChangedCallback();
        this.emit('select');
        return this.getStateAndUpdateBoundingBox();
    }

    resetSelectedObjectScaleAndRotation() {
        if (this.selectedGroup.children.length > 1) {
            this.selectedGroup.scale.copy(new Vector3(1, 1, 1));
            this.selectedGroup.rotation.copy(new Euler(0, 0, 0));
            this.selectedGroup.uniformScalingState = true;
        }
    }

    addModelToSelectedGroup(model) {
        model.isSelected = true;
        model.meshObject.material = materialSelected;
        this.selectedModelArray.push(model);
        this.selectedGroup.add(model.meshObject);
    }

    removeModelFromSelectedGroup(model) {
        model.isSelected = false;
        model.meshObject.material = materialNormal;
        this.object.add(model.meshObject);
        this.selectedModelArray = [];
        this.selectedGroup.children.forEach((meshObject) => {
            const selectedModel = this.models.find(d => d.meshObject === meshObject);
            this.selectedModelArray.push(selectedModel);
        });
    }

    selectAllModels() {
        this.selectedModelArray = this.models;
        this.selectedModelIDArray = [];
        this.removeSelectedObjectParentMatrix();
        this.selectedModelArray.forEach((item) => {
            item.isSelected = true;
            item.meshObject.material = materialSelected;
            this.selectedGroup.add(item.meshObject);
            this.selectedModelIDArray.push(item.modelID);
        });
        this.resetSelectedObjectScaleAndRotation();
        this.applySelectedObjectParentMatrix();
        this.onDataChangedCallback();

        return {
            selectedModelArray: this.selectedModelArray,
            selectedGroup: this.selectedGroup,
            selectedModelIDArray: this.selectedModelIDArray
        };
    }

    unselectAllModels() {
        this.selectedModelArray = [];
        this.selectedModelIDArray = [];
        this.selectedGroup.children.splice(0);
        this.models.forEach((model) => {
            model.isSelected = false;
            model.meshObject.material = materialNormal;
            this.object.add(model.meshObject);
        });
    }

    arrangeAllModels() {
        const models = this.getModels();
        for (const model of models) {
            this.object.remove(model.meshObject);
        }
        this.models.splice(0);

        for (const model of models) {
            model.stickToPlate();
            model.meshObject.position.x = 0;
            model.meshObject.position.y = 0;
            const point = this._computeAvailableXY(model);
            model.meshObject.position.x = point.x;
            model.meshObject.position.y = point.y;
            model.meshObject.updateMatrix();
            // this.add(model);
            this.models.push(model);
            this.object.add(model.meshObject);
        }
        return this.getStateAndUpdateBoundingBox();
    }

    duplicateSelectedModel(modelID) {
        const modelsToCopy = this.selectedModelArray;
        if (modelsToCopy.length === 0) return this._getEmptyState();

        this.removeSelectedObjectParentMatrix();

        // Unselect all models
        this.unselectAllModels();

        modelsToCopy.forEach((model) => {
            const newModel = model.clone();

            if (model.sourceType === '3d') {
                newModel.stickToPlate();
                newModel.modelName = newModel.createNewModelName(this);
                newModel.meshObject.position.x = 0;
                newModel.meshObject.position.y = 0;
                const point = this._computeAvailableXY(newModel);
                newModel.meshObject.position.x = point.x;
                newModel.meshObject.position.y = point.y;
                newModel.meshObject.updateMatrix();

                newModel.modelID = modelID || uuid.v4();
            } else {
                newModel.meshObject.addEventListener('update', this.onModelUpdate);
                newModel.modelID = modelID || uuid.v4();
                newModel.computeBoundingBox();
                newModel.updateTransformation({
                    positionX: 0,
                    positionY: 0,
                    positionZ: 0
                });
            }

            this.models.push(newModel);
            this.object.add(newModel.meshObject);
            this.addModelToSelectedGroup(newModel);
        });
        this.applySelectedObjectParentMatrix();

        return this.getStateAndUpdateBoundingBox();
    }

    /**
     * Copy action: copy selected models (simply save the objects without their current positions).
     */
    copy() {
        this.removeSelectedObjectParentMatrix();

        this.clipboard = this.selectedModelArray.map(model => model.clone());

        this.applySelectedObjectParentMatrix();
    }

    /**
     * Paste action: paste(duplicate) models in clipboard.
     */
    paste() {
        const modelsToCopy = this.clipboard;
        if (modelsToCopy.length === 0) return this._getEmptyState();

        this.removeSelectedObjectParentMatrix();

        // Unselect all models
        this.unselectAllModels();

        // paste objects from clipboard
        // TODO: paste all objects from clipboard without losing their relative positions
        modelsToCopy.forEach((model) => {
            const newModel = model.clone();

            if (newModel.sourceType === '3d') {
                newModel.stickToPlate();
                newModel.modelName = newModel.createNewModelName(this);
                newModel.meshObject.position.x = 0;
                newModel.meshObject.position.y = 0;
                const point = this._computeAvailableXY(newModel);
                newModel.meshObject.position.x = point.x;
                newModel.meshObject.position.y = point.y;
                // Once the position of selectedGroup is changed, updateMatrix must be called
                newModel.meshObject.updateMatrix();

                newModel.modelID = uuid.v4();

                this.models.push(newModel);
                this.object.add(newModel.meshObject);
                this.addModelToSelectedGroup(newModel);
            }
        });
        this.applySelectedObjectParentMatrix();

        return this.getStateAndUpdateBoundingBox();
    }

    // todo, remove it
    getSelectedModel() {
        if (this.selectedModelArray.length === 1) {
            return this.selectedModelArray[0];
        }
        // if (this.selectedModel) {
        //     return this.selectedModel;
        // }

        // todo
        return this.MOCK_MODEL;
    }

    getSelectedModelArray() {
        return this.selectedModelArray;
    }

    updateSelectedMode(mode, config, processImageName) {
        // todo
        this.selectedModelArray.length === 1 && this.selectedModelArray[0].processMode(mode, config, processImageName);
        return this._getEmptyState();
    }

    generateModel(modelInfo) {
        this.addModel(modelInfo);
        return this._getEmptyState();
    }

    updateSelectedSource(source) {
        // todo
        if (this.selectedModelArray.length === 1) {
            this.selectedModelArray[0].updateSource(source);
        }
    }


    layFlatSelectedModel() {
        const selected = this.getSelectedModelArray();
        if (selected.length === 0) {
            return null;
        }
        this.removeSelectedObjectParentMatrix();
        selected.forEach((item) => {
            item.layFlat();
            item.computeBoundingBox();
        });
        this.applySelectedObjectParentMatrix();
        return this.getState();
    }

    onModelTransform() {
        this.selectedModelIDArray.splice(0);
        this.selectedModelArray.forEach((item) => {
            this.selectedModelIDArray.push(item.modelID);
            item.onTransform();
        });
        const { sourceType, mode, transformation, boundingBox, originalName } = this.selectedModelArray[0];
        return {
            sourceType: sourceType,
            originalName: originalName,
            mode: mode,
            selectedModelIDArray: this.selectedModelIDArray,
            transformation: { ...transformation },
            boundingBox, // only used in 3dp
            hasModel: this.hasModel()
        };
    }

    updateSelectedModelTransformation(transformation) {
        const { positionX, positionY, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, width, height, uniformScalingState } = transformation;

        // todo, width and height use for 2d
        if (width !== undefined) {
            this.selectedGroup.width = width;
        }
        if (height !== undefined) {
            this.selectedGroup.height = height;
        }

        if (positionX !== undefined) {
            this.selectedGroup.position.setX(positionX);
        }
        if (positionY !== undefined) {
            this.selectedGroup.position.setY(positionY);
        }
        if (this.selectedGroup.uniformScalingState === true) {
            if (scaleX !== undefined) {
                this.selectedGroup.scale.set(scaleX, scaleX, scaleX);
            }
            if (scaleY !== undefined) {
                this.selectedGroup.scale.set(scaleY, scaleY, scaleY);
            }
            if (scaleZ !== undefined) {
                this.selectedGroup.scale.set(scaleZ, scaleZ, scaleZ);
            }
        } else {
            if (scaleX !== undefined) {
                this.selectedGroup.scale.setX(scaleX);
            }
            if (scaleY !== undefined) {
                this.selectedGroup.scale.setY(scaleY);
            }
            if (scaleZ !== undefined) {
                this.selectedGroup.scale.setZ(scaleZ);
            }
        }
        if (uniformScalingState !== undefined) {
            if (this.selectedGroup.children.length === 1) {
                this.selectedGroup.children[0].uniformScalingState = uniformScalingState;
            } else {
                this.selectedGroup.uniformScalingState = uniformScalingState;
            }
        }
        if (rotationX !== undefined) {
            this.selectedGroup.rotation.x = rotationX;
        }
        if (rotationY !== undefined) {
            this.selectedGroup.rotation.y = rotationY;
        }
        if (rotationZ !== undefined) {
            this.selectedGroup.rotation.z = rotationZ;
        }
        this.selectedGroup.updateMatrix();
        this.selectedGroup.shouldUpdateBoundingbox = false;

        this.onDataChangedCallback();
    }

    // model transformation triggered by controls
    onModelAfterTransform() {
        const selectedModelArray = this.selectedModelArray;
        this.removeSelectedObjectParentMatrix();
        selectedModelArray.forEach((selected) => {
            if (selected.sourceType === '3d') {
                selected.stickToPlate();
            }
            selected.computeBoundingBox();
            if (selected.sourceType !== '3d') { // all 2d types, like svg, raster, so on
                selected.updateAndRefresh(this.selectedGroup);
            }
        });
        this._checkAnyModelOversteppedOrSelected();
        this.applySelectedObjectParentMatrix();
        this.selectedGroup.shouldUpdateBoundingbox = true;

        if (selectedModelArray.length === 0) {
            return null;
        } else {
            return this.getState();
        }
    }

    updateSelectedConfig(config, processImageName) {
        // todo
        if (this.selectedModelArray.length === 1) {
            this.selectedModelArray[0].updateConfig(config, processImageName);
        }
    }

    showAllModelsObj3D() {
        this.object.visible = true;
        for (const model of this.getModels()) {
            model.updateVisible(true);
        }
    }

    _computeAvailableXY(model) {
        if (this.getModels().length === 0) {
            return { x: 0, y: 0 };
        }

        model.computeBoundingBox();
        const modelBox3 = model.boundingBox;
        const box3Arr = [];
        for (const m of this.getModels()) {
            m.computeBoundingBox();
            box3Arr.push(m.boundingBox);
        }

        const length = Math.max(this._bbox.max.x - this._bbox.min.x, this._bbox.max.y - this._bbox.min.y);
        const step = 5; // min distance of models &
        const z = 1;
        for (let stepCount = 1; stepCount < length / step; stepCount++) {
            // check the 4 positions on x&z axis first
            const positionsOnAxis = [
                new Vector3(0, stepCount * step, z),
                new Vector3(0, -stepCount * step, z),
                new Vector3(stepCount * step, 0, z),
                new Vector3(-stepCount * step, 0, z)
            ];
            // clock direction
            const p1 = new Vector3(stepCount * step, stepCount * step, z);
            const p2 = new Vector3(stepCount * step, -stepCount * step, z);
            const p3 = new Vector3(-stepCount * step, -stepCount * step, z);
            const p4 = new Vector3(-stepCount * step, stepCount * step, z);
            const positionsOnSquare = this._getCheckPositions(p1, p2, p3, p4, step);
            const checkPositions = [].concat(positionsOnAxis);

            // no duplicates
            // TODO: what is this?
            for (const item of positionsOnSquare) {
                if (!(item.x === 0 || item.y === 0)) {
                    checkPositions.push(item);
                }
            }

            // {
            //     const geometry = new Geometry();
            //     for (const vector3 of checkPositions) {
            //         geometry.vertices.push(vector3);
            //     }
            //     const material = new PointsMaterial({ color: 0xff0000 });
            //     const points = new Points(geometry, material);
            //     points.position.y = -1;
            //     this.add(points);
            // }
            for (const position of checkPositions) {
                const modelBox3Clone = modelBox3.clone();
                modelBox3Clone.translate(new Vector3(position.x, position.y, 0));
                if (modelBox3Clone.min.x < this._bbox.min.x
                    || modelBox3Clone.max.x > this._bbox.max.x
                    || modelBox3Clone.min.y < this._bbox.min.y
                    || modelBox3Clone.max.y > this._bbox.max.y) {
                    continue;
                }
                if (!this._isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                    return { x: position.x, y: position.y };
                }
            }
        }
        // if there is not suitable position to sit on the flat
        // set the model to the right out of the flat
        for (let stepCount = length / 2; stepCount < length * 3; stepCount += step) {
            const modelBox3Clone = modelBox3.clone();
            modelBox3Clone.translate(new Vector3(stepCount, 0, 0));
            if (!this._isBox3IntersectOthers(modelBox3Clone, box3Arr)) {
                return { x: stepCount, y: 0 };
            }
        }
        // too far from flat, get a result in the center
        return { x: 0, y: 0 };
    }

    getAllBoundingBox() {
        const boundingBox = { max: { x: null, y: null, z: null }, min: { x: null, y: null, z: null } };
        for (const model of this.models) {
            let modelBoundingBox;
            if (model.headType === '3dp') {
                modelBoundingBox = model.boundingBox;
            } else {
                modelBoundingBox = {
                    max: {
                        x: model.transformation.positionX + model.transformation.width / 2,
                        y: model.transformation.positionY + model.transformation.height / 2,
                        z: 0
                    },
                    min: {
                        x: model.transformation.positionX - model.transformation.width / 2,
                        y: model.transformation.positionY - model.transformation.height / 2,
                        z: 0
                    }
                };
            }
            boundingBox.max.x = boundingBox.max.x ? Math.max(boundingBox.max.x, modelBoundingBox.max.x) : modelBoundingBox.max.x;
            boundingBox.max.y = boundingBox.max.y ? Math.max(boundingBox.max.y, modelBoundingBox.max.y) : modelBoundingBox.max.y;
            boundingBox.max.z = boundingBox.max.z ? Math.max(boundingBox.max.z, modelBoundingBox.max.z) : modelBoundingBox.max.z;
            boundingBox.min.x = boundingBox.min.x ? Math.min(boundingBox.min.x, modelBoundingBox.min.x) : modelBoundingBox.min.x;
            boundingBox.min.y = boundingBox.min.y ? Math.min(boundingBox.min.y, modelBoundingBox.min.y) : modelBoundingBox.min.y;
            boundingBox.min.z = boundingBox.min.z ? Math.min(boundingBox.min.z, modelBoundingBox.min.z) : modelBoundingBox.min.z;
        }
        return boundingBox;
    }

    _checkAnyModelOversteppedOrSelected() {
        let isAnyModelOverstepped = false;
        for (const model of this.getModels()) {
            if (model.sourceType === '3d') {
                const overstepped = this._checkOverstepped(model);
                model.setOversteppedAndSelected(overstepped, model.isSelected);
                isAnyModelOverstepped = (isAnyModelOverstepped || overstepped);
            }
        }
        return isAnyModelOverstepped;
    }

    _checkOverstepped(model) {
        let isOverstepped = false;
        model.computeBoundingBox();
        isOverstepped = this._bbox && !this._bbox.containsBox(model.boundingBox);
        return isOverstepped;
    }

    hasModel() {
        return this.getModels().length > 0;
    }

    // not include p1, p2
    _getPositionBetween(p1, p2, step) {
        const positions = [];
        if (p1.x !== p2.x) {
            const y = p1.y;
            const minX = Math.min(p1.x, p2.x) + step;
            const maxX = Math.max(p1.x, p2.x);
            for (let x = minX; x < maxX; x += step) {
                positions.push(new Vector3(x, y, 1));
            }
        } else if (p1.y !== p2.y) {
            const x = p1.x;
            const minY = Math.min(p1.y, p2.y) + step;
            const maxY = Math.max(p1.y, p2.y);
            for (let y = minY; y < maxY; y += step) {
                positions.push(new Vector3(x, y, 1));
            }
        }
        return positions;
    }

    _getCheckPositions(p1, p2, p3, p4, step) {
        const arr1 = this._getPositionBetween(p1, p2, step);
        const arr2 = this._getPositionBetween(p2, p3, step);
        const arr3 = this._getPositionBetween(p3, p4, step);
        const arr4 = this._getPositionBetween(p4, p1, step);
        return [p1].concat(arr1, [p2], arr2, [p3], arr3, arr4, [p4]);
    }

    _isBox3IntersectOthers(box3, box3Arr) {
        // check intersect with other box3
        for (const otherBox3 of box3Arr) {
            if (box3.intersectsBox(otherBox3)) {
                return true;
            }
        }
        return false;
    }

    cloneModels() {
        this.removeSelectedObjectParentMatrix();
        const newModels = this.models.map(d => d.clone());
        this.applySelectedObjectParentMatrix();
        return newModels;
    }


    addModel(modelInfo, relatedModels = {}) {
        const model = new Model(modelInfo, this);
        model.meshObject.addEventListener('update', this.onModelUpdate);
        model.generateModelObject3D();
        model.processMode(modelInfo.mode, modelInfo.config);

        if (model.sourceType === '3d' && model.transformation.positionX === 0 && model.transformation.positionY === 0) {
            model.stickToPlate();
            const point = this._computeAvailableXY(model);
            model.meshObject.position.x = point.x;
            model.meshObject.position.y = point.y;
        }
        model.computeBoundingBox();

        // add to group and select
        this.models.push(model);
        // todo, use this to refresh obj list
        this.models = [...this.models];
        this.object.add(model.meshObject);
        if (model.sourceType === '3d') {
            this.selectModelById(model.modelID);
        }

        this.emit('add', model);
        model.setRelatedModels(relatedModels);
        // refresh view
        this.onDataChangedCallback();

        return model;
    }

    modelChanged() {
        this.onDataChangedCallback();
    }
}

ModelGroup.prototype.MOCK_MODEL = {
    mock: true,
    sourceType: '',
    mode: '',
    config: {},
    transformation: {
        rotationZ: 0,
        width: 0,
        height: 0,
        positionX: 0,
        positionY: 0,
        flip: 0
    }
};

export default ModelGroup;
