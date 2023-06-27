import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from './platform';

import path from 'path'

const { spawn } = require('child_process');

const sleep = async (time: number) => new Promise((resolve) => {
  setTimeout(() => resolve(true), time)
})

type HSL = [number, number, number];

// function calculateDistance(hsl1: HSL, hsl2: HSL): number {
//   let hDif = Math.min(Math.abs(hsl1[0] - hsl2[0]), 360 - Math.abs(hsl1[0] - hsl2[0]));
//   let sDif = hsl1[1] - hsl2[1];
//   let lDif = hsl1[2] - hsl2[2];

//   // Scale the hue difference by the average saturation of the two colors
//   let saturationScale = (hsl1[1] + hsl2[1]) / 2 / 100;
//   hDif *= saturationScale;

//   // Scale the hue difference by the average lightness of the two colors
//   let lightnessScale = (hsl1[2] + hsl2[2]) / 2 / 100;
//   hDif *= lightnessScale;

//   return Math.sqrt(hDif * hDif + sDif * sDif + lDif * lDif);
// }

// function calculateDistance(hsl1: HSL, hsl2: HSL): number {
//     let hDif = Math.min(Math.abs(hsl1[0] - hsl2[0]), 360 - Math.abs(hsl1[0] - hsl2[0]));
//     let sDif = hsl1[1] - hsl2[1];
//     let lDif = hsl1[2] - hsl2[2];

//     // Scale the hue difference by the average saturation and lightness of the two colors
//     let saturationScale = (hsl1[1] + hsl2[1]) / 2 / 100;
//     let lightnessScale = (hsl1[2] + hsl2[2]) / 2 / 100;
//     hDif *= (saturationScale * lightnessScale * 2); // Increase hue weight 

//     // Decrease weight to the saturation difference
//     let saturationWeight = 1.5;
//     sDif *= saturationWeight;

//     return Math.sqrt(hDif * hDif + sDif * sDif + lDif * lDif);
// }

function calculateDistance(hsl1: HSL, hsl2: HSL): number {
    let hDif = Math.min(Math.abs(hsl1[0] - hsl2[0]), 360 - Math.abs(hsl1[0] - hsl2[0]));
    let sDif = hsl1[1] - hsl2[1];
    let lDif = hsl1[2] - hsl2[2];

    // Scale the hue difference by the average saturation and lightness of the two colors
    let saturationScale = (hsl1[1] + hsl2[1]) / 2 / 100;
    let lightnessScale = (hsl1[2] + hsl2[2]) / 2 / 100;
    hDif *= (saturationScale * lightnessScale * 2); // Increase hue weight 

    // Decrease weight to the saturation difference a little bit more
    let saturationWeight = 1.2;
    sDif *= saturationWeight;

    return Math.sqrt(hDif * hDif + sDif * sDif + lDif * lDif);
}


function findClosestColor(colors: HSL[], target: HSL): HSL | null {
  if (colors.length === 0) {
    return null; // return null or throw an error, depending on your needs
  }

  let closestColor = colors[0];
  let closestDistance = calculateDistance(closestColor, target);

  for(let i = 1; i < colors.length; i++) {
    let distance = calculateDistance(colors[i], target);
    if(distance < closestDistance) {
      closestDistance = distance;
      closestColor = colors[i];
    }
  }

  return closestColor;
}


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
  _hue = 0
  _saturation = 0

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
    switch (this.accessory.context.device.type) {
      case "light": {
        this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
        break;
      }
      default: {
        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
      }
    }

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    if (this.accessory.context.device.type === 'light') {
      this.service.getCharacteristic(this.platform.Characteristic.Hue)
        .onSet(this.setHue.bind(this))
        .onGet(this.getHue.bind(this))
      
      this.service.getCharacteristic(this.platform.Characteristic.Saturation)
        .onSet(this.setSaturation.bind(this))
        .onGet(this.getSaturation.bind(this))
    }

    this.updateColor = this.updateColor.bind(this)
  }

  /**
   * Dispatch a list of IR commands to devices
   */
  async dispatchCommands(cmds: { data: string, repeat?: number }[]) {
    const device = this.accessory.context.device

    for (const cmd of cmds) {
      for (let i = 0; i < (cmd.repeat ?? 1); i++) {
        for (const host of this.platform.resolveHostsToIps(device.hosts)) {
          sendIRCode(host, cmd.data)
        }
        await sleep(500)
      }
    }
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
    this.dispatchCommands(commands)

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

  _prevColorCmd: string | null = null
  updateColor() {
    const hsl: HSL = [this._hue, this._saturation, 100] 

    const device = this.accessory.context.device

    const colors = new Map<HSL, string>()

    for (const color in device.colors) {
      const [h,s,l] = color.split(",")
      colors.set([parseInt(h), parseInt(s), parseInt(l)], device.colors[color])
    }

    const match = findClosestColor(Array.from(colors.keys()), hsl)

    if (match) {
      const cmd = device.colors[match.join(',')]
      if (cmd !== this._prevColorCmd) {
        this.dispatchCommands([{ data: cmd }])
        this._prevColorCmd = cmd
      }
    }
  }

  async setHue(value: CharacteristicValue) {
    this._hue = value as number
    this.updateColor()
  }

  async getHue(): Promise<CharacteristicValue> {
    return this._hue
  }


  async setSaturation(value: CharacteristicValue) {
    this._saturation = value as number
    this.updateColor()
  }
  
  async getSaturation(): Promise<CharacteristicValue> {
    return this._saturation
  }
}
