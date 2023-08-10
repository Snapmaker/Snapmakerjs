

enum ControllerEvent {
    /**
     * Machine Discover
     */
    DiscoverMachine = 'discover:machine',
    DiscoverMachineStart = 'discover:start',
    DiscoverMachineEnd = 'discover:end',


    /**
     * Connection
     */
    ConnectionOpen = 'connection:open',
    ConnectionClose = 'connection:close',

    /**
     * Global
     */
    ExecuteGCode = 'connection:executeGcode',
    ExecuteCmd = 'connection:executeCmd',

    /**
     * Motion
     */
    GoHome = 'connection:goHome',
    Move = 'connection:coordinateMove', // Linear Move
    SetOrigin = 'connection:setWorkOrigin',
    SetSpeedFactor = 'connection:updateWorkSpeedFactor',

    /**
     * 3D Printing
     */
    SwitchActiveExtruder = 'connection:updateWorkNozzle',
    SetExtruderTemperature = 'connection:updateNozzleTemperature',
    LoadFilament = 'connection:loadFilament',
    UnloadFilamnet = 'connection:unloadFilament',
    SetBedTemperature = 'connection:updateBedTemperature',
    SetZOffset = 'connection:updateZOffset',

    /**
     * Laser
     */
    SetLaserPower = 'connection:updateLaserPower',
    SwitchLaserPower = 'connection:switchLaserPower', // ?
    CalcMaterialThickness = 'connection:materialThickness',
    AbortMaterialThickness = 'connection:materialThickness_abort',

    /**
     * CNC
     */
    SwitchCNC = 'connection:switchCNC', // ?
    SetSpindleSpeed = 'connection:updateToolHeadSpeed',

    /**
     * Enclosure
     */
    SetEnclosureLight = 'connection:setEnclosureLight',
    SetEnclosureFan = 'connection:setEnclosureFan',
    SetEnclosureDoorDetection = 'connection:setDoorDetection',

    /**
     * File
     */
    UploadFile = 'connection:uploadFile',

    /**
     * Machine Network (Wi-Fi)
     */
    GetMachineNetworkConfiguration = 'machine:get-network-configuration',
    GetMachineNetworkStationState = 'machine:get-network-station-state',
    SetMachineNetworkConfiguration = 'machine:set-network-configuration',

    /**
     * Machine System
     */
    ExportLogToExternalStorage = 'machine:export-log-to-external-storage',
    GetFirmwareVersion = 'machine:get-firmware-version',
    UpgradeFirmware = 'machine:upgrade-firmware',

    /**
     * G-code control.
     */
    StartGCode = 'connection:startGcode',
    PauseGCode = 'connection:pauseGcode',
    ResumeGCode = 'connection:resumeGcode',
    StopGCode = 'connection:stopGcode',

    /**
     * Operating System
     */
    ListWiFiNetworks = 'os:list-wifi-networks',
}

export default ControllerEvent;
