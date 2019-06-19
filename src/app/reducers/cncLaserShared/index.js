import path from 'path';
import api from '../../api';
// import Model from '../models/Model';
import { ModelInfo, DEFAULT_TEXT_CONFIG } from '../models/ModelInfoUtils';
import { checkIsAllModelsPreviewed, computeTransformationSizeForTextVector } from './helpers';
import {
    ACTION_UPDATE_STATE,
    ACTION_RESET_CALCULATED_STATE,
    ACTION_UPDATE_TRANSFORMATION,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_CONFIG
} from '../actionType';

// from: cnc/laser
export const actions = {
    updateState: (from, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            from,
            state
        };
    },

    updateTransformation: (from, transformation) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            from,
            transformation
        };
    },

    updateGcodeConfig: (from, gcodeConfig) => {
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            from,
            gcodeConfig
        };
    },

    updateConfig: (from, config) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            from,
            config
        };
    },

    render: (from) => (dispatch) => {
        dispatch(actions.updateState(
            from,
            {
                renderingTimestamp: +new Date()
            }
        ));
    },

    uploadImage: (func, file, mode, onError) => (dispatch) => {
        // check params
        if (!['cnc', 'laser'].includes(func)) {
            onError(`Params error: func = ${func}`);
            return;
        }
        if (!file) {
            onError(`Params error: file = ${file}`);
            return;
        }
        if (!['greyscale', 'bw', 'vector', 'trace'].includes(mode)) {
            onError(`Params error: mode = ${mode}`);
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { width, height, name, filename } = res.body;

                dispatch(actions.generateModel(func, name, filename, width, height, mode));
            })
            .catch((err) => {
                console.error(err);
                onError && onError(err);
            });
    },

    generateModel: (from, name, filename, width, height, mode) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { modelGroup } = getState()[from];
        // const ext = path.extname(filename).toLowerCase().substring(1);
        let modelType = 'raster';
        if (path.extname(filename).toLowerCase() === '.svg') {
            modelType = 'svg';
        }

        const modelInfo = new ModelInfo(size);
        modelInfo.setType(from);
        modelInfo.setSource(modelType, name, filename, width, height);
        modelInfo.setMode(mode);
        modelInfo.generateDefaults();

        // const model = new Model(modelInfo);
        const model = modelGroup.generateModel(modelInfo);
        modelGroup.addModel(model);
        // modelGroup.selectModel(model);
        dispatch(actions.selectModel(from, model));
        // must update tool params
        if (from === 'cnc') {
            const { toolDiameter, toolAngle } = getState().cnc.toolParams;
            // model.updateConfig({ toolDiameter });
            // model.updateConfig({ toolAngle });
            modelGroup.updateSelectedConfig({ toolDiameter });
            modelGroup.updateSelectedConfig({ toolAngle });
        }
        // set size smaller when cnc-raster-greyscale
        if (`${from}-${modelType}-${mode}` === 'cnc-raster-greyscale') {
            // model.updateTransformation({ width: 40 });
            modelGroup.updateSelectedModelTransformation({ width: 40 });
        }

        dispatch(actions.resetCalculatedState(from));
        dispatch(actions.updateState(
            from,
            {
                hasModel: true
            }
        ));

        dispatch(actions.render(from));
    },

    insertDefaultTextVector: (from) => (dispatch, getState) => {
        const { size } = getState().machine;

        api.convertTextToSvg(DEFAULT_TEXT_CONFIG)
            .then((res) => {
                const { name, filename, width, height } = res.body;
                const { modelGroup } = getState()[from];

                const modelInfo = new ModelInfo(size);
                modelInfo.setType(from);
                modelInfo.setSource('text', name, filename, width, height);
                modelInfo.setMode('vector');
                modelInfo.generateDefaults();

                // const model = new Model(modelInfo);
                const model = modelGroup.generateModel(modelInfo);
                modelGroup.addModel(model);
                // modelGroup.selectModel(model);

                dispatch(actions.selectModel(from, model));
                dispatch(actions.resetCalculatedState(from));
                dispatch(actions.updateState(
                    from,
                    {
                        hasModel: true
                    }
                ));

                const textSize = computeTransformationSizeForTextVector(modelInfo.config.text, modelInfo.config.size, { width, height });
                dispatch(actions.updateSelectedModelTransformation(
                    from,
                    { ...textSize }
                ));

                dispatch(actions.render(from));
            });
    },

    // call once
    initModelsPreviewChecker: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        const check = () => {
            const isAllModelsPreviewed = checkIsAllModelsPreviewed(modelGroup);
            dispatch(actions.updateState(
                from,
                { isAllModelsPreviewed }
            ));
            setTimeout(check, 100);
        };
        check();
    },

    getEstimatedTime: (from, type) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        const estimatedTime = modelGroup.estimatedTime;
        const totalEstimatedTime = modelGroup.totalEstimatedTime;
        // console.log('shared1 ', estimatedTime, totalEstimatedTime);
        // TODO
        dispatch(actions.updateState(
            from,
            {
                // estimatedTime: estimatedTime,
                // totalEstimatedTime: totalEstimatedTime
            }
        ));
        if (type === 'total') {
            // return modelGroup.totalEstimatedTime;
            return totalEstimatedTime;
        } else {
            return estimatedTime;
        }
    },

    getSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        dispatch(actions.updateState(
            from,
            {
                // TODO
            }
        ));
        return modelGroup.selectedModel;
    },

    getSelectedModelInfo: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        dispatch(actions.updateState(
            from,
            {
                // TODO
            }
        ));
        return modelGroup.getSelectedModelInfo();
    },

    selectModel: (from, model) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.selectModel(model);
        const { modelID } = model;

        // Copy state from model.modelInfo
        // const modelInfo = model.modelInfo;
        const modelInfo = modelGroup.getSelectedModelInfo();
        const { mode, source, config, gcodeConfig, transformation, printOrder } = modelInfo;
        const modelType = source.type;
        console.log('shared11 ', modelType);

        dispatch(actions.updateState(
            from,
            {
                // model,
                modelID,
                modelType,
                mode,
                printOrder,
                transformation,
                gcodeConfig,
                config
            }
        ));
    },

    removeSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.removeSelectedModel();
        const hasModel = (modelGroup.getModels().length > 0);
        dispatch(actions.updateState(
            from,
            {
                // model: null,
                modelID: null,
                mode: '',
                transformation: {},
                printOrder: 0,
                gcodeConfig: {},
                config: {},
                hasModel
            }
        ));
    },

    unselectAllModels: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.unselectAllModels();
        dispatch(actions.updateState(
            from,
            {
                // model: null,
                modelID: null,
                mode: '',
                transformation: {},
                printOrder: 0,
                gcodeConfig: {},
                config: {}
            }
        ));
    },

    // gcode
    // TODO
    generateGcode: (from) => (dispatch, getState) => {
        const gcodeBeans = [];
        const { modelGroup } = getState()[from];
        // bubble sort: https://codingmiles.com/sorting-algorithms-bubble-sort-using-javascript/
        const sorted = modelGroup.getModels();
        const length = sorted.length;
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < (length - i - 1); j++) {
                if (sorted[j].modelInfo.printOrder > sorted[j + 1].modelInfo.printOrder) {
                    const tmp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = tmp;
                }
            }
        }

        for (let i = 0; i < length; i++) {
            const model = sorted[i];
            const gcode = model.generateGcode();
            // const gcode = modelGroup.generateSelectedGcode();
            const modelInfo = model.modelInfo;
            const gcodeBean = {
                gcode,
                modelInfo
            };
            gcodeBeans.push(gcodeBean);
        }
        dispatch(actions.updateState(
            from,
            {
                isGcodeGenerated: true,
                gcodeBeans
            }
        ));
    },

    // Model configurations
    resetCalculatedState: (from) => {
        return {
            type: ACTION_RESET_CALCULATED_STATE,
            from
        };
    },

    updateSelectedModelPrintOrder: (from, printOrder) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.modelInfo.printOrder = printOrder;
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedPrintOrder(printOrder);

        dispatch(actions.updateState(
            from,
            { printOrder }
        ));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelSource: (from, source) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateSource(source);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedSource(source);

        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelTransformation: (from, transformation) => (dispatch, getState) => {
        // width and height are linked
        // const { model } = getState()[from];
        // model.updateTransformation(transformation);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedModelTransformation(transformation);

        // Update state
        // dispatch(actions.updateTransformation(from, model.modelInfo.transformation));
        dispatch(actions.updateTransformation(from, modelGroup.getSelectedModelInfo().transformation));
        dispatch(actions.resetCalculatedState(from));
        dispatch(actions.render(from));
    },

    updateSelectedModelGcodeConfig: (from, gcodeConfig) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateGcodeConfig(gcodeConfig);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedGcodeConfig(gcodeConfig);

        // dispatch(actions.updateGcodeConfig(from, model.modelInfo.gcodeConfig));
        dispatch(actions.updateGcodeConfig(from, modelGroup.getSelectedModelInfo().gcodeConfig));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelConfig: (from, config) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateConfig(config);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedConfig(config);
        // dispatch(actions.updateConfig(from, model.modelInfo.config));
        dispatch(actions.updateConfig(from, modelGroup.getSelectedModelInfo().config));
        dispatch(actions.resetCalculatedState(from));
    },

    // TODO
    updateAllModelConfig: (from, config) => (dispatch, getState) => {
        const { modelGroup, model } = getState()[from];
        const models = modelGroup.getModels();
        for (let i = 0; i < models.length; i++) {
            models[i].updateConfig(config);
        }
        if (model) {
            dispatch(actions.updateConfig(from, modelGroup.getSelectedModelInfo().config));
            dispatch(actions.resetCalculatedState(from));
        }
    },

    updateSelectedModelTextConfig: (from, config) => (dispatch, getState) => {
        // const { model } = getState()[from];
        const { modelGroup } = getState()[from];
        // const modelInfo = model.modelInfo;
        const modelInfo = modelGroup.getSelectedModelInfo();
        const newConfig = {
            ...modelInfo.config,
            ...config
        };
        api.convertTextToSvg(newConfig)
            .then((res) => {
                const { name, filename, width, height } = res.body;
                const source = {
                    name,
                    filename,
                    width,
                    height
                };

                const size = computeTransformationSizeForTextVector(newConfig.text, newConfig.size, { width, height });

                dispatch(actions.updateSelectedModelSource(from, source));

                dispatch(actions.updateSelectedModelTransformation(from, { ...size }));

                dispatch(actions.updateSelectedModelConfig(from, newConfig));
            });
    },

    onSetSelectedModelPosition: (from, position) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // const transformation = model.modelInfo.transformation;
        const { modelGroup } = getState()[from];
        const transformation = modelGroup.getSelectedModelInfo().transformation;
        let posX = 0;
        let posY = 0;
        const { width, height } = transformation;
        switch (position) {
            case 'Top Left':
                posX = -width / 2;
                posY = height / 2;
                break;
            case 'Top Middle':
                posX = 0;
                posY = height / 2;
                break;
            case 'Top Right':
                posX = width / 2;
                posY = height / 2;
                break;
            case 'Center Left':
                posX = -width / 2;
                posY = 0;
                break;
            case 'Center':
                posX = 0;
                posY = 0;
                break;
            case 'Center Right':
                posX = width / 2;
                posY = 0;
                break;
            case 'Bottom Left':
                posX = -width / 2;
                posY = -height / 2;
                break;
            case 'Bottom Middle':
                posX = 0;
                posY = -height / 2;
                break;
            case 'Bottom Right':
                posX = width / 2;
                posY = -height / 2;
                break;
            default:
                posX = 0;
                posY = 0;
        }
        transformation.positionX = posX;
        transformation.positionY = posY;
        transformation.rotationZ = 0;
        dispatch(actions.updateSelectedModelTransformation(from, transformation));
    },

    onFlipSelectedModel: (from, flipStr) => (dispatch, getState) => {
        // const { model } = getState()[from];
        const { modelGroup } = getState()[from];
        let flip = modelGroup.getSelectedModelInfo().transformation.flip;
        switch (flipStr) {
            case 'Vertical':
                flip ^= 1;
                break;
            case 'Horizontal':
                flip ^= 2;
                break;
            case 'Reset':
                flip = 0;
                break;
            default:
        }
        modelGroup.getSelectedModelInfo().transformation.flip = flip;
        dispatch(actions.updateSelectedModelTransformation(from, modelGroup.getSelectedModelInfo().transformation));
    },

    // callback
    onModelTransform: (from) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.onTransform();
        // model.updateTransformationFromModel();
        const { modelGroup } = getState()[from];
        modelGroup.onSelectedTransform();
        modelGroup.updateTransformationFromSelectedModel();

        dispatch(actions.updateTransformation(from, modelGroup.getSelectedModelInfo().transformation));
    },

    setAutoPreview: (from, value) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.setAutoPreview(value);
        dispatch(actions.updateState(
            from,
            {
                autoPreviewEnabled: value
            }
        ));
    },

    manualPreview: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        const models = modelGroup.getModels();
        for (let i = 0; i < models.length; i++) {
            models[i].autoPreview(true);
        }
    },

    // todo: listen config, gcodeConfig
    initSelectedModelListener: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];

        modelGroup.onSelectedModelTransformChanged = () => {
            // const { model } = getState()[from];
            // model.onTransform();
            // model.updateTransformationFromModel();
            modelGroup.onSelectedTransform();
            modelGroup.updateTransformationFromSelectedModel();

            dispatch(actions.updateTransformation(from, modelGroup.getSelectedModelInfo().transformation));
            dispatch(actions.render(from));
        };

        modelGroup.addEventListener('update', () => {
            dispatch(actions.render(from));
        });
    },

    onReceiveTaskResult: (taskResult) => async (dispatch, getState) => {
        for (const from of ['laser', 'cnc']) {
            // const state = getState()[from];
            // const { modelGroup } = state;
            const { modelGroup } = getState()[from];

            let taskModel = null;
            for (const child of modelGroup.children) {
                if (child.modelInfo.taskId === taskResult.taskId) {
                    taskModel = child;
                    break;
                }
            }

            if (taskModel !== null) {
                if (taskResult.status === 'previewed') {
                    taskModel.modelInfo.taskStatus = 'success';
                    await taskModel.loadToolPath(taskResult.filename, taskResult.taskId);
                } else if (taskResult.status === 'failed') {
                    taskModel.modelInfo.taskStatus = 'failed';
                }

                let failed = false;
                for (const child of modelGroup.children) {
                    if (child.modelInfo.taskStatus === 'failed') {
                        failed = true;
                        break;
                    }
                }

                dispatch(actions.updateState(from, {
                    previewUpdated: +new Date(),
                    previewFailed: failed
                }));
            }
        }
    }
};

export default function reducer() {
    return {};
}
