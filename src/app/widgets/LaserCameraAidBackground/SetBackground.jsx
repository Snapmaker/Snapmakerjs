import isEqual from 'lodash/isEqual';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { CONNECTION_TYPE_WIFI } from '../../constants';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Modal from '../../components/Modal';

import { actions } from '../../flux/laser';
import ExtractSquareTrace from './ExtractSquareTrace';
import Instructions from './Instructions';

const PANEL_EXTRACT_TRACE = 1;

class SetBackground extends PureComponent {
    static propTypes = {
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        isLaser: PropTypes.bool.isRequired,
        showInstructions: PropTypes.bool.isRequired,
        actions: PropTypes.object.isRequired,

        // redux
        size: PropTypes.object.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        removeBackgroundImage: PropTypes.func.isRequired
    };

    state = {
        showModal: false,
        // shouldStopAction: false,
        panel: PANEL_EXTRACT_TRACE,

        // print trace settings
        maxSideLength: Math.min(this.props.size.x, this.props.size.y),
        minSideLength: 40,
        sideLength: 100
    };

    actions = {
        showModal: () => {
            this.setState({
                showModal: true,
                panel: PANEL_EXTRACT_TRACE
            });
        },
        hideModal: () => {
            this.setState({
                showModal: false
            });
        },
        setBackgroundImage: (filename) => {
            const { size } = this.props;
            this.props.setBackgroundImage(filename, size.x, size.y, 0, 0);

            this.actions.hideModal();
            // this.actions.displayPrintTrace();
        },
        removeBackgroundImage: () => {
            this.props.removeBackgroundImage();
        },
        checkConnectionStatus: () => {
            const { isConnected, isLaser } = this.props;

            if (isConnected && isLaser) {
                return true;
            }

            modal({
                title: i18n._('Information'),
                body: i18n._('Laser tool head is not connected. Please make sure the laser tool head is installed properly, and then connect to your Snapmaker via Connection widget.')
            });
            return false;
        },
        changeSideLength: (sideLength) => {
            this.setState({ sideLength });
        },
        changeFilename: (filename) => {
            this.setState({ filename });
        }
    };

    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;
            const maxSideLength = Math.min(size.x, size.y);
            const minSideLength = Math.min(40, maxSideLength);
            const sideLength = Math.min(maxSideLength, Math.max(minSideLength, this.state.sideLength));
            this.setState({
                sideLength,
                minSideLength,
                maxSideLength
            });
        }
    }

    render() {
        const state = { ...this.state };
        const { showInstructions, connectionType, isConnected } = this.props;

        return (
            <React.Fragment>
                {showInstructions && <Instructions onClose={this.props.actions.hideInstructions} />}
                {state.showModal && (
                    <Modal style={{ width: '500px' }} size="lg" onClose={this.actions.hideModal}>
                        <Modal.Body style={{ margin: '0', paddingBottom: '15px', height: '100%' }}>
                            {state.panel === PANEL_EXTRACT_TRACE && (
                                <ExtractSquareTrace
                                    showModal={this.state.showModal}
                                    setBackgroundImage={this.actions.setBackgroundImage}
                                />
                            )}
                        </Modal.Body>
                    </Modal>
                )}
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={this.actions.showModal}
                    disabled={connectionType !== CONNECTION_TYPE_WIFI || !isConnected}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Add Background')}
                </button>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={this.actions.removeBackgroundImage}
                    disabled={!isConnected}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Remove Background')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        isConnected: machine.isConnected,
        connectionType: machine.connectionType,
        size: machine.size
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setBackgroundImage: (filename, width, height, dx, dy) => dispatch(actions.setBackgroundImage(filename, width, height, dx, dy)),
        removeBackgroundImage: () => dispatch(actions.removeBackgroundImage())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SetBackground);
