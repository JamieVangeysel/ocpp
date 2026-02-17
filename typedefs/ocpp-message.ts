import { MyFeatureProfile } from './feature-profiles'
import {
  AvailabilityStatus,
  AvailabilityType,
  CancelReservationStatus,
  CertificateSignedStatus,
  ChargePointErrorCode,
  ChargePointStatus,
  ChargingProfile,
  ChargingProfilePurposeType,
  ChargingProfileStatus,
  ClearChargingProfileStatus,
  ConfigurationStatus,
  IdTagInfo,
  KeyValue,
  MessageType,
  MeterValue,
  Reason,
  RegistrationStatus,
  RemoteStartStopStatus,
  ReservationStatus,
  ResetType,
  UnlockStatus
} from './types'

export type rMessage = [MessageTypeId: MessageType, UniqueId: string, Action: MyFeatureProfile, Payload: any]
export type cMessage = [MessageTypeId: MessageType, UniqueId: string, Payload: any]

export interface rAuthorizeMessage { // 1
  idTag: string
  connectorId?: number // this is not in the OCPP 1.6 Specification, howerver supported on out ACU
}

export interface cAuthorizeMessage { // 2
  idTagInfo: IdTagInfo
}

export interface rBootNotification { // 3
  chargeBoxSerialNumber?: string // (25) Optional. This contains a value that identifies the serial number of the Charge Box inside the Charge Point. Deprecated, will be removed in future version
  chargePointModel: string // (20) Required. This contains a value that identifies the model of the ChargePoint.
  chargePointSerialNumber?: string // (25) Optional. This contains a value that identifies the serial number of the Charge Point.
  chargePointVendor: string // (20) Required. This contains a value that identifies the vendor of the ChargePoint.
  firmwareVersion?: string // (50) Optional. This contains the firmware version of the Charge Point.
  iccid?: string // (20) Optional. This contains the ICCID of the modem’s SIM card.
  imsi?: string // (20) Optional. This contains the IMSI of the modem’s SIM card.
  meterSerialNumber?: string // (25) Optional. This contains the serial number of the main power meter of the Charge Point.
  meterType?: string // (25) Optional. This contains the type of the main power meter of the Charge Point.
}

export interface cBootNotification { // 4
  currentTime: string // Required. This contains the Central System’s current time.
  interval: number // Required. When RegistrationStatus is Accepted, this contains the heartbeat interval in seconds.
  // If the Central System returns something other than Accepted, the value of the interval field indicates the minimum wait time before sending a next BootNotification request.
  status: RegistrationStatus
}

export interface rCancelReservation { // 5
  reservationId: number // Required. Id of the reservation to cancel.
}

export interface cCancelReservation { // 6
  status: CancelReservationStatus // Required.This indicates the success or failure of the cancelling of a reservation by Central System.
}

export interface rChangeAvailability { // 7
  connectorId: number // Required. The id of the connector for which availability needs to change. Id '0' (zero) is used if the availability of the Charge Point and all its connectors needs to change.
  type: AvailabilityType // Required. This contains the type of availability change that the Charge Point should perform.
}

export interface cChangeAvailability { // 8
  status: AvailabilityStatus // Required. This indicates whether the Charge Point is able to perform the availability change.
}

export interface rChangeConfiguration { // 9
  key: string // (50) Required. The name of the configuration setting to change. See for standard configuration key names and associated values
  value: string // (500) Required. The new value as string for the setting. See for standard configuration key names and associated values
}

export interface cChangeConfiguration { // 10
  status: ConfigurationStatus // Required. Returns whether configuration change has been accepted.
}

export interface rClearChargingProfile { // 13
  id?: number // Optional. The ID of the charging profile to clear.
  connectorId?: number // Optional. Specifies the ID of the connector for which to clear charging profiles. A connectorId of zero (0) specifies the charging profile for the overall Charge Point. Absence of this parameter means the clearing applies to all charging profiles that match the other criteria in the request.
  chargingProfilePurpose?: ChargingProfilePurposeType // Optional. Specifies to purpose of the charging profiles that will be cleared, if they meet the other criteria in the request.
  stackLevel?: number // Optional. specifies the stackLevel for which charging profiles will be cleared, if they meet the other criteria in the request
}

export interface cClearChargingProfile { // 14
  status: ClearChargingProfileStatus // Required. Indicates if the Charge Point was able to execute the request.
}

export interface rHeartbeat { // 29

}

export interface cHeartbeat { // 30
  currentTime: string // Required. This contains the Central System’s current time.
}


export interface rMeterValues { // 31
  connectorId: number // Required. This contains a number (>0) designating a connector of the Charge Point.‘0’ (zero) is used to designate the main powermeter.
  transactionId?: number // Optional. The transaction to which these meter samples are related.
  meterValue: MeterValue[] // Required. The sampled meter values with timestamps.
}

export interface cMeterValues { // 32

}

