import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from './platform';

import path from 'path'

const { spawn } = require('child_process');

const sleep = async (time: number) => new Promise((resolve) => {
  setTimeout(() => resolve(true), time)
})

function sendIRCode(host: string, irCode: string) {
  const python = spawn('python3', [path.join(__dirname, 'send_ir_code.py'), host, irCode]);
  python.stdout.on('data', function (data) {
    console.log('Pipe data from python script ...');
    console.log(data.toString());
  });
  python.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ExamplePlatformAccessory {
  private service: Service;
  isOn = false

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    const isOn = Boolean(value)

    // implement your own code to turn your device on/off
    const device = this.accessory.context.device

    const commands = isOn ? device.on : device.off

    for (const cmd of commands) {
      for (let i = 0; i < cmd.repeat; i++) {
        sendIRCode(this.platform.host, cmd.data)
        await sleep(500)
      }
    }

    this.isOn = isOn

    this.platform.log.debug('Set Characteristic On ->', isOn);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const isOn = this.isOn

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  // async setBrightness(value: CharacteristicValue) {
  //   // implement your own code to set the brightness
  //   this.exampleStates.Brightness = value as number;

  //   this.platform.log.debug('Set Characteristic Brightness -> ', value);
  // }
  
  async setHue(value: CharacteristicValue) {

  }
}
