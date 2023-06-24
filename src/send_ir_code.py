import sys
import broadlink
import binascii

def send_command(host, command_hex):
    device = broadlink.hello(host, 80)
    device.auth()

    # Convert the hex string to bytes
    command = binascii.unhexlify(command_hex)

    # Send the command
    device.send_data(command)

if __name__ == '__main__':
    send_command(sys.argv[1], sys.argv[2])
