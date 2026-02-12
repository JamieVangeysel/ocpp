export enum MessageType {
  CALL = 2,
  CALLRESULT = 3,
  CALLERROR = 4
}

// Status in a response to an Authorize.req.
export type AuthorizationStatus =
  'Accepted' | // Identifier is allowed for charging.
  'Blocked' | // Identifier has been blocked. Not allowed for charging.
  'Expired' | // Identifier has expired. Not allowed for charging.
  'Invalid' | // Identifier is unknown. Not allowed for charging.
  'ConcurrentTx' // Identifier is already involved in another transaction and multiple transactions are not allowed. (Only relevant for a StartTransaction.req.)

// Status returned in response to ChangeAvailability.req.
export type AvailabilityStatus =
  'Accepted' | // Request has been accepted and will be executed.
  'Rejected' | // Request has not been accepted and will not be executed.
  'Scheduled' // Request has been accepted and will be executed when transaction(s) in progress have finished.

// Requested availability change in ChangeAvailability.req.
export type AvailabilityType =
  'Inoperative' | // Charge point is not available for charging.
  'Operative' // Charge point is available for charging.

// Status in CancelReservation.conf.
export type CancelReservationStatus =
  'Accepted' | // Reservation for the identifier has been cancelled.
  'Rejected' // Reservation could not be cancelled, because there is no reservation active for the identifier.

// Charge Point status reported in StatusNotification.req.
export type ChargePointErrorCode =
  'ConnectorLockFailure' | // Failure to lock or unlock connector.
  'EVCommunicationError' | // Communication failure with the vehicle, might be Mode 3 or other communication protocol problem.
  // This is not a real error in the sense that the Charge Point doesn’t need to go to the faulted state.
  // Instead, it should go to the SuspendedEVSE state.
  'GroundFailure' | // Ground fault circuit interrupter has been activated.
  'HighTemperature' | // Temperature inside Charge Point is too high.
  'InternalError' | // Error in internal hard- or software component.
  'LocalListConflict' | // The authorization information received from the Central System is in conflict with the LocalAuthorizationList.
  'NoError' | // No error to report.
  'OtherError' | // Other type of error. More information in vendorErrorCode.
  'OverCurrentFailure' | // Over current protection device has tripped.
  'OverVoltage' | // Voltage has risen above an acceptable level.
  'PowerMeterFailure' | // Failure to read power meter.
  'PowerSwitchFailure' | // Failure to control power switch.
  'ReaderFailure' | // Failure with idTag reader.
  'ResetFailure' | // Unable to perform a reset.
  'UnderVoltage' | // Voltage has dropped below an acceptable level.
  'WeakSignal' // Wireless communication device reports a weak signal.

// Status reported in StatusNotification.req. A status can be reported for the Charge Point main controller (connectorId = 0) or for a specific connector.
// Status for the Charge Point main controller is a subset of the enumeration: Available, Unavailable or Faulted.

// States considered Operative are: Available, Preparing, Charging, SuspendedEVSE, SuspendedEV, Finishing, Reserved.
// States considered Inoperative are: Unavailable, Faulted.
export type ChargePointStatus =
  'Available' | // When a Connector becomes available for a new user
  'Preparing' | // When a Connector becomes no longer available for a new user but no charging session is active. Typically a Connector is occupied when a user presents a tag, inserts a cable or a vehicle occupies the parking bay
  'Charging' | // When the contactor of a Connector closes, allowing the vehicle to charge
  'SuspendedEVSE' | // When the contactor of a Connector opens upon request of the EVSE, e.g. due to a smart charging restriction or as the result of StartTransaction.conf indicating that charging is not allowed
  'SuspendedEV' | // When the EVSE is ready to deliver energy but contactor is open, e.g. the EV is not ready.
  'Finishing' | // When a charging session has stopped at a Connector, but the Connector is not yet available for a new user, e.g. the cable has not been removed or the vehicle has not left the parking bay
  'Reserved' | // When a Connector becomes reserved as a result of a Reserve Now command
  'Unavailable' | // When a Connector becomes unavailable as the result of a Change Availability command or an event upon which the Charge Point transitions to unavailable at its discretion. Upon receipt of a Change Availability command, the status MAY change immediately or the change MAY be scheduled. When scheduled, the Status Notification shall be send when the availability change becomes effective
  'Faulted' // When a Charge Point or connector has reported an error and is not available for energy delivery.

export interface ChargingProfile { // 8
  chargingProfileId: number // Required. Unique identifier for this profile.
  transactionId?: number // Optional. Only valid if ChargingProfilePurpose is set to TxProfile, the transactionId MAY be used to match the profile to a specific transaction.
  stackLevel: number // Required. Value determining level in hierarchy stack of profiles. Higher values have precedence over lower values. Lowest level is 0.
  chargingProfilePurpose: ChargingProfilePurposeType // Required. Defines the purpose of the schedule transferred by this message.
  chargingProfileKind: ChargingProfileKindType // Required. Indicates the kind of schedule.
  recurrencyKind?: RecurrencyKindType // Optional. Indicates the start point of a recurrence.
  validFrom?: Date // Optional. Point in time at which the profile starts to be valid. If absent, the profile is valid as soon as it is received by the Charge Point. Not to be used when ChargingProfilePurpose is TxProfile.
  validTo?: Date // Optional. Point in time at which the profile stops to be valid. If absent, the profile is valid until it is replaced by another profile. Not to be used when ChargingProfilePurpose is TxProfile.
  chargingSchedule: ChargingSchedule // Required. Contains limits for the available power or current over time.
}

