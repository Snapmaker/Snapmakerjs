import React from 'react';
import Widget from '../../components/Widget';
import Visualizer from './Visualizer';
import SecondaryToolbar from '../VisualizerToolbar/SecondaryToolbar';
import styles from '../styles.styl';

const MODE = '3dp';

const ThreeDPrintingVisualizerWidget = () => (
    <Widget borderless>
        <Widget.Content className={styles.visualizerContent} style={{ top: 0 }}>
            <Visualizer mode={MODE} />
        </Widget.Content>
        <Widget.Footer className={styles.visualizerFooter}>
            <SecondaryToolbar mode={MODE} />
        </Widget.Footer>
    </Widget>
);

export default ThreeDPrintingVisualizerWidget;
