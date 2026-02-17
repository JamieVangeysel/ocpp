# OCPP Charger
This is currently more of a replay server connecting the ChargeAmps charger using OCPP to a local server which in turn aggregates the data and forwards it to the ChargeAmps server and E-Flux for billing.
Currently data is send to both backends in a send only state meaning the connection is currently one way only.
So Charger => OCPP Aggregate Server => ChargeAmps OCPP & E-FLux OCPP
We are currently working on implementing a two way connection from the ChargeAmps server to the OCPP Aggregate Server so firmware updates can be done.
And a two way connection from the OCPP Aggregate Server to the E-FLux server, so we can use reserve, remote unlock etc for charging.

Currently there is no audit log, we plan to implement daily logs of all messages; both incoming and outgoing.

We plan to add the charger into homekit as well and publish all data to MQTT for integration into other systems plus reporting.

Currently all identifiers are hardcoded and unauthorized connections are not used.
In the near future we will add a management system to configure multiple chargers, endpoints and endpoint configurations.

## 
