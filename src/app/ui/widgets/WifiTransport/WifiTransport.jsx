import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import path from 'path';
import request from 'superagent';
import { pathWithRandomSuffix } from '../../../../shared/lib/random-utils';
import i18n from '../../../lib/i18n';
import UniApi from '../../../lib/uni-api';
// import widgetStyles from '../styles.styl';
import styles from './index.styl';
import {
    CONNECTION_TYPE_WIFI,
    DATA_PREFIX,
    // IMAGE_WIFI_CONNECTED,
    // IMAGE_WIFI_ERROR,
    MACHINE_HEAD_TYPE
} from '../../../constants';
import { actions as workspaceActions } from '../../../flux/workspace';
import { actions as projectActions } from '../../../flux/project';

import modalSmallHOC from '../../components/Modal/modal-small';
import { Button } from '../../components/Buttons';
// import SvgIcon from '../../components/SvgIcon';
import Checkbox from '../../components/Checkbox';


const changeNameInput = [];

const GcodePreviewItem = React.memo(({ gcodeFile, index, selected, onSelectFile }) => {
    const dispatch = useDispatch();
    const name = gcodeFile.name.length > 25
        ? `${gcodeFile.name.substring(0, 15)}...${gcodeFile.name.substring(gcodeFile.name.length - 10, gcodeFile.name.length)}`
        : gcodeFile.name;
    let size = '';
    const { isRenaming, uploadName } = gcodeFile;
    if (!gcodeFile.size) {
        size = '';
    } else if (gcodeFile.size / 1024 / 1024 > 1) {
        size = `${(gcodeFile.size / 1024 / 1024).toFixed(2)} MB`;
    } else if (gcodeFile.size / 1024 > 1) {
        size = `${(gcodeFile.size / 1024).toFixed(2)} KB`;
    } else {
        size = `${(gcodeFile.size).toFixed(2)} B`;
    }

    const lastModified = new Date(gcodeFile.lastModified);
    let date = `${lastModified.getFullYear()}.${lastModified.getMonth() + 1}.${lastModified.getDate()}   ${lastModified.getHours()}:${lastModified.getMinutes()}`;
    if (!gcodeFile.lastModified) {
        date = '';
    }

    const onKeyDown = (e) => {
        let keynum;
        if (window.event) {
            keynum = e.keyCode;
        } else if (e.which) {
            keynum = e.which;
        }
        if (keynum === 13) {
            e.target.blur();
        }
    };

    const onRenameEnd = (_uploadName, _index) => {
        let newName = changeNameInput[_index].current.value;
        const m = _uploadName.match(/(.gcode|.cnc|.nc)$/);
        if (m) {
            newName += m[0];
        }
        dispatch(workspaceActions.renameGcodeFile(_uploadName, newName, false));
    };

    const onRenameStart = (_uploadName, _index, event) => {
        dispatch(workspaceActions.renameGcodeFile(_uploadName, null, true));
        event.stopPropagation();
        setTimeout(() => {
            changeNameInput[_index].current.focus();
        }, 0);
    };

    const onRemoveFile = (_gcodeFile) => {
        dispatch(workspaceActions.removeGcodeFile(_gcodeFile));
    };

    return (
        <div
            className={classNames(
                styles['gcode-file'],
                { [styles.selected]: selected }
            )}
            key={pathWithRandomSuffix(gcodeFile.uploadName)}
            onClick={
                (event) => onSelectFile(gcodeFile.uploadName, name, event)
            }
            onKeyDown={noop}
            role="button"
            tabIndex={0}
        >
            <button
                type="button"
                className={styles['gcode-file-remove']}
                onClick={() => {
                    onRemoveFile(gcodeFile);
                }}
            />
            {selected && <div className={styles['gcode-file-selected-icon']} />}
            <div className={styles['gcode-file-img']}>
                <img
                    src={gcodeFile.thumbnail}
                    draggable="false"
                    alt=""
                />
            </div>
            <div className={classNames('input-text', styles['gcode-file-text'])}>
                <div
                    className={classNames(
                        styles['gcode-file-text-name'],
                        { [styles.haveOpacity]: isRenaming === false }
                    )}
                    role="button"
                    onKeyDown={() => {
                    }}
                    tabIndex={0}
                    onClick={(event) => onRenameStart(uploadName, index, event)}
                >
                    <div
                        className={styles['gcode-file-text-rename']}
                    >
                        {name}
                    </div>

                </div>
                <div className={classNames(
                    styles['gcode-file-input-name'],
                    { [styles.haveOpacity]: isRenaming === true }
                )}
                >
                    <input
                        defaultValue={gcodeFile.name.replace(/(.gcode|.cnc|.nc)$/, '')}
                        className={classNames('input-select')}
                        onBlur={() => onRenameEnd(uploadName, index)}
                        onKeyDown={(event) => onKeyDown(event)}
                        ref={changeNameInput[index]}
                    />
                </div>
                <div className={styles['gcode-file-text-info']}>
                    <span>{size}</span>
                    <span>{date}</span>
                </div>
            </div>
        </div>
    );
});
GcodePreviewItem.propTypes = {
    gcodeFile: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired,
    selected: PropTypes.bool.isRequired,
    onSelectFile: PropTypes.func.isRequired
};