export type ChargingProfileKindType = // 9
  'Absolute' | // Schedule periods are relative to a fixed point in time defined in the schedule.
  'Recurring' | // The schedule restarts periodically at the first schedule period.
  'Relative' // Schedule periods are relative to a situation- specific start point (such as the start of a session) that is determined by the charge point.

export type ChargingProfilePurposeType = // 10
  'ChargePointMaxProfile' | // Configuration for the maximum power or current available for an entire Charge Point. SetChargingProfile.req message.
  'TxDefaultProfile' | // Default profile to be used for new transactions.
  'TxProfile' // Profile with constraints to be imposed by the Charge Point on the current transaction. A profile with this purpose SHALL cease to be valid when the transaction terminates.

export type ChargingProfileStatus = // 11
  'Accepted' | // Request has been accepted and will be executed.
  'Rejected' | // Request has not been accepted and will not be executed.
  'NotSupported' // Charge Point indicates that the request is not supported.

export type ChargingRateUnitType = // 12
  'W' | // Watts (power).
  'A' // Amperes (current).

export interface ChargingSchedule { // 13
  duration?: number // Optional. Duration of the charging schedule in seconds. If the duration is left empty, the last period will continue indefinitely or until end of the transaction in case startSchedule is absent.
  startSchedule?: Date // Optional. Starting point of an absolute schedule. If absent the schedule will be relative to start of charging.
  chargingRateUnit: ChargingRateUnitType // Required. The unit of measure Limit is expressed in.
  chargingSchedulePeriod: ChargingSchedulePeriod[] // Required. List of ChargingSchedulePeriod elements defining maximum power or current usage over time.
  minChargingRate?: number // Optional. Minimum charging rate supported by the electric vehicle. The unit of measure is defined by the chargingRateUnit. This parameter is intended to be used by a local smart charging algorithm to optimize the power allocation for in the case a charging process is inefficient at lower charging rates. Accepts at most one digit fraction (e.g. 8.1)
}

export interface ChargingSchedulePeriod { // 14
  startPeriod: number // Required. Start of the period, in seconds from the start of schedule. The value of StartPeriod also defines the stop time of the previous period.
  limit: number // Required. Power limit during the schedule period, expressed in Amperes. Accepts at most one digit fraction (e.g. 8.1).
  numberPhases?: 1 | 3 // Optional. The number of phases that can be used for charging. If a number of phases is needed, numberPhases=3 will be assumed unless another number is given.
}

export type ClearCacheStatus = // 20
  'Accepted' | // Command has been executed.
  'Rejected' // Command has not been executed.

export type ClearChargingProfileStatus = // 21
  'Accepted' | // Request has been accepted and will be executed.
  'Unknown' // No Charging Profile(s) were found matching the request.

export interface IdTagInfo {
  expiryDate?: Date // Optional. This contains the date at which idTag should be removed from the Authorization Cache.
  parentIdTag?: string // Optional. This contains the parent-identifier.
  status: AuthorizationStatus
}

export interface IdToken {
  IdToken: string
}

// Contains information about a specific configuration key. It is returned in GetConfiguration.conf.
export interface KeyValue {
  key: string // CiString50Type Required.
  readonly: boolean // Required. False if the value can be set with the ChangeConfiguration message.
  value?: string // CiString500Type Optional. If key is known but not set, this field may be absent.
}

export type Location = ''

export type Measurand = 'Energy.Active.Import.Register' |
  'Power.Active.Import' |
  'Current.Import' |
  'Current.Offered' |
  'SoC' |
  'Voltage' |
  'Temperature'

export type MessageTrigger =
  'BootNotification' | // To trigger a BootNotification request
  'DiagnosticsStatusNotification' | // To trigger a DiagnosticsStatusNotification request
  'FirmwareStatusNotification' | // To trigger a FirmwareStatusNotification request
  'Heartbeat' | // To trigger a Heartbeat request
  'MeterValues' | // To trigger a MeterValues request
  'StatusNotification' // To trigger a StatusNotification request

export interface MeterValue {
  timestamp: Date
  sampledValue: SampledValue[]
}

export type ConfigurationStatus =
  'Accepted' | // Configuration key supported and setting has been changed.
  'Rejected' | // Configuration key supported, but setting could not be changed.
  'RebootRequired' | // Configuration key supported and setting has been changed, but change will be available after reboot (Charge Point will not reboot itself)
  'NotSupported' // Configuration key is not supported.

