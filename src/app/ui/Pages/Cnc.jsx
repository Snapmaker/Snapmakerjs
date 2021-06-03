// import React, { useState, useEffect } from 'react';
import React, { useState, useEffect } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import classNames from 'classnames';

import path from 'path';
import { Trans } from 'react-i18next';
import isElectron from 'is-electron';
import i18n from '../../lib/i18n';
import Anchor from '../components/Anchor';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import Space from '../components/Space';
import { renderModal, renderWidgetList, useRenderRecoveryModal } from '../utils';

import CNCVisualizer from '../widgets/CNCVisualizer';
import ProjectLayout from '../Layouts/ProjectLayout';
import MainToolBar from '../Layouts/MainToolBar';


import { actions as editorActions } from '../../flux/editor';
import { actions as cncActions } from '../../flux/cnc';
import { actions as machineActions } from '../../flux/machine';
import { actions as projectActions } from '../../flux/project';
import {
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_MESH,
    PROCESS_MODE_VECTOR,
    PAGE_EDITOR,
    PAGE_PROCESS,
    HEAD_CNC
} from '../../constants';

import ControlWidget from '../widgets/Control';
import ConnectionWidget from '../widgets/Connection';
import ConsoleWidget from '../widgets/Console';
import GCodeWidget from '../widgets/GCode';
import MacroWidget from '../widgets/Macro';
import PurifierWidget from '../widgets/Purifier';
import MarlinWidget from '../widgets/Marlin';
import VisualizerWidget from '../widgets/WorkspaceVisualizer';
import WebcamWidget from '../widgets/Webcam';
import LaserParamsWidget from '../widgets/LaserParams';
import LaserSetBackground from '../widgets/LaserSetBackground';
import LaserTestFocusWidget from '../widgets/LaserTestFocus';
import CNCPathWidget from '../widgets/CNCPath';
import CncLaserOutputWidget from '../widgets/CncLaserOutput';

import PrintingMaterialWidget from '../widgets/PrintingMaterial';
import PrintingConfigurationsWidget from '../widgets/PrintingConfigurations';
import PrintingOutputWidget from '../widgets/PrintingOutput';
import WifiTransport from '../widgets/WifiTransport';
import EnclosureWidget from '../widgets/Enclosure';
import CncLaserObjectList from '../widgets/CncLaserList';
import PrintingObjectList from '../widgets/PrintingObjectList';
import JobType from '../widgets/JobType';
import CreateToolPath from '../widgets/CncLaserToolPath';
import PrintingVisualizer from '../widgets/PrintingVisualizer';

const allWidgets = {
    'control': ControlWidget,
    // 'axesPanel': DevelopAxesWidget,
    'connection': ConnectionWidget,
    'console': ConsoleWidget,
    'gcode': GCodeWidget,
    'macro': MacroWidget,
    'macroPanel': MacroWidget,
    'purifier': PurifierWidget,
    'marlin': MarlinWidget,
    'visualizer': VisualizerWidget,
    'webcam': WebcamWidget,
    'printing-visualizer': PrintingVisualizer,
    'wifi-transport': WifiTransport,
    'enclosure': EnclosureWidget,
    '3dp-object-list': PrintingObjectList,
    '3dp-material': PrintingMaterialWidget,
    '3dp-configurations': PrintingConfigurationsWidget,
    '3dp-output': PrintingOutputWidget,
    'laser-params': LaserParamsWidget,
    // 'laser-output': CncLaserOutputWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'cnc-output': CncLaserOutputWidget,
    'cnc-laser-object-list': CncLaserObjectList,
    'job-type': JobType,
    'create-toolpath': CreateToolPath
};


