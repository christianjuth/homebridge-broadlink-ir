import broadlink
import time

def learn_command(device):
    # Enter learning mode
    device.enter_learning()

    # Wait for the user to press a button
    print('Press the button on the remote now...')
    time.sleep(5)  # Wait 5 seconds for the user to press a button

    # Retrieve the learned command
    learned = device.check_data()

    if learned:
        # Print the command as hex
        print(learned.hex())
    else:
        print('No signal learned')

def main():
    # Replace '192.168.0.100' and '80' with the IP and port of your Broadlink device
    device = broadlink.hello('192.168.0.6', 80)
    device.auth()

    while True:
        input('Press enter to learn a new command (or Ctrl+C to exit)...')
        learn_command(device)

if __name__ == '__main__':
    main()
