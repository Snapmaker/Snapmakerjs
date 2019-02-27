import { combineReducers } from 'redux';
import machine from './machine';
import laser from './laser';
import cnc from './cnc';
import cncLaserShared from './cncLaserShared';
import workspace from './workspace';
import keyboardShortcut from './keyboardShortcut';

export default combineReducers({
    workspace,
    machine,
    laser,
    cnc,
    cncLaserShared,
    keyboardShortcut
});

