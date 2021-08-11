import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import noop from 'lodash/noop';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import path from 'path';

import i18n from '../../../lib/i18n';
import { humanReadableTime } from '../../../lib/time-utils';
import ProgressBar from '../../components/ProgressBar';
import Space from '../../components/Space';
import ContextMenu from '../../components/ContextMenu';

import Canvas from '../../components/SMCanvas';
import PrintablePlate from '../CncLaserShared/PrintablePlate';
import VisualizerBottomLeft from '../CncLaserShared/VisualizerBottomLeft';
import { actions as editorActions } from '../../../flux/editor';
import VisualizerTopRight from '../CncLaserTopRight/VisualizerTopRight';
import styles from './styles.styl';
import {
    DISPLAYED_TYPE_TOOLPATH,
    PAGE_EDITOR,
    SELECTEVENT,
    MAX_LASER_CNC_CANVAS_SCALE,
    MIN_LASER_CNC_CANVAS_SCALE, HEAD_LASER,
    PROCESS_MODE_VECTOR, PROCESS_MODE_GREYSCALE
} from '../../../constants';
import SVGEditor from '../../SVGEditor';
import { CNC_LASER_STAGE } from '../../../flux/editor/utils';
import { actions as operationHistoryActions } from '../../../flux/operation-history';
import modal from '../../../lib/modal';
import UniApi from '../../../lib/uni-api';


class Visualizer extends Component {
    static propTypes = {
        ...withRouter.propTypes,
        pathname: PropTypes.string,
        page: PropTypes.string.isRequired,
        stage: PropTypes.number.isRequired,
        progress: PropTypes.number.isRequired,
        inProgress: PropTypes.bool.isRequired,
        materials: PropTypes.object,

        coordinateMode: PropTypes.object.isRequired,
        coordinateSize: PropTypes.object.isRequired,
        size: PropTypes.object.isRequired,
        scale: PropTypes.number.isRequired,
        target: PropTypes.object,
        // model: PropTypes.object,
        // selectedModelID: PropTypes.string,
        selectedModelArray: PropTypes.array,
        selectedToolPathModelArray: PropTypes.array,
        backgroundGroup: PropTypes.object.isRequired,
        modelGroup: PropTypes.object.isRequired,
        SVGActions: PropTypes.object.isRequired,
        toolPathGroup: PropTypes.object.isRequired,
        displayedType: PropTypes.string.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,
        isChangedAfterGcodeGenerating: PropTypes.bool.isRequired,

        // func
        selectAllElements: PropTypes.func.isRequired,
        cut: PropTypes.func.isRequired,
        copy: PropTypes.func.isRequired,
        paste: PropTypes.func.isRequired,
        clearOperationHistory: PropTypes.func.isRequired,
        undo: PropTypes.func.isRequired,
        redo: PropTypes.func.isRequired,
        initContentGroup: PropTypes.func.isRequired,
        updateTarget: PropTypes.func,
        updateScale: PropTypes.func,
        getEstimatedTime: PropTypes.func.isRequired,
        // getSelectedModel: PropTypes.func.isRequired,
        bringSelectedModelToFront: PropTypes.func.isRequired,
        sendSelectedModelToBack: PropTypes.func.isRequired,
        arrangeAllModels2D: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,

        onSetSelectedModelPosition: PropTypes.func.isRequired,
        onFlipSelectedModel: PropTypes.func.isRequired,
        selectModelInProcess: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        duplicateSelectedModel: PropTypes.func.isRequired,
        // onModelTransform: PropTypes.func.isRequired,
        // onModelAfterTransform: PropTypes.func.isRequired,

        // editor actions
        onCreateElement: PropTypes.func.isRequired,
        onSelectElements: PropTypes.func.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        onMoveSelectedElementsByKey: PropTypes.func.isRequired,
        createText: PropTypes.func.isRequired,
        updateTextTransformationAfterEdit: PropTypes.func.isRequired,
        getSelectedElementsUniformScalingState: PropTypes.func.isRequired,
        uploadImage: PropTypes.func.isRequired,
        switchToPage: PropTypes.func.isRequired,

        elementActions: PropTypes.shape({
            moveElementsStart: PropTypes.func.isRequired,
            moveElements: PropTypes.func.isRequired,
            moveElementsFinish: PropTypes.func.isRequired,
            resizeElementsStart: PropTypes.func.isRequired,
            resizeElements: PropTypes.func.isRequired,
            resizeElementsFinish: PropTypes.func.isRequired,
            rotateElementsStart: PropTypes.func.isRequired,
            rotateElements: PropTypes.func.isRequired,
            rotateElementsFinish: PropTypes.func.isRequired,
            moveElementsOnKeyDown: PropTypes.func.isRequired
        })
    };

