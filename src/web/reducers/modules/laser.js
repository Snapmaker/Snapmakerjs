// Laser reducer

import {
    WEB_CACHE_IMAGE,
    BOUND_SIZE,
    STAGE_IDLE,
    STAGE_PREVIEWED,
    STAGE_GENERATED
} from '../../constants';
import api from '../../api';

// state
const initialState = {
    stage: STAGE_IDLE,
    source: {
        image: '',
        width: 0,
        height: 0
    },
    target: {
        width: 0,
        height: 0
    },
    output: {
        gcodePath: ''
    },
    textMode: {
        text: 'ABC',
        size: 24,
        font: 'Droid Sans'
    }
    /*
    state = {
        fonts: [],
        text: 'ABC',
        font: 'Droid Sans',
        size: 14,
        lineHeight: 1.2,
        anchor: 'bottom-left'
    };*/
};

// actions
const ACTION_CHANGE_SOURCE_IMAGE = 'laser/CHANGE_SOURCE_IMAGE';
const ACTION_CHANGE_TARGET_SIZE = 'laser/CHANGE_TARGET_SIZE';
const ACTION_CHANGE_STAGE = 'laser/CHANGE_STAGE';
const ACTION_CHANGE_OUTPUT = 'laser/CHNAGE_OUTPUT';

const ACTION_TEXT_MODE_SET_STATE = 'laser/textMode/setState';

export const actions = {
    changeStage: (stage) => {
        return {
            type: ACTION_CHANGE_STAGE,
            stage
        };
    },
    changeSourceImage: (options) => {
        return {
            type: ACTION_CHANGE_SOURCE_IMAGE,
            ...options
        };
    },
    changeTargetSize: (width, height) => {
        return {
            type: ACTION_CHANGE_TARGET_SIZE,
            width,
            height
        };
    },
    changeOutputGcodePath: (gcodePath) => {
        return {
            type: ACTION_CHANGE_OUTPUT,
            gcodePath
        };
    },
    generateGcode: () => {
        return (dispatch, getState) => {
            const state = getState().laser;
            const options = {
                type: 'laser', // hard-coded laser
                mode: 'text', // hard-coded text
                source: state.source,
                target: state.target,
                textMode: state.textMode
            };
            api.generateGCode(options).then((res) => {
                // update output
                dispatch(actions.changeOutputGcodePath(res.body.gcodePath));

                // change stage
                dispatch(actions.changeStage(STAGE_GENERATED));
            }).catch((err) => {
                // log.error(String(err));
            });
        };
    },
    // text mode no-reducer setState
    textModeSetState: (state) => {
        return {
            type: ACTION_TEXT_MODE_SET_STATE,
            state
        };
    },
    textModePreview: () => {
        return (dispatch, getState) => {
            const state = getState().laser;

            const options = {
                mode: 'text',
                text: state.textMode.text,
                font: state.textMode.font,
                size: state.textMode.size
            };

            api.processImage(options)
                .then((res) => {
                    const { filename, width, height } = res.body;
                    const path = `${WEB_CACHE_IMAGE}/${filename}`;
                    dispatch(actions.changeSourceImage({
                        image: path,
                        width,
                        height
                    }));

                    const targetHeight = state.textMode.size / 72 * 25.4;
                    const targetWidth = targetHeight / height * width;
                    dispatch(actions.changeTargetSize(targetWidth, targetHeight));

                    dispatch(actions.changeStage(STAGE_PREVIEWED));
                })
                .catch((err) => {
                    console.error('error processing text', err);
                });
        };
    }
};

// reducers
export default function reducer(state = initialState, action) {
    switch (action.type) {
    case ACTION_CHANGE_STAGE: {
        return Object.assign({}, state, {
            stage: action.stage
        });
    }
    case ACTION_CHANGE_SOURCE_IMAGE: {
        return Object.assign({}, state, {
            source: {
                image: action.image,
                width: action.width,
                height: action.height
            }
        });
    }
    case ACTION_CHANGE_TARGET_SIZE: {
        const ratio = action.width / action.height;
        let { width, height } = action;
        if (width >= height && width > BOUND_SIZE) {
            width = BOUND_SIZE;
            height = BOUND_SIZE / ratio;
        }
        if (height >= width && height > BOUND_SIZE) {
            width = BOUND_SIZE * ratio;
            height = BOUND_SIZE;
        }
        return Object.assign({}, state, {
            target: {
                width: Math.round(width),
                height: Math.round(height * 1)
            }
        });
    }
    case ACTION_CHANGE_OUTPUT: {
        return Object.assign({}, state, {
            output: {
                gcodePath: action.gcodePath
            }
        });
    }
    // text mode
    case ACTION_TEXT_MODE_SET_STATE: {
        const textMode = Object.assign({}, state.textMode, action.state);
        return Object.assign({}, state, { textMode });
    }
    default:
        return state;
    }
}