export type ReadingContext = // 35
  'Interruption.Begin' | // Value taken at start of interruption.
  'Interruption.End' | // Value taken when resuming after interruption.
  'Other' | // Value for any other situations.
  'Sample.Clock' | // Value taken at clock aligned interval.
  'Sample.Periodic' | // Value taken as periodic sample relative to start time of transaction.
  'Transaction.Begin' | // Value taken at end of transaction.
  'Transaction.End' | // Value taken at start of transaction.
  'Trigger' // Value taken in response to a TriggerMessage.req

// Reason for stopping a transaction in StopTransaction.req.
export type Reason = // 36
  'EmergencyStop' | // Emergency stop button was used.
  'EVDisconnected' | // disconnecting of cable, vehicle moved away from inductive charge unit.
  'HardReset' | // A hard reset command was received.
  'Local' | // Stopped locally on request of the user at the Charge Point.
  // This is a regular termination of a transaction.
  // Examples: presenting an RFID tag, pressing a button to stop.
  'Other' | // Any other reason.
  'PowerLoss' | // Complete loss of power.
  'Reboot' | // A locally initiated reset/reboot occurred. (for instance watchdog kicked in)
  'Remote' | // Stopped remotely on request of the user.
  // This is a regular termination of a transaction.
  // Examples: termination using a smartphone app, exceeding a (non local) prepaid credit.
  'SoftReset' | // A soft reset command was received.
  'UnlockCommand' | // Central System sent an Unlock Connector command.
  'DeAuthorized' // The transaction was stopped because of the authorization status in a StartTransaction.conf

export type RecurrencyKindType = // 37
  'Daily' | // The schedule restarts at the beginning of the next day.
  'Weekly' // The schedule restarts at the beginning of the next week (defined as Monday morning)

// Result of registration in response to BootNotification.req.
export type RegistrationStatus = // 38
  'Accepted' | // Charge point is accepted by Central System.
  'Pending' | // Central System is not yet ready to accept the Charge Point.
  // Central System may send messages to retrieve information or prepare the Charge Point.
  'Rejected' // Charge point is not accepted by Central System.
// This may happen when the Charge Point id is not known by Central System.

// The result of a RemoteStartTransaction.req or RemoteStopTransaction.req request.
export type RemoteStartStopStatus = // 39
  'Accepted' | // Command will be executed.
  'Rejected' // Command will not be executed.

// Status in ReserveNow.conf.
export type ReservationStatus =
  'Accepted' | // Reservation has been made.
  'Faulted' | // Reservation has not been made, because connectors or specified connector are in a faulted state.
  'Occupied' | // Reservation has not been made. All connectors or the specified connector are occupied.
  'Rejected' | // Reservation has not been made. Charge Point is not configured to accept reservations.
  'Unavailable' // Reservation has not been made, because connectors or specified connector are in an unavailable state.

// Result of Reset.req.
export type ResetStatus =
  'Accepted' | // Command will be executed.
  'Rejected' // Command will not be executed.

// Type of reset requested by Reset.req.
export type ResetType =
  'Hard' | // Full reboot of Charge Point software.
  'Soft' // Return to initial status, gracefully terminating any transactions in progress.

export interface SampledValue {
  value: string // Required. Value as a “Raw” (decimal) number or “SignedData”. Field Type is “string” to allow for digitally signed data readings. Decimal numeric values are also acceptable to allow fractional values for measurands such as Temperature and Current.
  location: 'Outlet' | 'Inlet' | 'EV' | 'Body'
  measurand?: Measurand
  unit: UnitOfMeasure
  phase?: 'L1' | 'L2' | 'L3' | 'L1-N' | 'L2-N' | 'L3-N'
}

// Status in TriggerMessage.conf.
export type TriggerMessageStatus =
  'Accepted' | // Requested notification will be sent.
  'Rejected' | // Requested notification will not be sent.
  'NotImplemented' // Requested notification cannot be sent because it is either not implemented or unknown.

// Allowable values of the optional 'unit' field of a Value element, as used in MeterValues.req and StopTransaction.req messages.
// Default value of 'unit' is always 'Wh'.
export type UnitOfMeasure = // 45
  'Wh' | // Watt-hours (energy). Default.
  'kWh' | // kiloWatt-hours (energy).
  'varh' | // Var-hours (reactive energy).
  'kvarh' | // kilovar-hours (reactive energy).
  'W' | // Watts (power).
  'kW' | // kilowatts (power).
  'VA' | // VoltAmpere (apparent power).
  'kVA' | // kiloVolt Ampere (apparent power).
  'var' | // Vars (reactive power).
  'kvar' | // kilovars (reactive power).
  'A' | // Amperes (current).
  'V' | // Voltage (r.m.s. AC).
  'Celsius' | // Degrees (temperature).
  'Fahrenheit' | // Degrees (temperature).
  'K' | // Degrees Kelvin (temperature).
  'Percent' // Percentage.

export type UnlockStatus = // 46
  'Unlocked' | // Connector has successfully been unlocked.
  'UnlockFailed' | // Failed to unlock the connector.
  'NotSupported' // Charge Point has no connector lock.

export type CertificateSignedStatus = // dunno
  'Accepted' | // Requested notification will be sent.
  'Rejected' // Requested notification will not be sent.
