import React, { Component } from 'react';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';

import { EPSILON } from '../../constants';
import controller from '../../lib/controller';
import { toFixed } from '../../lib/numeric-utils';
import i18n from '../../lib/i18n';
import ProgressBar from '../../components/ProgressBar';
import Space from '../../components/Space';
import ContextMenu from '../../components/ContextMenu';

import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import PrimaryToolbar from '../CanvasToolbar/PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import { actions } from '../../reducers/cncLaserShared';
import styles from '../styles.styl';


function humanReadableTime(t) {
    const hours = Math.floor(t / 3600);
    const minutes = Math.ceil((t - hours * 3600) / 60);
    return (hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`);
}


class Visualizer extends Component {
    static propTypes = {
        hasModel: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
<<<<<<< HEAD
        model: PropTypes.object,
=======
        // model: PropTypes.object,
        modelID: PropTypes.string,
        transformation: PropTypes.object,
>>>>>>> model api
        backgroundGroup: PropTypes.object.isRequired,
        modelGroup: PropTypes.object.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,

        // func
        getEstimatedTime: PropTypes.func.isRequired,
        getSelectedModel: PropTypes.func.isRequired,
        getSelectedModelInfo: PropTypes.func.isRequired,

        onSetSelectedModelPosition: PropTypes.func.isRequired,
        onFlipSelectedModel: PropTypes.func.isRequired,
        selectModel: PropTypes.func.isRequired,
        unselectAllModels: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        onModelTransform: PropTypes.func.isRequired
    };

    contextMenuRef = React.createRef();

    visualizerRef = React.createRef();

    printableArea = null;

    canvas = React.createRef();

    state = {
        coordinateVisible: true,
        progress: 0
    };

    actions = {
        // canvas header
        switchCoordinateVisibility: () => {
            const visible = !this.state.coordinateVisible;
            this.setState(
                { coordinateVisible: visible },
                () => {
                    this.printableArea.changeCoordinateVisibility(visible);
                }
            );
        },
        // canvas footer
        zoomIn: () => {
            this.canvas.current.zoomIn();
        },
        zoomOut: () => {
            this.canvas.current.zoomOut();
        },
        autoFocus: () => {
            this.canvas.current.autoFocus();
        },
        onSelectModel: (model) => {
            this.props.selectModel(model);
        },
        onUnselectAllModels: () => {
            this.props.unselectAllModels();
        },
        onModelAfterTransform: () => {
        },
        onModelTransform: () => {
            this.props.onModelTransform();
        },
        // context menu
        bringToFront: () => {
            this.props.modelGroup.bringSelectedModelToFront();
        },
        sendToBack: () => {
            this.props.modelGroup.sendSelectedModelToBack();
        },
        onUpdateSelectedModelPosition: (position) => {
            this.props.onSetSelectedModelPosition(position);
        },
        deleteSelectedModel: () => {
            this.props.removeSelectedModel();
            this.setState({
                progress: 0
            });
        },
        arrangeAllModels: () => {
            this.props.modelGroup.arrangeAllModels2D();
        }
    };

    controllerEvents = {
        'task:completed': () => {
            this.setState({
                progress: 1.0
            });
        },
        'task:progress': (progress) => {
            if (Math.abs(progress - this.state.progress) > 0.05) {
                this.setState({
                    progress: progress
                });
            }
        }
    };

    constructor(props) {
        super(props);

        const size = props.size;
        this.printableArea = new PrintablePlate(size);
    }

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    componentDidMount() {
        // this.visualizerRef.current.addEventListener('mousedown', this.hideContextMenu, false);
        // this.visualizerRef.current.addEventListener('wheel', this.hideContextMenu, false);
        // this.visualizerRef.current.addEventListener('contextmenu', this.showContextMenu, false);
        this.addControllerEvents();

        // this.visualizerRef.current.addEventListener('mouseup', (e) => {
        //     const event = simulateMouseEvent(e, 'contextmenu');
        //     this.visualizerRef.current.dispatchEvent(event);
        // }, false);

        this.canvas.current.resizeWindow();
        this.canvas.current.disable3D();

        window.addEventListener(
            'hashchange',
            (event) => {
                if (event.newURL.endsWith('laser')) {
                    this.canvas.current.resizeWindow();
                }
            },
            false
        );
    }

    componentWillReceiveProps(nextProps) {
        const { renderingTimestamp } = nextProps;

        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;
            this.printableArea.updateSize(size);
        }

        /*
        this.canvas.current.updateTransformControl2D();
        const { model } = nextProps;
        if (model !== this.props.model) {
            if (!model) {
                this.canvas.current.controls.detach();
            } else {
                this.canvas.current.controls.attach(model);

                const sourceType = model.modelInfo.source.type;
                if (sourceType === 'text') {
                    this.canvas.current.setTransformControls2DState({ enabledScale: false });
                } else {
                    this.canvas.current.setTransformControls2DState({ enabledScale: true });
                }
            }
        }
        */

        this.canvas.current.updateTransformControl2D();
        // const { model } = nextProps;
        const { modelID } = nextProps;
        if (modelID !== this.props.modelID) {
            if (!modelID) {
                this.canvas.current.controls.detach();
            } else {
                const modelInfo = this.props.getSelectedModelInfo();
                const sourceType = modelInfo.source.type;
                if (sourceType === 'text') {
                    this.canvas.current.setTransformControls2DState({ enabledScale: false });
                } else {
                    this.canvas.current.setTransformControls2DState({ enabledScale: true });
                }
                // this.canvas.current.controls.attach(model);
                this.canvas.current.controls.attach(this.props.getSelectedModel());
            }
        }

        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }
    }

    componentWillUnmount() {
        // this.visualizerRef.current.removeEventListener('mousedown', this.hideContextMenu, false);
        // this.visualizerRef.current.removeEventListener('wheel', this.hideContextMenu, false);
        // this.visualizerRef.current.removeEventListener('contextmenu', this.showContextMenu, false);
        this.removeControllerEvents();
    }

    showContextMenu = (event) => {
        this.contextMenuRef.current.show(event);
    };

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    render() {
        const actions = this.actions;
        // const isModelSelected = !!this.props.model;
        const isModelSelected = !!this.props.modelID;
        const hasModel = this.props.hasModel;
        // console.log('modleID', this.props.modelID);
        // console.log('ss', isModelSelected);

        // const { model, modelGroup } = this.props;

        /*
        let estimatedTime = 0;
        if (hasModel) {
            if (model && model.toolPath) {
                estimatedTime = model.toolPath.estimatedTime;
                if (model.modelInfo.gcodeConfig.multiPassEnabled) {
                    estimatedTime *= model.modelInfo.gcodeConfig.multiPasses;
                }
            } else {
                for (const model2 of modelGroup.children) {
                    if (model2.toolPath) {
                        let t = model2.toolPath.estimatedTime;
                        if (model2.modelInfo.gcodeConfig.multiPassEnabled) {
                            t *= model2.modelInfo.gcodeConfig.multiPasses;
                        }
                        estimatedTime += t;
                    }
                }
            }
        }
        */

        const estimatedTime = hasModel ? this.props.getEstimatedTime('selected') : this.props.getEstimatedTime('total');
        // console.log('VeTime', estimatedTime);

        return (
            <div
                ref={this.visualizerRef}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            >
                <div className={styles['canvas-header']}>
                    <PrimaryToolbar actions={this.actions} state={this.state} />
                </div>
                <div className={styles['canvas-content']}>
                    <Canvas
                        ref={this.canvas}
                        size={this.props.size}
                        backgroundGroup={this.props.backgroundGroup}
                        modelGroup={this.props.modelGroup}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 70)}
                        onSelectModel={this.actions.onSelectModel}
                        onUnselectAllModels={this.actions.onUnselectAllModels}
                        onModelAfterTransform={this.actions.onModelAfterTransform}
                        onModelTransform={this.actions.onModelTransform}
                        showContextMenu={this.showContextMenu}
                        transformModelType="2D"
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
                {estimatedTime && (
                    <div className={styles['visualizer-info']}>
                        {i18n._('Estimated Time:')}<Space width={4} />{humanReadableTime(estimatedTime)}
                    </div>
                )}

                {isModelSelected && (
                    <div className={styles['visualizer-notice']}>
                        {(this.state.progress < 1 - EPSILON) && (
                            <p>{i18n._('Generating tool path... {{progress}}%', { progress: toFixed(this.state.progress, 2) * 100.0 })}</p>
                        )}
                        {(this.state.progress > 1 - EPSILON) && (
                            <p>{i18n._('Generated tool path successfully.')}</p>
                        )}
                    </div>
                )}
                {isModelSelected && (
                    <div className={styles['visualizer-progress']}>
                        <ProgressBar progress={this.state.progress * 100.0} />
                    </div>
                )}
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="laser"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('Bring to Front'),
                                disabled: !isModelSelected,
                                onClick: this.actions.bringToFront
                            },
                            {
                                type: 'item',
                                label: i18n._('Send to Back'),
                                disabled: !isModelSelected,
                                onClick: this.actions.sendToBack
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Reference Position'),
                                disabled: !isModelSelected,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('Top Left'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Top Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Top Middle'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Top Middle')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Top Right'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Top Right')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center Left'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Center Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Center')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Center Right'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Center Right')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Left'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Bottom Left')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Middle'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Bottom Middle')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Bottom Right'),
                                        onClick: () => this.actions.onUpdateSelectedModelPosition('Bottom Right')
                                    }
                                ]
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Flip'),
                                disabled: !isModelSelected,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('Vertical'),
                                        onClick: () => this.props.onFlipSelectedModel('Vertical')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Horizontal'),
                                        onClick: () => this.props.onFlipSelectedModel('Horizontal')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Reset'),
                                        onClick: () => this.props.onFlipSelectedModel('Reset')
                                    }
                                ]
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'item',
                                label: i18n._('Delete Selected Model'),
                                disabled: !isModelSelected,
                                onClick: this.actions.deleteSelectedModel
                            },
                            {
                                type: 'item',
                                label: i18n._('Arrange All Models'),
                                disabled: !hasModel,
                                onClick: this.actions.arrangeAllModels
                            }
                        ]
                    }
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { background } = state.laser;
    // call canvas.updateTransformControl2D() when transformation changed or model selected changed
<<<<<<< HEAD
    const { modelGroup, model, hasModel, renderingTimestamp } = state.laser;
=======
    // const { modelGroup, transformation, model, hasModel, previewUpdated, renderingTimestamp } = state.laser;
    const { modelID, modelGroup, transformation, hasModel, previewUpdated, renderingTimestamp } = state.laser;
>>>>>>> model api
    return {
        size: machine.size,
        hasModel,
        modelID,
        modelGroup,
<<<<<<< HEAD
        model,
=======
        // model,
        transformation,
>>>>>>> model api
        backgroundGroup: background.group,
        renderingTimestamp
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
<<<<<<< HEAD
=======
        getEstimatedTime: (type) => dispatch(actions.getEstimatedTime('laser', type)),
        getSelectedModel: () => dispatch(actions.getSelectedModel('laser')),
        getSelectedModelInfo: () => dispatch(actions.getSelectedModelInfo('laser')),
        updateSelectedModelTransformation: (transformation) => dispatch(actions.updateSelectedModelTransformation('laser', transformation)),
>>>>>>> model api
        onSetSelectedModelPosition: (position) => dispatch(actions.onSetSelectedModelPosition('laser', position)),
        onFlipSelectedModel: (flip) => dispatch(actions.onFlipSelectedModel('laser', flip)),
        selectModel: (model) => dispatch(actions.selectModel('laser', model)),
        unselectAllModels: () => dispatch(actions.unselectAllModels('laser')),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel('laser')),
        onModelTransform: () => dispatch(actions.onModelTransform('laser'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
