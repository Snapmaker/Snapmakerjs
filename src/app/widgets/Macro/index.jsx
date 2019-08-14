import classNames from 'classnames';
import PropTypes from 'prop-types';
// import get from 'lodash/get';
// import includes from 'lodash/includes';
import React, { PureComponent } from 'react';
import api from '../../api';
import Space from '../../components/Space';
import Widget from '../../components/Widget';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
// import WidgetConfig from '../WidgetConfig';
import { WidgetConfig } from '../../components/SMWidget';
import Macro from './Macro';
import AddMacro from './AddMacro';
import EditMacro from './EditMacro';
import {
    WORKFLOW_STATE_RUNNING
} from '../../constants';
import {
    MODAL_NONE,
    MODAL_ADD_MACRO,
    MODAL_EDIT_MACRO,
    MODAL_RUN_MACRO
} from './constants';
import styles from './index.styl';

class MacroWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        onFork: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        sortable: PropTypes.object
    };

    config = new WidgetConfig(this.props.widgetId);

    state = this.getInitialState();

    actions = {
        toggleFullscreen: () => {
            const { minimized, isFullscreen } = this.state;
            this.setState({
                minimized: isFullscreen ? minimized : false,
                isFullscreen: !isFullscreen
            });
        },
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState({ minimized: !minimized });
        },
        openModal: (name = MODAL_NONE, params = {}) => {
            this.setState({
                modal: {
                    name: name,
                    params: params
                }
            });
        },
        closeModal: () => {
            this.setState({
                modal: {
                    name: MODAL_NONE,
                    params: {}
                }
            });
        },
        updateModalParams: (params = {}) => {
            this.setState({
                modal: {
                    ...this.state.modal,
                    params: {
                        ...this.state.modal.params,
                        ...params
                    }
                }
            });
        },
        addMacro: async ({ name, content }) => {
            try {
                let res;
                res = await api.macros.create({ name, content });
                res = await api.macros.fetch();
                const { records: macros } = res.body;
                this.setState({ macros: macros });
            } catch (err) {
                // Ignore error
            }
        },
        deleteMacro: async (id) => {
            try {
                let res;
                res = await api.macros.delete(id);
                res = await api.macros.fetch();
                const { records: macros } = res.body;
                this.setState({ macros: macros });
            } catch (err) {
                // Ignore error
            }
        },
        updateMacro: async (id, { name, content }) => {
            try {
                let res;
                res = await api.macros.update(id, { name, content });
                res = await api.macros.fetch();
                const { records: macros } = res.body;
                this.setState({ macros: macros });
            } catch (err) {
                // Ignore error
            }
        },
        runMacro: (id) => {
            api.macros.read(id)
                .then((res) => {
                    this.setState({
                        modal: {
                            name: MODAL_RUN_MACRO,
                            params: {
                                id: res.body.id,
                                name: res.body.name,
                                content: res.body.content
                            }
                        }
                    });
                });
            // controller.command('macro:run', id, controller.context, (err, data) => {
            controller.command('macro:run', id, (err) => {
                if (err) {
                    // log.error(`Failed to run the macro: id=${id}, name="${name}"`);
                    log.error(`Failed to run the macro: id=${id}`);
                }
            });
        },
        loadMacro: async (id) => {
            try {
                const res = await api.macros.read(id);
                const { name } = res.body;
                controller.command('macro:load', id, (err, data) => {
                    if (err) {
                        log.error(`Failed to load the macro: id=${id}, name="${name}"`);
                        return;
                    }

                    log.debug(data); // TODO
                });
            } catch (err) {
                // Ignore error
            }
        },
        openAddMacroModal: () => {
            this.actions.openModal(MODAL_ADD_MACRO);
        },
        /*
        openRunMacroModal: (id) => {
            api.macros.read(id)
                .then((res) => {
                    const { name, content } = res.body;
                    this.actions.openModal(MODAL_RUN_MACRO, { id: res.body.id, name, content });
                });
        },
        */
        openEditMacroModal: (id) => {
            api.macros.read(id)
                .then((res) => {
                    const { name, content } = res.body;
                    this.actions.openModal(MODAL_EDIT_MACRO, { id: res.body.id, name, content });
                });
        }
    };

    controllerEvents = {
        'config:change': () => {
            this.fetchMacros();
        },
        'serialport:open': (options) => {
            const { port } = options;
            this.setState({ port: port });
        },
        // 'serialport:close': (options) => {
        'serialport:close': () => {
            const initialState = this.getInitialState();
            this.setState(state => ({
                ...initialState,
                macros: [...state.macros]
            }));
        },
        'controller:state': (type, controllerState) => {
            this.setState(state => ({
                controller: {
                    ...state.controller,
                    type: type,
                    state: controllerState
                }
            }));
        },
        'workflow:state': (workflowState) => {
            this.setState({
                workflowState: workflowState
            });
        }
    };

    getInitialState() {
        return {
            minimized: this.config.get('minimized', false),
            isFullscreen: false,
            port: controller.port,
            controller: {
                type: controller.type,
                state: controller.state
            },
            workflowState: controller.workflowState,
            modal: {
                name: MODAL_NONE,
                params: {}
            },
            macros: []
        };
    }

    componentDidMount() {
        this.fetchMacros();
        this.addControllerEvents();
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.minized !== this.state.minized) {
            const {
                minimized
            } = this.state;
            this.config.set('minimized', minimized);
        }
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    // Public methods
    expand = () => {
        this.setState({ minimized: false });
    };

    collapse = () => {
        this.setState({ minimized: true });
    };

    fetchMacros = async () => {
        try {
            const res = await api.macros.fetch();
            const { records: macros } = res.body;
            this.setState({ macros: macros });
        } catch (err) {
            // Ignore error
        }
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

    canClick() {
        const { port, workflowState } = this.state;
        if (!port) {
            return false;
        }

        if (workflowState === WORKFLOW_STATE_RUNNING) {
            return false;
        }
        return true;
    }

    render() {
        const { widgetId } = this.props;
        const { minimized, isFullscreen } = this.state;
        // const isForkedWidget = widgetId.match(/\w+:[\w\-]+/);
        const isForkedWidget = widgetId.match(/\w+:[\w]+/);
        const state = {
            ...this.state,
            canClick: this.canClick()
        };
        const actions = {
            ...this.actions
        };

        return (
            <Widget fullscreen={isFullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <Widget.Sortable className={this.props.sortable.handleClassName}>
                            <i className="fa fa-bars" />
                            <Space width="8" />
                        </Widget.Sortable>
                        {isForkedWidget
                        && <i className="fa fa-code-fork" style={{ marginRight: 5 }} />
                        }
                        {i18n._('Macro')}
                    </Widget.Title>
                    <Widget.Controls className={this.props.sortable.filterClassName}>
                        <Widget.Button
                            title={i18n._('New Macro')}
                            onClick={actions.openAddMacroModal}
                        >
                            <i className="fa fa-plus" />
                        </Widget.Button>
                        <Widget.Button
                            disabled={isFullscreen}
                            title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                            onClick={actions.toggleMinimized}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    { 'fa-chevron-up': !minimized },
                                    { 'fa-chevron-down': minimized }
                                )}
                            />
                        </Widget.Button>
                        <Widget.DropdownButton
                            title={i18n._('More')}
                            toggle={<i className="fa fa-ellipsis-v" />}
                            onSelect={(eventKey) => {
                                if (eventKey === 'fullscreen') {
                                    actions.toggleFullscreen();
                                } else if (eventKey === 'fork') {
                                    this.props.onFork();
                                } else if (eventKey === 'remove') {
                                    this.props.onRemove();
                                }
                            }}
                        >
                            <Widget.DropdownMenuItem eventKey="fullscreen">
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-fw',
                                        { 'fa-expand': !isFullscreen },
                                        { 'fa-compress': isFullscreen }
                                    )}
                                />
                                <Space width="4" />
                                {!isFullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
                            </Widget.DropdownMenuItem>
                            <Widget.DropdownMenuItem eventKey="fork">
                                <i className="fa fa-fw fa-code-fork" />
                                <Space width="4" />
                                {i18n._('Fork Widget')}
                            </Widget.DropdownMenuItem>
                            <Widget.DropdownMenuItem eventKey="remove">
                                <i className="fa fa-fw fa-times" />
                                <Space width="4" />
                                {i18n._('Remove Widget')}
                            </Widget.DropdownMenuItem>
                        </Widget.DropdownButton>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles['widget-content'],
                        { [styles.hidden]: minimized }
                    )}
                >
                    {state.modal.name === MODAL_ADD_MACRO
                    && <AddMacro state={state} actions={actions} />
                    }
                    {state.modal.name === MODAL_EDIT_MACRO
                    && <EditMacro state={state} actions={actions} />
                    }
                    <Macro state={state} actions={actions} />
                </Widget.Content>
            </Widget>
        );
    }
}

export default MacroWidget;
