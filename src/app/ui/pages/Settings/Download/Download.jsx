// import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
// import FacebookLoading from 'react-facebook-loading';
// import { connect } from 'react-redux';
// import settings from '../../../../config/settings';
import isElectron from 'is-electron';
import { connect } from 'react-redux';
import { actions as appGlobalActions } from '../../../../flux/app-global';
import i18n from '../../../../lib/i18n';
import SvgIcon from '../../../components/SvgIcon';
import { TextInput } from '../../../components/Input';
import UniApi from '../../../../lib/uni-api';

function Download(props) {
    const [selectedFolder, setSelectedFolder] = useState(props.downloadManangerSavedPath);
    console.log(props);
    const actions = {
        onSave: () => {
            props.updateDownloadManangerSavedPath(selectedFolder);
            console.log('save download config');
        },
        onCancel: () => {
            console.log('cancel download config');
        }
    };

    useEffect(() => {
        function cleanup() {
            UniApi.Event.off('appbar-menu:settings.save', actions.onSave);
            UniApi.Event.off('appbar-menu:settings.cancel', actions.onCancel);
        }

        cleanup();
        UniApi.Event.on('appbar-menu:settings.save', actions.onSave);
        UniApi.Event.on('appbar-menu:settings.cancel', actions.onCancel);
        return cleanup;
    }, [actions.onSave, actions.onCancel]);

    const savePath = path => {
        setSelectedFolder(path);
    };

    const handleFolderChange = (folder) => {
        savePath(folder);
    };

    const onClickToUpload = () => {
        if (!isElectron()) return;
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('select-directory');
        ipcRenderer.on('selected-directory', (event, data) => {
            console.log(event, data);
            const { canceled, filePaths } = JSON.parse(data);
            if (canceled) return;
            savePath(filePaths[0]);
        });
    };

    return (
        <div>
            <form>
                <div>
                    <div className="border-bottom-normal padding-bottom-4">
                        <SvgIcon
                            name="TitleSetting"
                            type={['static']}
                        />
                        <span className="margin-left-4">{i18n._('key-App/Settings/General-Language')}</span>
                    </div>
                    <div className="margin-top-16">
                        <div className="padding-bottom-4">
                            <TextInput size="250px" value={selectedFolder} onChange={handleFolderChange} />
                            <SvgIcon
                                type={['hoverSpecial', 'pressSpecial']}
                                name="ToolbarOpen"
                                className="padding-horizontal-4 print-tool-bar-open margin-left-12"
                                onClick={() => onClickToUpload()}
                                size={31}
                                color="#545659"
                            />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

Download.propTypes = {
    downloadManangerSavedPath: PropTypes.string.isRequired,
    // actions: PropTypes.object.isRequired,
    updateDownloadManangerSavedPath: PropTypes.func.isRequired
};


const mapStateToProps = (state) => {
    const { downloadManangerSavedPath } = state.appGlobal;
    return {
        downloadManangerSavedPath
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateDownloadManangerSavedPath: path => dispatch(appGlobalActions.updateDownloadManangerSavedPath(path))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Download);
