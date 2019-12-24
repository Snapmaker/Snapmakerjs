import isEqual from 'lodash/isEqual';
import get from 'lodash/get';
import set from 'lodash/set';
import events from 'events';
import semver from 'semver';
// import PacketManager from '../PacketManager';
import { HEAD_TYPE_3DP, HEAD_TYPE_LASER, HEAD_TYPE_CNC } from '../constants';

// http://stackoverflow.com/questions/10454518/javascript-how-to-retrieve-the-number-of-decimals-of-a-string-number
function decimalPlaces(num) {
    const match = (String(num)).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!match) {
        return 0;
    }
    return Math.max(
        0,
        // Number of digits right of decimal point.
        (match[1] ? match[1].length : 0)
        // Adjust for scientific notation.
        - (match[2] ? +match[2] : 0)
    );
}


/**
 * Reply parser for tool head type (M1006)
 *
 * For details see [Snapmaker-GD32Base](https://snapmaker2.atlassian.net/wiki/spaces/SNAP/pages/3440681/Snapmaker-GD32Base).
 * Examples:
 *  'Firmware Version: Snapmaker-Base-2.2'
 *  'Firmware Version: Snapmaker-Base-2.4-beta'
 *  'Firmware Version: Snapmaker-Base-2.4-alpha3'
 */
class MarlinReplyParserFirmwareVersion {
    static parse(line) {
        const r = line.match(/^Firmware Version: (.*)-([0-9.]+(-(alpha|beta)[1-9]?)?)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserFirmwareVersion,
            payload: {
                version: semver.coerce(r[2])
            }
        };
    }
}

/**
 * Marlin SM2-1.2.1.0
 */
class MarlinReplyParserSeries {
    static parse(line) {
        const r = line.match(/^Marlin (.*)-([0-9.]+)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserSeries,
            payload: {
                series: r[1],
                version: semver.coerce(r[2]).version
            }
        };
    }
}

/**
 * Machine Size: L
 */
class MarlinReplyParserSeriesSize {
    static parse(line) {
        const r = line.match(/^Machine Size: (.*)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserSeriesSize,
            payload: {
                seriesSize: r[1].trim()
            }
        };
    }
}


class MarlinReplyParserEmergencyStop {
    static parse(line) {
        const r = line.match(/;Locked UART/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserEmergencyStop,
            payload: {
                releaseDate: r[2]
            }
        };
    }
}


class MarlinReplyParserReleaseDate {
    static parse(line) {
        const r = line.match(/^Release Date: (.*)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserReleaseDate,
            payload: {
                releaseDate: r[2]
            }
        };
    }
}


class MarlinReplyParserToolHead {
    static parse(line) {
        const r = line.match(/^Tool Head: ([a-zA-Z0-9 ]+)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserToolHead,
            payload: {
                headType: r[1]
            }
        };
    }
}

class MarlinReplyParserEnclosure {
    static parse(line) {
        const r = line.match(/^Enclosure: (On|Off)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserEnclosure,
            payload: {
                enclosure: r[1] === 'On'
            }
        };
    }
}

class MarlinReplyParserEnclosureDoor {
    static parse(line) {
        const r = line.match(/^Door: (Open|Closed)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserEnclosure,
            payload: {
                enclosure: r[1] === 'Open'
            }
        };
    }
}

class MarlinLineParserResultStart {
    // start
    static parse(line) {
        const r = line.match(/^start$/);
        if (!r) {
            return null;
        }

        const payload = {};

        return {
            type: MarlinLineParserResultStart,
            payload: payload
        };
    }
}


class MarlinLineParserResultPosition {
    // X:0.00 Y:0.00 Z:0.00 E:0.00 Count X:0 Y:0 Z:0
    static parse(line) {
        const r = line.match(/^(?:(?:X|Y|Z|E):[0-9.-]+\s+)+/i);
        if (!r) {
            return null;
        }

        const payload = {
            pos: {}
        };
        const pattern = /((X|Y|Z|E):[0-9.-]+)+/gi;
        const params = r[0].match(pattern);

        for (const param of params) {
            const nv = param.match(/^(.+):(.+)/);
            if (nv) {
                const axis = nv[1].toLowerCase();
                const pos = nv[2];
                const digits = decimalPlaces(pos);
                payload.pos[axis] = Number(pos).toFixed(digits);
            }
        }

        return {
            type: MarlinLineParserResultPosition,
            payload: payload
        };
    }
}