export interface rRemoteStartTransaction { // 33
  connectorId?: number // Optional. Number of the connector on which to start the transaction. connectorId SHALL be > 0
  idTag: string // Required. The identifier that Charge Point must use to start a transaction.
  chargingProfile?: ChargingProfile // Optional. Charging Profile to be used by the Charge Point for the requested transaction. ChargingProfilePurpose MUST be set to TxProfile
}

export interface cRemoteStartTransaction { // 34
  status: RemoteStartStopStatus // Required. Status indicating whether Charge Point accepts the request to start a transaction.
}

export interface rRemoteStopTransaction { // 35
  transactionId: number // Required. The identifier of the transaction which Charge Point is requested to stop.
}

export interface cRemoteStopTransaction { // 36
  status: RemoteStartStopStatus // Required. Status indicating whether Charge Point accepts the request to start a transaction.
}

export interface rReserveNow { // 37
  connectorId: number // Required. This contains the id of the connector to be reserved. A value of 0 means that the reservation is not for a specific connector.
  expiryDate: Date // Required. This contains the date and time when the reservation ends.
  idTag: string // Required. The identifier for which the Charge Point has to reserve a connector.
  parentIdTag?: string // Optional. The parent idTag.
  reservationId: number // Required. Unique id for this reservation.
}

export interface cReserveNow { // 38
  status: ReservationStatus // Required. This indicates the success or failure of the reservation.
}

export interface rReset { // 39
  type: ResetType
}

export interface cReset { // 40

}

export interface rSetChargingProfile { // 43
  connectorId: number // Required. The connector to which the charging profile applies. If connectorId = 0, the message contains an overall limit for the Charge Point.
  csChargingProfiles: ChargingProfile // Required. The charging profile to be set at the Charge Point.
}

export interface cSetChargingProfile { // 44
  status: ChargingProfileStatus
}

export interface rStartTransaction { // 45
  connectorId: number // >0 Required. This identifies which connector of the Charge Point is used.
  idTag: string // Required. This contains the identifier for which a transaction has to be started.
  meterStart: number // Required. This contains the meter value in Wh for the connector at start of the transaction.
  reservationId?: number // Optional. This contains the id of the reservation that terminates as a result of this transaction.
  timestamp: string // Required. This contains the date and time on which the transaction is started.
}

export interface cStartTransaction { // 46
  idTagInfo: IdTagInfo // Required. This contains information about authorization status, expiry and parent id.
  transactionId: number // Required. This contains the transaction id supplied by the Central System.
}

export interface rStatusNotification { // 47
  connectorId: number // Required. The id of the connector for which the status is reported. Id '0' (zero) is used if the status is for the Charge Point main controller.
  errorCode: ChargePointErrorCode // Required. This contains the error code reported by the Charge Point.
  info: string // (50) Optional. Additional free format information related to the error.
  status: ChargePointStatus // Required. This contains the current status of the Charge Point.
  timestamp?: string // Optional. The time for which the status is reported. If absent time of receipt of the message will be assumed.
  vendorId: string // (255) Optional. This identifies the vendor-specific implementation.
  vendorErrorCode: string // (50) Optional. This contains the vendor-specific error code.
}

export interface cStatusNotification { // 48

}

export interface rStopTransaction { // 49
  idTag?: string // Optional. This contains the identifier which requested to stop the charging. It is optional because a Charge Point may terminate charging without the presence of an idTag, e.g. in case of a reset. A Charge Point SHALL send the idTag if known.
  meterStop: number // Required. This contains the meter value in Wh for the connector at end of the transaction.
  timestamp: string // Required. This contains the date and time on which the transaction is stopped.
  transactionId: number // Required. This contains the transaction-id as received by the StartTransaction.conf.
  reason?: Reason // Optional. This contains the reason why the transaction was stopped. MAY only be omitted when the Reason is 'Local'.
  transactionData?: MeterValue[] // Optional. This contains transaction usage details relevant for billing purposes.
}

export interface cStopTransaction { // 50
  idTagInfo?: IdTagInfo // Optional. This contains information about authorization status, expiry and parent id. It is optional, because a transaction may have been stopped without an identifier.
}

export interface rUnlockConnector { // 53
  connectorId: number
}

export interface cUnlockConnector { // 54
  status: UnlockStatus
}

export interface cGetConfiguration {
  unknownKey?: string[] // Optional. Requested keys that are unknown
  configurationKey?: KeyValue[]
}

export interface rCertificateSigned { // 5.1
  certificateChain: string // Required. The signed PEM encoded X.509 certificates. This can also contain the necessary sub CA certificates. The maximum size of this field is be limited by the configuration key: CertificateSignedMaxSize.
}

export interface cCertificateSigned { // 5.2
  status: CertificateSignedStatus // Required. Returns whether certificate signing has been accepted, otherwise rejected.
}

export interface rSecurityEventNotification { // 5.15
  type: string // Required. Type of the security event (See list of currently known security events)
  timestamp: string // Required. This contains the date and time on which the transaction is started.
  techInfo: string // Additional information about the occurred security event.
}

export interface cSecurityEventNotification { // 5.16

}
