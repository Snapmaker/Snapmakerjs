import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import api from '../../../api';
import CalibrationPreview from './ManualCalibration';
import Anchor from '../../../components/Anchor';
import styles from '../styles.styl';
import { EXPERIMENTAL_LASER_CAMERA } from '../../../constants';


class ManualCalibration extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        server: PropTypes.object.isRequired,
        getPoints: PropTypes.array.isRequired,
        matrix: PropTypes.object.isRequired,
        backtoCalibrationModal: PropTypes.func.isRequired,
        displayExtractTrace: PropTypes.func.isRequired,
        calibrationOnOff: PropTypes.func.isRequired,
        updateAffinePoints: PropTypes.func.isRequired
    };

    calibrationPreview = React.createRef();

    state = {
        isComfirmPoints: false,
        width: 1024,
        height: 1280
    };

    actions = {
        onClickToUpload: () => {
            api.cameraCalibrationPhoto({ 'address': this.props.server.address }).then((res) => {
                const { fileName, width, height } = JSON.parse(res.text);
                this.setState({
                    width,
                    height
                });
                this.calibrationPreview.current.onChangeImage(fileName, width, height);
            });
            this.setState({
                isComfirmPoints: false
            });
        },
        onClickToConfirm: () => {
            const { size } = this.props;
            this.setState({
                isComfirmPoints: true
            });
            this.calibrationPreview.current.updateMatrix(
                size.x,
                size.y,
            );
        },
        previousPanel: () => {
            this.props.displayExtractTrace();
        },
        setCameraCalibrationMatrix: async () => {
            this.props.calibrationOnOff(true);
            const matrix = this.props.matrix;
            const { address } = this.props.server;
            if (matrix.points !== this.props.getPoints) {
                for (let i = 0; i < matrix.points.length; i++) {
                    matrix.points[i].x = Math.floor(this.props.getPoints[i].x);
                    matrix.points[i].y = Math.floor(this.props.getPoints[i].y);
                }
                await api.setCameraCalibrationMatrix({ 'address': address, 'matrix': JSON.stringify(matrix) });
            }
            this.props.backtoCalibrationModal();
        }
    };

    componentDidMount() {
        this.actions.onClickToUpload();
    }

    render() {
        return (
            <div>
                <div className="clearfix" />
                <div className={styles['laser-set-background-modal-title']}>
                    {i18n._('Calibration')}
                </div>
                <div className={styles['laser-set-background-modal-content']}>
                    <CalibrationPreview
                        ref={this.calibrationPreview}
                        getPoints={this.props.getPoints}
                        width={this.state.width}
                        height={this.state.height}
                        updateAffinePoints={this.props.updateAffinePoints}
                    />
                    <div className={styles['calibrate-background']}>
                        <div className={classNames(styles['reset-actions'])}>
                            <Anchor
                                className={styles['reset-actions__btn']}
                                onClick={this.actions.onClickToUpload}
                            >
                                <i className={styles['reset-actions__icon-reset']} />
                            </Anchor>
                            <span className={styles['reset-actions__text']}>
                                {i18n._('Reset')}
                            </span>
                        </div>

                        <div
                            className={classNames(
                                styles['confirm-actions'],
                                styles[this.state.isComfirmPoints ? 'isBlue' : ''],
                            )}
                        >
                            <Anchor
                                className={styles['confirm-actions__btn']}
                                onClick={this.actions.onClickToConfirm}
                            >
                                <i className={styles['confirm-actions__icon-confirm']} />
                            </Anchor>
                            <span className={styles['reset-actions__text']}>
                                {i18n._('Confirm')}
                            </span>
                        </div>
                        <p style={{ margin: ' 10px 10px 0 0', textAlign: 'left' }}>
                            {i18n._('滚轮来缩放，') }
                        </p>
                        <p style={{ textAlign: 'left' }}>
                            {i18n._('按住右键左右来移动') }
                        </p>
                    </div>
                </div>
                <div style={{ minHeight: 30, width: 710, margin: '0 auto' }}>
                    {!EXPERIMENTAL_LASER_CAMERA && (
                        <button
                            type="button"
                            className={classNames(
                                'sm-btn-large',
                                styles['btn-camera'],
                            )}
                            onClick={this.actions.previousPanel}
                        >
                            {i18n._('Previous')}
                        </button>
                    )}
                    {!EXPERIMENTAL_LASER_CAMERA && (
                        <button
                            type="button"
                            className={classNames(
                                'sm-btn-large',
                                styles[this.state.isComfirmPoints ? 'btn-right-camera' : 'btn-right-camera-disabled'],
                            )}
                            disabled={!this.state.isComfirmPoints}
                            onClick={this.actions.setCameraCalibrationMatrix}
                        >
                            {i18n._('Apply')}
                        </button>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        server: machine.server,
        size: machine.size
    };
};

export default connect(mapStateToProps)(ManualCalibration);