class MarlinLineParserResultOk {
    // ok
    static parse(line) {
        const r = line.match(/^ok($| [0-9]+$)/);
        if (!r) {
            return null;
        }

        const payload = {};

        return {
            type: MarlinLineParserResultOk,
            payload: payload
        };
    }
}

class MarlinLineParserResultEcho {
    // echo:
    static parse(line) {
        const r = line.match(/^echo:\s*(.+)$/i);
        if (!r) {
            return null;
        }

        const payload = {
            message: r[1]
        };

        return {
            type: MarlinLineParserResultEcho,
            payload: payload
        };
    }
}

class MarlinLineParserResultError {
    // Error:Printer halted. kill() called!
    static parse(line) {
        const r = line.match(/^Error:\s*(.+)$/i);
        if (!r) {
            return null;
        }

        const payload = {
            message: r[1]
        };

        return {
            type: MarlinLineParserResultError,
            payload: payload
        };
    }
}

class MarlinLineParserResultOkTemperature {
    static parse(line) {
        const re = /ok (T):([0-9.-]+) *\/([0-9.-]+).*(B):([0-9.-]+) *\/([0-9.-]+)/g;
        const r = re.exec(line);
        if (!r) {
            return null;
        }
        const payload = {
            temperature: {}
        };


        const params = [[r[1], r[2], r[3]], [r[4], r[5], r[6]]];
        for (const param of params) {
            // const nv = param.match(/^(.+):(.+)/);
            // if (nv) {
            const axis = param[0].toLowerCase();
            const pos = param[1];
            const posTarget = param[2];
            const digits = decimalPlaces(pos);
            const digitsTarget = decimalPlaces(posTarget);
            payload.temperature[axis] = Number(pos).toFixed(digits);
            payload.temperature[`${axis}Target`] = Number(posTarget).toFixed(digitsTarget);
        }
        return {
            type: MarlinLineParserResultOkTemperature,
            payload: payload
        };
    }
}

class MarlinLineParserResultTemperature {
    static parse(line) {
        const re = /(T):([0-9.-]+) *\/([0-9.-]+).*(B):([0-9.-]+) *\/([0-9.-]+)/g;
        const r = re.exec(line);
        if (!r) {
            return null;
        }
        const payload = {
            temperature: {}
        };

        const params = [[r[1], r[2], r[3]], [r[4], r[5], r[6]]];
        for (const param of params) {
            // const nv = param.match(/^(.+):(.+)/);
            // if (nv) {
            const axis = param[0].toLowerCase();
            const pos = param[1];
            const posTarget = param[2];
            const digits = decimalPlaces(pos);
            const digitsTarget = decimalPlaces(posTarget);
            payload.temperature[axis] = Number(pos).toFixed(digits);
            payload.temperature[`${axis}Target`] = Number(posTarget).toFixed(digitsTarget);
        }
        return {
            type: MarlinLineParserResultTemperature,
            payload: payload
        };
    }
}

class MarlinParserSelectedOrigin {
    static parse(line) {
        const r = line.match(/^Selected origin num: (.*)$/);
        if (!r) {
            return null;
        }
        const payload = {
            message: r[1]
        };

        return {
            type: MarlinParserSelectedOrigin,
            payload: payload
        };
    }
}


class MarlinParserSelectedCurrent {
    static parse(line) {
        const r = line.match(/^Selected == Current: (.*)$/);
        if (!r) {
            return null;
        }
        const payload = {
            message: r[1]
        };

        return {
            type: MarlinParserSelectedCurrent,
            payload: payload
        };
    }
}

class MarlinParserOriginOffset {
    static parse(line) {
        const r = line.match(/^Origin offset ([XYZ]): (.*)$/);
        if (!r) {
            return null;
        }

        const key = r[1].toLowerCase();
        const data = parseFloat(r[2]);
        const originOffset = {};
        originOffset[key] = data;

        return {
            type: MarlinParserOriginOffset,
            payload: {
                originOffset
            }
        };
    }
}

