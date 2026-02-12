export type MyFeatureProfile = FeatureProfileCore | FeatureProfileFirmwareManagement | FeatureProfileLocalAuthListManagement | FeatureProfileSmartCharging

type FeatureProfileCore =
  'Authorize' | // Example when two different online cards: card #1 swiped and starts, card #2 swipes, card #2 is checked by back-end card, if accepted charging stops. If rejected charging continues.
  'BootNotification' |
  'ChangeAvailability' |
  'ChangeConfiguration' |
  'ClearCache' | // The cache is empty, while the charger received the command, it will response accept but do nothing.
  'DataTransfer' | // @deprecated
  'GetConfiguration' | // Before FW 1.3 the charger will only response with support keys. After FW1.3 charger will response with all keys, in case the key not supported, the charger will response “unknown” Refer section Supported keys.
  'Heartbeat' |
  'MeterValues' | // ABB supports following Measurand types for AC:
  // • Energy.Active.Import.Register
  // • Current.Import
  // • Voltage
  // • Power.Active.Import
  // • Current.Offered
  'RemoteStartTransaction' |
  'RemoteStopTransaction' |
  'Reset' | // Chargers support hard reset and soft reset.
  // Hard reset fully reboot charger. The resets gracefully stop charging session if one is in pro- gress before resetting.
  // Soft reset gracefully stops charging session if one is in progress before resetting. Then the charger gracefully disconnects from the server. After disconnection, the charger will reboot it- self.
  'StartTransaction' |
  'StatusNotification' |
  'StopTransaction' |
  'UnlockConnector' // Message is supported only to socket variants, upon receiving this message, socket variants charger will release the E-lock of socket. If send the message to cable variants, the charger will response with NotSupported.

type FeatureProfileFirmwareManagement =
  'GetDiagnostics' | // Supports 7-day logs with 300 lines/less than 25kb per day.
  // Charger uploads the files by HTTP/HTTPS based on the server connection.
  'DiagnosticsStatusNotification' | // Support status: Uploading, Uploaded, Upload- Failed, Idle.
  'FirmwareStatusNotification' | // Charger will response the status: • Downloading
  // • Installed
  // • DownloadFailed
  // • InstallationFailed
  'UpdateFirmware'

type FeatureProfileLocalAuthListManagement =
  'GetLocalListVersion' |
  'SendLocalList' |
  'CancelReservation' |
  'ReserveNow'

// Not supported atm
// type FeatureProfileReservation =
//   'CancelReservation' |
//   'ReserveNow'

type FeatureProfileSmartCharging =
  'ClearChargingProfile' |
  'GetCompositeSchedule' |
  'SetChargingProfile' // ChargeProfileMaxStackLevel = 16 for display models.
// ChargeProfileMaxStackLevel = 3 for non-display models.

type FeatureProfileRemoteTrigger = 'TriggerMessage'
// Chargers supports below MessageTrigger:
// • BootNotification
// • DiagnosticsStatusNotification
// • FirmwareStatusNotification
// • Heartbeat
// • MeterValues
// • StatusNotification

type FeatureProfileExtendedSecurity = 
  'CertificateSigned' |
  'SecurityEventNotification'