const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl';
const pageHeadType = HEAD_CNC;
function useRenderWarning() {
    const [showWarning, setShowWarning] = useState(false);
    const dispatch = useDispatch();
    const onClose = () => setShowWarning(false);
    function onChangeShouldShowWarning(value) {
        dispatch(machineActions.setShouldShowCncWarning(value));
    }
    return showWarning && renderModal({
        onClose,
        renderBody: () => (
            <div>
                <Trans i18nKey="key_CNC_loading_warning">
                            This is an alpha feature that helps you get started with CNC Carving. Make sure you
                    <Space width={4} />
                    <a
                        style={{ color: '#28a7e1' }}
                        href="https://manual.snapmaker.com/cnc_carving/read_this_first_-_safety_information.html"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                                Read This First - Safety Information
                    </a>
                    <Space width={4} />
                            before proceeding.
                </Trans>
            </div>
        ),
        renderFooter: () => (
            <div style={{ display: 'inline-block', marginRight: '8px' }}>
                <button type="button" className="sm-btn-large sm-btn-default" onClick={onClose}>
                    {i18n._('Cancel')}
                </button>
                <input
                    id="footer-input"
                    type="checkbox"
                    defaultChecked={false}
                    onChange={onChangeShouldShowWarning}
                />
                {/* eslint-disable-next-line jsx-a11y/label-has-for */}
                <label id="footer-input-label" htmlFor="footer-input" style={{ paddingLeft: '4px' }}>{i18n._('Don\'t show again')}</label>

            </div>
        )
    });
}
function Cnc({ history }) {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const dispatch = useDispatch();
    const page = useSelector(state => state?.cnc.page);

    useEffect(() => {
        dispatch(cncActions.init());
    }, []);

    const recoveryModal = useRenderRecoveryModal(pageHeadType);
    const warningModal = useRenderWarning();
    const listActions = {
        onDragStart: () => {
            setIsDraggingWidget(true);
        },
        onDragEnd: () => {
            setIsDraggingWidget(false);
        }
    };
    const actions = {
        onDropAccepted: (file) => {
            const extname = path.extname(file.name).toLowerCase();
            let uploadMode;
            if (extname.toLowerCase() === '.svg') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.dxf') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.stl') {
                uploadMode = PROCESS_MODE_MESH;
            } else {
                uploadMode = PROCESS_MODE_GREYSCALE;
            }
            dispatch(editorActions.uploadImage('cnc', file, uploadMode, () => {
                modal({
                    title: i18n._('Parse Error'),
                    body: i18n._('Failed to parse image file {{filename}}.', { filename: file.name })
                });
            }));
        },
        onDropRejected: () => {
            modal({
                title: i18n._('Warning'),
                body: i18n._('Only {{accept}} files are supported.', { accept: ACCEPT })
            });
        }
    };

    function renderMainToolBar() {
        const fileInput = React.createRef();
        const leftItems = [
            {
                title: i18n._('Home'),
                type: 'button',
                name: 'Copy',
                action: () => history.push('/')
            },
            {
                type: 'separator'
            },
            {
                title: i18n._('Add'),
                type: 'button',
                name: 'Copy',
                inputInfo: {
                    accept: '.snapcnc',
                    fileInput: fileInput,
                    onChange: async (e) => {
                        const file = e.target.files[0];
                        const recentFile = {
                            name: file.name,
                            path: file.path || ''
                        };
                        try {
                            await dispatch(projectActions.open(file, history));
                            if (isElectron()) {
                                const ipc = window.require('electron').ipcRenderer;
                                ipc.send('add-recent-file', recentFile);
                            }
                            await dispatch(projectActions.updateRecentFile([recentFile], 'update'));
                        } catch (error) {
                            modal({
                                title: i18n._('Failed to upload model'),
                                body: error.message
                            });
                        }
                    }
                },
                action: () => {
                    fileInput.current.value = null;
                    fileInput.current.click();
                }
            },
            {
                title: 'Save',
                type: 'button',
                action: () => {
                    dispatch(projectActions.save(HEAD_CNC));
                }
            }
            // Todo, add after completed
            // {
            //     title: 'Undo',
            //     type: 'button'
            // },
            // {
            //     title: 'Redo',
            //     type: 'button'
            // }
        ];
        const centerItems = [
            {
                name: 'Edit',
                title: 'Edit',
                action: () => history.push('cnc')
            }
        ];
        return (
            <MainToolBar
                leftItems={leftItems}
                centerItems={centerItems}
            />
        );
    }
    function renderRightView() {
        const widgetProps = { headType: 'cnc' };
        return (
            <div>
                <div
                    style={{
                        display: 'inline-block',
                        width: '50%',
                        border: '1px solid #fafafa',
                        backgroundColor: page === PAGE_EDITOR ? '#b3d4fc' : '#fafafa'
                    }}
                    className={classNames({ 'selected': page === PAGE_EDITOR })}
                >
                    <Anchor
                        style={{

                        }}
                        onClick={() => dispatch(editorActions.switchToPage(HEAD_CNC, PAGE_EDITOR))}
                    >
                        {i18n._('Edit')}
                    </Anchor>
                </div>
                <div
                    style={{
                        display: 'inline-block',
                        width: '50%',
                        border: '1px solid #fafafa',
                        backgroundColor: page === PAGE_PROCESS ? '#b3d4fc' : '#fafafa'
                    }}
                    className={classNames({ 'selected': page === PAGE_PROCESS })}
                >
                    <Anchor
                        onClick={() => dispatch(editorActions.switchToPage(HEAD_CNC, PAGE_PROCESS))}
                    >
                        {i18n._('Process')}
                    </Anchor>
                </div>
                {renderWidgetList('cnc', 'default', widgets, allWidgets, listActions, widgetProps)}
            </div>
        );
    }

    return (
        <div>
            <ProjectLayout
                renderMainToolBar={renderMainToolBar}
                renderRightView={renderRightView}
            >
                <Dropzone
                    disabled={isDraggingWidget}
                    accept={ACCEPT}
                    dragEnterMsg={i18n._('Drop an image file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <CNCVisualizer />
                </Dropzone>
            </ProjectLayout>
            {recoveryModal}
            {warningModal}
        </div>
    );
}
Cnc.propTypes = {
    history: PropTypes.object
    // location: PropTypes.object
};
export default withRouter(Cnc);