class MarlinParserHomeState {
    static parse(line) {
        const r = line.match(/^Homed: (.*)$/);
        if (!r) {
            return null;
        }
        let isHomed = null;
        if (r[1] === 'YES') {
            isHomed = true;
        } else if (r[1] === 'NO') {
            isHomed = false;
        }

        return {
            type: MarlinParserHomeState,
            payload: {
                isHomed
            }
        };
    }
}

class MarlinLineParser {
    parse(line) {
        const parsers = [
            // ok
            MarlinLineParserResultOk,

            // cnc emergency stop when enclosure open
            MarlinReplyParserEmergencyStop,

            // New Parsers (follow headType `MarlinReplyParserXXX`)
            // M1005
            MarlinReplyParserFirmwareVersion,

            // Marlin SM2-1.2.1.0
            MarlinReplyParserSeries,

            // Machine Size: L
            MarlinReplyParserSeriesSize,

            MarlinReplyParserReleaseDate,
            // M1006
            MarlinReplyParserToolHead,
            // M1010
            MarlinReplyParserEnclosure,
            MarlinReplyParserEnclosureDoor,

            // start
            MarlinLineParserResultStart,

            // X:0.00 Y:0.00 Z:0.00 E:0.00 Count X:0 Y:0 Z:0
            MarlinLineParserResultPosition,

            // echo:
            MarlinLineParserResultEcho,

            // Error:Printer halted. kill() called!
            MarlinLineParserResultError,

            MarlinLineParserResultOkTemperature,
            // ok T:293.0 /0.0 B:25.9 /0.0 B@:0 @:0
            MarlinLineParserResultTemperature,
            // Homed: YES
            MarlinParserHomeState,

            MarlinParserOriginOffset,

            MarlinParserSelectedCurrent,

            MarlinParserSelectedOrigin

        ];

        for (const parser of parsers) {
            const result = parser.parse(line);
            if (result) {
                set(result, 'payload.raw', line);
                return result;
            }
        }

        return {
            type: null,
            payload: {
                raw: line
            }
        };
    }
}

class Marlin extends events.EventEmitter {
    state = {
        series: '',
        seriesSize: '',
        // firmware version
        version: '1.0.0',
        // tool head type
        headType: '',
        pos: {
            x: '0.000',
            y: '0.000',
            z: '0.000',
            e: '0.000'
        },
        modal: {
            motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
            units: 'G21', // G20: Inches, G21: Millimeters
            distance: 'G90', // G90: Absolute, G91: Relative
            feedrate: 'G94', // G93: Inverse time mode, G94: Units per minute
            spindle: 'M5' // M3: Spindle (cw), M4: Spindle (ccw), M5: Spindle off
        },
        speedFactor: 100,
        extruderFactor: 100,
        temperature: {
            b: '0.0',
            bTarget: '0.0',
            t: '0.0',
            tTarget: '0.0'
        },
        spindle: 0, // Related to M3, M4, M5
        jogSpeed: 0, // G0
        workSpeed: 0, // G1
        headStatus: false,
        // Head Power (in percentage, an integer between 0~100)
        headPower: 0,
        gcodeFile: null,
        updateFile: null,
        calibrationMargin: 0,
        updateProgress: 0,
        updateCount: 0,
        firmwareVersion: '',
        moduleID: 0,
        moduleVersion: '',
        machineSetting: {},
        zFocus: 15,
        gcodeHeader: 0,
        isHomed: null,
        originOffset: {
            x: 0,
            y: 0,
            z: 0
        },
        hexModeEnabled: false,
        isScreenProtocol: false
    };

    settings = {
        // whether enclosure is turned on
        enclosure: false,
        enclosureDoor: false
    };

    parser = new MarlinLineParser();

    // packetManager = new PacketManager();

    setState(state) {
        const nextState = { ...this.state, ...state };

        if (!isEqual(this.state, nextState)) {
            this.state = nextState;
        }
    }

    set(settings) {
        const nextSettings = { ...this.settings, ...settings };

        if (!isEqual(this.settings, nextSettings)) {
            this.settings = nextSettings;
        }
    }