    contextMenuRef = React.createRef();

    visualizerRef = React.createRef();

    printableArea = null;

    svgCanvas = React.createRef();

    canvas = React.createRef();

    fileInput = React.createRef();

    actions = {
        undo: () => {
            this.props.undo();
        },
        redo: () => {
            this.props.redo();
        },
        selectAll: () => {
            this.props.selectAllElements();
        },
        unselectAll: () => {
            this.props.onClearSelection();
        },
        copy: () => {
            this.props.copy();
        },
        paste: () => {
            this.props.paste();
        },
        cut: () => {
            this.props.cut();
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];
            const extname = path.extname(file.name).toLowerCase();
            let uploadMode;
            if (extname === '.svg') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname === '.dxf') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else {
                uploadMode = PROCESS_MODE_GREYSCALE;
            }

            // Switch to PAGE_EDITOR page if new image being uploaded
            this.props.switchToPage(PAGE_EDITOR);

            this.props.uploadImage(file, uploadMode, () => {
                modal({
                    cancelTitle: i18n._('Close'),
                    title: i18n._('Import Error'),
                    body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                });
            });
        },
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },

        // canvas footer
        zoomIn: () => {
            if (this.props.page === PAGE_EDITOR) {
                this.svgCanvas.current.zoomIn();
            } else {
                this.canvas.current.zoomIn();
            }
        },
        zoomOut: () => {
            if (this.props.page === PAGE_EDITOR) {
                this.svgCanvas.current.zoomOut();
            } else {
                this.canvas.current.zoomOut();
            }
        },
        autoFocus: () => {
            this.canvas.current.setCameraOnTop();
            this.props.updateScale(1);
            // this.props.updateTarget({ x: 0, y: 0 });
            const { coordinateMode, coordinateSize } = this.props;
            const target = {
                x: 0,
                y: 0
            };
            target.x += coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x;
            target.y += coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y;

            target.x /= 1.5;
            target.y /= 1.5;
            this.props.updateTarget(target);
        },
        onSelectModels: (intersect, selectEvent) => { // this is a toolpath model? mesh object??
            // todo
            // console.log('----on process select----', model);
            this.props.selectModelInProcess(intersect, selectEvent);
        },
        /*
        onModelAfterTransform: () => {
            this.props.onModelAfterTransform();
        },
        onModelTransform: () => {
            this.props.onModelTransform();
        },
        */
        // context menu
        bringToFront: () => {
            this.props.bringSelectedModelToFront();
        },
        sendToBack: () => {
            this.props.sendSelectedModelToBack();
        },
        onUpdateSelectedModelPosition: (position) => {
            this.props.onSetSelectedModelPosition(position);
        },
        deleteSelectedModel: () => {
            this.props.removeSelectedModel();
        },
        arrangeAllModels: () => {
            this.props.arrangeAllModels2D();
        },
        duplicateSelectedModel: () => {
            this.props.duplicateSelectedModel();
        },
        rotateModel: (angle) => {
            const elements = this.props.SVGActions.svgContentGroup.selectedElements;
            const startAngle = this.props.SVGActions.svgContentGroup.getElementAngel();
            let endAngle = (startAngle + angle) % 360;
            if (endAngle > 180) {
                endAngle -= 360;
            }
            if (endAngle < -180) {
                endAngle += 360;
            }
            this.props.elementActions.rotateElementsImmediately(elements, {
                newAngle: endAngle
            });
        },
        importFile: (fileObj) => {
            if (fileObj) {
                this.actions.onChangeFile({
                    target: {
                        files: [fileObj]
                    }
                });
            } else {
                this.actions.onClickToUpload();
            }
        }
    };

    constructor(props) {
        super(props);

        const { size, materials, coordinateMode } = props;
        this.printableArea = new PrintablePlate(size, materials, coordinateMode);
    }

    // hideContextMenu = () => {
    //     ContextMenu.hide();
    // };

    componentDidMount() {
        this.canvas.current.resizeWindow();
        this.props.clearOperationHistory();
        UniApi.Event.on('appbar-menu:laser.import', this.actions.importFile);
    }

    componentWillReceiveProps(nextProps) {
        const { renderingTimestamp } = nextProps;

        if (!isEqual(nextProps.size, this.props.size) || !isEqual(nextProps.materials, this.props.materials)) {
            const { size, materials } = nextProps;
            this.printableArea.updateSize(size, materials);
            this.canvas.current.setCamera(new THREE.Vector3(0, 0, 300), new THREE.Vector3());
        }

        // const { model } = nextProps;
        const { selectedToolPathModelArray } = nextProps;
        // todo, selectedModelId nof found
        if (selectedToolPathModelArray !== this.props.selectedToolPathModelArray) {
            this.canvas.current.detach();
            selectedToolPathModelArray.map(model => this.canvas.current.controls.attach(model.meshObject, SELECTEVENT.ADDSELECT));
        }

        if (renderingTimestamp !== this.props.renderingTimestamp) {
            this.canvas.current.renderScene();
        }

        if (nextProps.displayedType !== this.props.displayedType) {
            if (nextProps.displayedType === DISPLAYED_TYPE_TOOLPATH) {
                this.canvas.current.controls.disableClick();
            } else {
                this.canvas.current.controls.enableClick();
            }
        }

        if (nextProps.coordinateMode !== this.props.coordinateMode) {
            const { size, materials, coordinateMode } = nextProps;
            this.printableArea = new PrintablePlate(size, materials, coordinateMode);
        }

        if (nextProps.coordinateSize !== this.props.coordinateSize) {
            this.printableArea = new PrintablePlate(nextProps.coordinateSize, nextProps.materials, nextProps.coordinateMode);
        }
    }

    componentWillUnmount() {
        this.props.clearOperationHistory();
        UniApi.Event.off('appbar-menu:laser.import', this.actions.importFile);
    }

    getNotice() {
        const { stage, progress } = this.props;
        switch (stage) {
            case CNC_LASER_STAGE.EMPTY:
                return '';
            case CNC_LASER_STAGE.GENERATING_TOOLPATH:
                return i18n._('Generating toolpath... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.GENERATE_TOOLPATH_SUCCESS:
                return i18n._('Generated toolpath successfully.');
            case CNC_LASER_STAGE.GENERATE_TOOLPATH_FAILED:
                return i18n._('Failed to generate toolpath.');
            case CNC_LASER_STAGE.PREVIEWING:
                return i18n._('Previewing toolpath...');
            case CNC_LASER_STAGE.PREVIEW_SUCCESS:
                return i18n._('Previewed toolpath successfully');
            case CNC_LASER_STAGE.PREVIEW_FAILED:
                return i18n._('Failed to preview toolpath.');
            case CNC_LASER_STAGE.GENERATING_GCODE:
                return i18n._('Generating G-code... {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS:
                return i18n._('Generated G-code successfully.');
            case CNC_LASER_STAGE.GENERATE_GCODE_FAILED:
                return i18n._('Failed to generate G-code.');
            case CNC_LASER_STAGE.UPLOADING_IMAGE:
                return i18n._('Loading object {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.UPLOAD_IMAGE_SUCCESS:
                return i18n._('Loaded object successfully.');
            case CNC_LASER_STAGE.UPLOAD_IMAGE_FAILED:
                return i18n._('Failed to load object.');
            case CNC_LASER_STAGE.PROCESSING_IMAGE:
                return i18n._('Processing object {{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case CNC_LASER_STAGE.PROCESS_IMAGE_SUCCESS:
                return i18n._('Processed object successfully.');
            case CNC_LASER_STAGE.PROCESS_IMAGE_FAILED:
                return i18n._('Failed to process object.');
            default:
                return '';
        }
    }

    showContextMenu = (event) => {
        const model = this.props.SVGActions.getSVGModelByElement(event.target);
        if (this.props.modelGroup.selectedModelArray.length > 1 && this.props.modelGroup.selectedModelArray.includes(model)) {
            return;
        }
        if (model) {
            this.props.onClearSelection();
            this.props.onSelectElements([event.target]);
        }
        this.contextMenuRef.current.show(event);
    };

    render() {
        // const isModelSelected = !!this.props.selectedModelID;
        const isOnlySelectedOneModel = (this.props.selectedModelArray && this.props.selectedModelArray.length > 0);
        // const hasModel = this.props.hasModel;

        const estimatedTime = this.props.displayedType === DISPLAYED_TYPE_TOOLPATH && !this.props.isChangedAfterGcodeGenerating ? this.props.getEstimatedTime('selected') : '';
        const notice = this.getNotice();
        const contextMenuDisabled = !isOnlySelectedOneModel || !this.props.selectedModelArray[0].visible;
        const displayedType = this.props.displayedType;
        const pasteDisabled = (this.props.modelGroup.clipboard.length === 0);

        return (
            <div
                ref={this.visualizerRef}
            >
                {(displayedType === DISPLAYED_TYPE_TOOLPATH) && (
                    <div>
                        <VisualizerTopRight
                            headType="laser"
                        />
                    </div>
                )}
                <div style={{
                    visibility: (displayedType !== DISPLAYED_TYPE_TOOLPATH) ? 'visible' : 'hidden'
                }}
                >
                    <SVGEditor
                        isActive={!this.props.currentModalPath && this.props.pathname.indexOf('laser') > 0}
                        ref={this.svgCanvas}
                        editable={!this.props.inProgress}
                        size={this.props.size}
                        initContentGroup={this.props.initContentGroup}
                        scale={this.props.scale}
                        minScale={MIN_LASER_CNC_CANVAS_SCALE}
                        maxScale={MAX_LASER_CNC_CANVAS_SCALE}
                        target={this.props.target}
                        coordinateMode={this.props.coordinateMode}
                        coordinateSize={this.props.coordinateSize}
                        updateTarget={this.props.updateTarget}
                        updateScale={this.props.updateScale}
                        SVGActions={this.props.SVGActions}
                        materials={this.props.materials}
                        insertDefaultTextVector={this.props.insertDefaultTextVector}
                        showContextMenu={this.showContextMenu}
                        onCreateElement={this.props.onCreateElement}
                        onSelectElements={this.props.onSelectElements}
                        onClearSelection={this.props.onClearSelection}
                        editorActions={this.actions}
                        elementActions={this.props.elementActions}
                        getSelectedElementsUniformScalingState={this.props.getSelectedElementsUniformScalingState}
                        onMoveSelectedElementsByKey={this.props.onMoveSelectedElementsByKey}
                        createText={this.props.createText}
                        updateTextTransformationAfterEdit={this.props.updateTextTransformationAfterEdit}
                        onChangeFile={this.actions.onChangeFile}
                        onClickToUpload={this.actions.onClickToUpload}
                        fileInput={this.fileInput}
                        allowedFiles=".svg, .png, .jpg, .jpeg, .bmp, .dxf"
                        headType={HEAD_LASER}
                    />
                </div>
                <div
                    className={styles['canvas-content']}
                    style={{
                        visibility: (displayedType === DISPLAYED_TYPE_TOOLPATH) ? 'visible' : 'hidden'
                    }}
                >
                    <Canvas
                        ref={this.canvas}
                        canOperateModel={false}
                        size={this.props.size}
                        backgroundGroup={this.props.backgroundGroup}
                        modelGroup={this.props.modelGroup}
                        toolPathGroupObject={this.props.toolPathGroup.object}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 300)}
                        cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                        onSelectModels={this.actions.onSelectModels}
                        onModelAfterTransform={noop}
                        onModelTransform={noop}
                        showContextMenu={this.showContextMenu}
                        scale={this.props.scale}
                        minScale={MIN_LASER_CNC_CANVAS_SCALE}
                        maxScale={MAX_LASER_CNC_CANVAS_SCALE}
                        target={this.props.target}
                        coordinateMode={this.props.coordinateMode}
                        coordinateSize={this.props.coordinateSize}
                        updateTarget={this.props.updateTarget}
                        updateScale={this.props.updateScale}
                        transformSourceType="2D"
                    />
                </div>
                <div className="position-ab left-68 bottom-16">
                    <VisualizerBottomLeft
                        headType={HEAD_LASER}
                        scale={this.props.scale}
                        minScale={MIN_LASER_CNC_CANVAS_SCALE}
                        maxScale={MAX_LASER_CNC_CANVAS_SCALE}
                        updateScale={this.props.updateScale}
                        zoomIn={this.actions.zoomIn}
                        zoomOut={this.actions.zoomOut}
                        toFront={this.actions.autoFocus}
                    />
                </div>
                {estimatedTime && (
                    <div className={styles['visualizer-info']}>
                        <span className="fa fa-clock-o" />
                        <Space width={4} />
                        {humanReadableTime(estimatedTime)}
                    </div>
                )}

                <div className={styles['visualizer-progress']}>
                    <ProgressBar tips={notice} progress={this.props.progress * 100} />
                </div>
                <ContextMenu
                    ref={this.contextMenuRef}
                    id="laser"
                    menuItems={
                        [
                            {
                                type: 'item',
                                label: i18n._('Cut'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.cut
                            },
                            {
                                type: 'item',
                                label: i18n._('Copy'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.copy
                            },
                            {
                                type: 'item',
                                label: i18n._('Paste'),
                                disabled: pasteDisabled,
                                onClick: this.actions.paste
                            },
                            {
                                type: 'item',
                                label: i18n._('Duplicate'),
                                disabled: contextMenuDisabled,
                                onClick: this.actions.duplicateSelectedModel
                            },
                            {
                                type: 'separator'
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Arrange'),
                                disabled: contextMenuDisabled,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('Bring to Front'),
                                        onClick: () => this.actions.bringToFront()
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Send to Back'),
                                        onClick: () => this.actions.sendToBack()
                                    }
                                ]
                            },
                            {
                                type: 'subMenu',
                                label: i18n._('Transform'),
                                disabled: contextMenuDisabled,
                                items: [
                                    {
                                        type: 'item',
                                        label: i18n._('Rotate 180°'),
                                        onClick: () => this.actions.rotateModel(180)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Rotate 90° Clockwise'),
                                        onClick: () => this.actions.rotateModel(90)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Rotate 90° Counter Clockwise'),
                                        onClick: () => this.actions.rotateModel(-90)
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Flip Horizontal'),
                                        onClick: () => this.props.onFlipSelectedModel('Horizontal')
                                    },
                                    {
                                        type: 'item',
                                        label: i18n._('Flip Vertical'),
                                        onClick: () => this.props.onFlipSelectedModel('Vertical')
                                    }
                                ]
                            }
                        ]
                    }
                />
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { size } = state.machine;
    const { currentModalPath } = state.appbarMenu;
    const { background } = state.laser;

    const { SVGActions, scale, target, materials, page, selectedModelID, modelGroup, svgModelGroup, toolPathGroup, displayedType,
        isChangedAfterGcodeGenerating, renderingTimestamp, stage, progress, coordinateMode, coordinateSize, inProgress } = state.laser;
    const selectedModelArray = modelGroup.getSelectedModelArray();
    const selectedToolPathModelArray = modelGroup.getSelectedToolPathModels();

    return {
        currentModalPath,
        // switch pages trigger pathname change
        pathname: ownProps.location.pathname,
        page,
        scale,
        target,
        SVGActions,
        size,
        coordinateMode,
        coordinateSize,
        materials,
        hasModel: modelGroup.hasModel(),
        selectedModelID,
        svgModelGroup,
        modelGroup,
        toolPathGroup,
        displayedType,
        selectedModelArray,
        selectedToolPathModelArray,
        isChangedAfterGcodeGenerating,
        // model,
        backgroundGroup: background.group,
        renderingTimestamp,
        stage,
        progress,
        inProgress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        clearOperationHistory: () => dispatch(operationHistoryActions.clear('laser')),
        undo: () => dispatch(editorActions.undo('laser')),
        redo: () => dispatch(editorActions.redo('laser')),
        initContentGroup: (svgContentGroup) => dispatch(editorActions.initContentGroup('laser', svgContentGroup)),
        updateTarget: (target) => dispatch(editorActions.updateState('laser', { target })),
        updateScale: (scale) => dispatch(editorActions.updateState('laser', { scale })),
        getEstimatedTime: (type) => dispatch(editorActions.getEstimatedTime('laser', type)),
        getSelectedModel: () => dispatch(editorActions.getSelectedModel('laser')),
        bringSelectedModelToFront: () => dispatch(editorActions.bringSelectedModelToFront('laser')),
        sendSelectedModelToBack: () => dispatch(editorActions.sendSelectedModelToBack('laser')),
        arrangeAllModels2D: () => dispatch(editorActions.arrangeAllModels2D('laser')),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('laser')),
        onSetSelectedModelPosition: (position) => dispatch(editorActions.onSetSelectedModelPosition('laser', position)),
        onFlipSelectedModel: (flip) => dispatch(editorActions.onFlipSelectedModel('laser', flip)),
        selectModelInProcess: (intersect, selectEvent) => dispatch(editorActions.selectModelInProcess('laser', intersect, selectEvent)),
        removeSelectedModel: () => dispatch(editorActions.checkToRemoveSelectedModels('laser')),
        duplicateSelectedModel: () => dispatch(editorActions.duplicateSelectedModel('laser')),

        cut: () => dispatch(editorActions.cut('laser')),
        copy: () => dispatch(editorActions.copy('laser')),
        paste: () => dispatch(editorActions.paste('laser')),
        onCreateElement: (element) => dispatch(editorActions.createModelFromElement('laser', element)),
        selectAllElements: () => dispatch(editorActions.selectAllElements('laser')),
        onSelectElements: (elements) => dispatch(editorActions.selectElements('laser', elements)),
        onClearSelection: () => dispatch(editorActions.clearSelection('laser')),
        onMoveSelectedElementsByKey: () => dispatch(editorActions.moveElementsOnKeyUp('laser')),
        getSelectedElementsUniformScalingState: () => dispatch(editorActions.getSelectedElementsUniformScalingState('laser')),

        createText: (text) => dispatch(editorActions.createText('laser', text)),
        updateTextTransformationAfterEdit: (element, transformation) => dispatch(editorActions.updateModelTransformationByElement('laser', element, transformation)),

        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('laser', file, mode, onFailure)),
        switchToPage: (page) => dispatch(editorActions.switchToPage('laser', page)),

        elementActions: {
            moveElementsStart: (elements) => dispatch(editorActions.moveElementsStart('laser', elements)),
            moveElements: (elements, options) => dispatch(editorActions.moveElements('laser', elements, options)),
            moveElementsFinish: (elements, options) => dispatch(editorActions.moveElementsFinish('laser', elements, options)),
            resizeElementsStart: (elements, options) => dispatch(editorActions.resizeElementsStart('laser', elements, options)),
            resizeElements: (elements, options) => dispatch(editorActions.resizeElements('laser', elements, options)),
            resizeElementsFinish: (elements, options) => dispatch(editorActions.resizeElementsFinish('laser', elements, options)),
            rotateElementsStart: (elements, options) => dispatch(editorActions.rotateElementsStart('laser', elements, options)),
            rotateElements: (elements, options) => dispatch(editorActions.rotateElements('laser', elements, options)),
            rotateElementsFinish: (elements, options) => dispatch(editorActions.rotateElementsFinish('laser', elements, options)),
            moveElementsOnKeyDown: (options) => dispatch(editorActions.moveElementsOnKeyDown('laser', null, options)),
            rotateElementsImmediately: (elements, options) => dispatch(editorActions.rotateElementsImmediately('laser', elements, options))
        }
        // onModelTransform: () => dispatch(editorActions.onModelTransform('laser')),
        // onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('laser'))
    };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Visualizer));