function WifiTransport({ widgetActions }) {
    const { gcodeFiles } = useSelector(state => state.workspace);
    const { server, isConnected, headType, connectionType } = useSelector(state => state.machine);
    const [loadToWorkspaceOnLoad, setLoadToWorkspaceOnLoad] = useState(true);
    const [selectFileName, setSelectFileName] = useState('');
    const [selectFileType, setSelectFileType] = useState('');
    const dispatch = useDispatch();
    const fileInput = useRef();

    const onSelectFile = useCallback((_selectFileName, name, event) => {
        if (event && (event.target.className.indexOf('input-select') > -1 || event.target.className.indexOf('fa-check') > -1)) {
            return;
        }
        // this.props.renameGcodeFile(selectFileName, name, false, true);
        const filename = path.basename(_selectFileName);
        let type = '';
        if (filename.endsWith('.gcode')) {
            type = MACHINE_HEAD_TYPE['3DP'].value;
        }
        if (filename.endsWith('.nc')) {
            type = MACHINE_HEAD_TYPE.LASER.value;
        }
        if (filename.endsWith('.cnc')) {
            type = MACHINE_HEAD_TYPE.CNC.value;
        }
        // select and unselect
        if (selectFileName === _selectFileName) {
            setSelectFileName('');
        } else {
            setSelectFileName(_selectFileName);
        }
        setSelectFileType(type);
    }, [selectFileName]);

    const actions = {
        onChangeFile: async (event) => {
            const file = event.target.files[0];

            if (loadToWorkspaceOnLoad) {
                dispatch(workspaceActions.uploadGcodeFile(file));
            } else {
                dispatch(workspaceActions.uploadGcodeFileToList(file));
            }
        },
        onClickToUpload: () => {
            fileInput.current.value = null;
            fileInput.current.click();
        },
        onExport: () => {
            if (!selectFileName) {
                return;
            }
            dispatch(projectActions.exportFile(selectFileName));
        },
        onChangeShouldPreview: () => {
            setLoadToWorkspaceOnLoad(!loadToWorkspaceOnLoad);
        },

        loadGcodeToWorkspace: () => {
            const find = gcodeFiles.find(v => v.uploadName === selectFileName);
            if (!find) {
                return;
            }
            dispatch(workspaceActions.renderGcodeFile(find, false));
        },

        // Wi-Fi transfer file to Snapmaker
        sendFile: () => {
            const isSendingFile = modalSmallHOC({
                title: i18n._('Sending File'),
                text: i18n._('Sending file. Please wait…'),
                iconColor: '#4CB518',
                img: 'WarningTipsProgress'
            }).ref;
            const find = gcodeFiles.find(v => v.uploadName === selectFileName);
            if (!find) {
                return;
            }
            const gcodePath = `${DATA_PREFIX}/${find.uploadName}`;
            request.get(gcodePath).end((err1, res) => {
                const gcode = res.text;
                const blob = new Blob([gcode], { type: 'text/plain' });
                const file = new File([blob], find.name);
                server.uploadFile(find.name, file, (err, data, text) => {
                    isSendingFile.current.removeContainer();
                    if (err) {
                        modalSmallHOC({
                            title: i18n._('Failed to send file.'),
                            text: text,
                            iconColor: '#FF4D4F',
                            img: 'WarningTipsError'
                        });
                    } else {
                        (modalSmallHOC({
                            title: i18n._('File sent successfully.'),
                            text: i18n._('Your file was successfully sent. Receive it on the Touchscreen.'),
                            iconColor: '#4CB518',
                            img: 'WarningTipsSuccess'
                        }));
                    }
                });
            });
        },
        importFile: (fileObj) => {
            if (fileObj) {
                actions.onChangeFile({
                    target: {
                        files: [fileObj]
                    }
                });
            } else {
                actions.onClickToUpload();
            }
        }
    };

    useEffect(() => {
        widgetActions.setTitle(i18n._('G-code Files'));

        for (let i = 0; i < 5; i++) {
            changeNameInput[i] = React.createRef();
        }
        UniApi.Event.on('appbar-menu:workspace.export-gcode', actions.onExport);
        UniApi.Event.on('appbar-menu:workspace.import', actions.importFile);
        if (gcodeFiles.length > 0) {
            onSelectFile(gcodeFiles[0].uploadName);
        }

        return () => {
            for (let i = 0; i < 5; i++) {
                changeNameInput[i] = null;
            }
            UniApi.Event.off('appbar-menu:workspace.export-gcode', actions.onExport);
            UniApi.Event.off('appbar-menu:workspace.import', actions.importFile);
        };
    }, []);

    useEffect(() => {
        if (gcodeFiles.length > 0) {
            onSelectFile(gcodeFiles[0].uploadName);
        }
    }, [gcodeFiles]);

    const isHeadType = selectFileType === headType;
    const hasFile = gcodeFiles.length > 0;

    return (
        <div>
            <input
                ref={fileInput}
                type="file"
                accept=".gcode,.nc,.cnc"
                style={{ display: 'none' }}
                multiple={false}
                onChange={actions.onChangeFile}
            />
            <Button
                width="160px"
                type="primary"
                className="margin-bottom-8 display-inline"
                priority="level-three"
                onClick={actions.onClickToUpload}
            >
                {i18n._('Open G-code')}
            </Button>
            <Button
                width="160px"
                type="primary"
                className="margin-bottom-8 display-inline margin-left-8"
                priority="level-three"
                onClick={actions.onExport}
            >
                {i18n._('Export G-code')}
            </Button>
            <div className="margin-bottom-8">
                <Checkbox
                    checked={loadToWorkspaceOnLoad}
                    onChange={actions.onChangeShouldPreview}
                />
                <span className="margin-left-8">{i18n._('Preview in workspace')}</span>
            </div>
            {
                _.map(gcodeFiles, (gcodeFile, index) => {
                    return (
                        <GcodePreviewItem
                            gcodeFile={gcodeFile}
                            index={index}
                            selected={selectFileName === gcodeFile.uploadName}
                            onSelectFile={onSelectFile}
                        />
                    );
                })
            }
            <Button
                type="primary"
                className="margin-vertical-8"
                priority="level-two"
                disabled={!hasFile}
                onClick={actions.loadGcodeToWorkspace}
            >
                {i18n._('Load G-code to Workspace')}
            </Button>
            <Button
                type="primary"
                className="margin-bottom-16"
                priority="level-two"
                disabled={!(hasFile && isConnected && isHeadType && connectionType === CONNECTION_TYPE_WIFI)}
                onClick={actions.sendFile}
            >
                {i18n._('Send to Device via Wi-Fi')}
            </Button>
        </div>
    );
}
WifiTransport.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default WifiTransport;