    parse(data) {
        data = (String(data)).replace(/\s+$/, '');
        if (!data) {
            return;
        }

        this.emit('raw', { raw: data });

        const result = this.parser.parse(data) || {};
        const { type, payload } = result;

        if (type === MarlinReplyParserFirmwareVersion) {
            this.setState({ version: payload.version });
            this.emit('firmware', payload);
        } else if (type === MarlinReplyParserSeries) {
            this.setState({ series: payload.series, version: payload.version });
            this.emit('series', payload);
        } else if (type === MarlinReplyParserSeriesSize) {
            this.setState({ seriesSize: payload.seriesSize });
            this.emit('series', payload);
        } else if (type === MarlinReplyParserReleaseDate) {
            this.emit('firmware', payload);
        } else if (type === MarlinReplyParserToolHead) {
            if (this.state.headType !== payload.headType) {
                this.setState({ headType: payload.headType });
            }
            this.emit('headType', payload);
        } else if (type === MarlinReplyParserEnclosure) {
            if (this.settings.enclosure !== payload.enclosure) {
                this.set({ enclosure: payload.enclosure });
            }
            this.emit('enclosure', payload);
        } else if (type === MarlinReplyParserEnclosureDoor) {
            if (this.settings.enclosureDoor !== payload.enclosureDoor) {
                this.set({ enclosureDoor: payload.enclosureDoor });
            }
            this.emit('enclosure', payload);
        } else if (type === MarlinLineParserResultStart) {
            this.emit('start', payload);
        } else if (type === MarlinReplyParserEmergencyStop) {
            this.emit('cnc:stop', payload);
        } else if (type === MarlinParserOriginOffset) {
            this.setState({
                originOffset: {
                    ...this.state.originOffset,
                    ...payload.originOffset
                }
            });
            this.emit('originOffset', payload);
        } else if (type === MarlinLineParserResultPosition) {
            const nextState = {
                ...this.state,
                pos: {
                    ...this.state.pos,
                    ...payload.pos
                }
            };

            if (!isEqual(this.state.pos, nextState.pos)) {
                this.state = nextState; // enforce change
            }
            this.emit('pos', payload);
        } else if (type === MarlinLineParserResultOk) {
            this.emit('ok', payload);
        } else if (type === MarlinLineParserResultError) {
            this.emit('error', payload);
        } else if (type === MarlinLineParserResultEcho) {
            this.emit('echo', payload);
        } else if (type === MarlinLineParserResultTemperature
            || type === MarlinLineParserResultOkTemperature) {
            // For firmware version < 2.4, we use temperature to determine head type
            if (semver.lt(this.state.version, '2.4.0') && !this.state.headType) {
                if (payload.temperature.t <= 275) {
                    this.state.headType = HEAD_TYPE_3DP;
                } else if (payload.temperature.t <= 400) {
                    this.state.headType = HEAD_TYPE_LASER;
                } else {
                    this.state.headType = HEAD_TYPE_CNC;
                }
                // just regard this M105 command as a M1005 request
                this.emit('firmware', { version: this.state.version, ...payload });
                this.emit('ok', payload);
            } else {
                this.setState({ temperature: payload.temperature });
                this.emit('temperature', payload);
                if (type === MarlinLineParserResultOkTemperature) {
                    this.emit('ok', payload);
                }
            }
        } else if (type === MarlinParserHomeState) {
            this.setState({ isHomed: payload.isHomed });
            this.emit('home', payload);
        } else if (type === MarlinParserSelectedOrigin) {
            this.emit('selected', payload);
        } else if (type === MarlinParserSelectedCurrent) {
            this.emit('selected', payload);
        } else if (data.length > 0) {
            this.emit('others', payload);
        }
    }

    getPosition(state = this.state) {
        return get(state, 'pos', {});
    }

    getModal(state = this.state) {
        return get(state, 'modal', {});
    }
}

export {
    MarlinLineParser,
    MarlinLineParserResultStart,
    MarlinLineParserResultPosition,
    MarlinLineParserResultOk,
    MarlinLineParserResultEcho,
    MarlinLineParserResultError,
    MarlinLineParserResultTemperature,
    MarlinLineParserResultOkTemperature,
    MarlinParserHomeState
};
export default Marlin;
