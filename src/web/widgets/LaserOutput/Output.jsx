import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import { WEB_CACHE_IMAGE, STAGE_GENERATED } from '../../constants';
import i18n from '../../lib/i18n';
import styles from '../styles.styl';


class Output extends PureComponent {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        stage: PropTypes.number.isRequired,
        output: PropTypes.object.isRequired,
        workState: PropTypes.string.isRequired
    };

    actions = {
        onLoadGcode: () => {
            const { mode, output } = this.props;

            const gcodePath = `${WEB_CACHE_IMAGE}/${output.gcodePath}`;
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
            jQuery.get(gcodePath, (result) => {
                pubsub.publish('gcode:upload', {
                    gcode: result,
                    meta: {
                        name: gcodePath,
                        renderMethod: (mode === 'greyscale' ? 'point' : 'line')
                    }
                });
            });
        },
        onExport: () => {
            // https://stackoverflow.com/questions/3682805/javascript-load-a-page-on-button-click
            const gcodePath = this.props.output.gcodePath;
            document.location.href = '/api/gcode/download_cache?filename=' + gcodePath;
        }
    };

    render() {
        const disabled = this.props.workState === 'running'
            || this.props.stage < STAGE_GENERATED;

        return (
            <div>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onLoadGcode}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%' }}
                >
                    {i18n._('Load G-code to Workspace')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={this.actions.onExport}
                    disabled={disabled}
                    style={{ display: 'block', width: '100%', marginTop: '10px' }}
                >
                    {i18n._('Export G-code to file')}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        mode: state.laser.mode,
        stage: state.laser.stage,
        workState: state.laser.workState,
        output: state.laser.output
    };
};

export default connect(mapStateToProps)(Output);
