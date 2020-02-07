# Ticket machine

## Intro

A ticket machine user (customer) needs help buying a ticket and presses the "Help" button. A remote operator connects to the machine which allows two-way audio with the machine, and the ability to view the screen.

Furthermore the remote operator may use whiteboarding to draw on the screen, or interact with the screen by bying the ticket for the user. (This part it not yet in this prototype)

## Technical solution

To allow sharing the screen without user action, a native application such as electron is required. If the ticket machine application (referred to as APP) is already an electron app, then this app could be modified to use the JS SDK for the audio and screenshare.

But most likely the APP is a native Windows application or similar, in which case a companion electron app is required to use JS SDK for the audio and screenshare. This example does just that, it runs a platofrm independent electron desktop app (referred to as DA) along side the APP.

### Detailed flow

Actors: 

* Customer (using the ticket machine)
* Operator (assisting remotely from office)

Components:

* Ticket machine application (APP), a simple web app in this example
* Ticket machine desktop app companion (DA)
* Operator web application
* Node.js backend application for communication between above conponents

Node.js application is used to communicate via socket.io to the APP, the DA and the operator web app. The Circuit RTC session is establised between the DA and the operator's browser. The operator requires a Circuit account. The ticket machine DA uses the Circuit Guest SDK, so no account is required.


Flow:
1. Customer presses “Ask for help” on which sends request to operator (via node app).
2. Operators see ticket machine is asking for help. One operator is accepting the request. 
3. Operator web app creates group conversation, starts RTC Session and notifies the APP and DA.
4. DA joins conference and starts screenshare (and whiteboarding, remote control once available)
5. Operator shows screen of ticket machine

Following image shows the ticket machine web app running in kiosk mode on Windows 10 with the DA running hidden. The right side shows the operator web app with a connection to the ticket machine 100 on the left.
<p float="left">
  <kbd><img src="screenshot1.png" width="100%"></kbd>
</p>


## Alternative solutions

### Ticket machine app is already an electron-based app
This DA would not be required if the ticket machine application were an electron app itself, or any similar platform that can use the JS SDK and also have access to the platform.

In that case the ticket machine app could use the JS SDK directly to join the conference and share the screen.

### Regular web app instead of Ticket machine DA

If it is acceptable for the customer to select the screen to share, then the DA could be replaced by a regular web app. The user would see the regular browser screen chooser popup to select the screen. But there would also be other limitations such as `remote control` which requires the sharing party to run a desktop app.


## Usage

Optionally change the configuration in `config.json` and `da/config.json`.

```bash
  git clone https://github.com/circuit/ticket-machine.git
  cd ticket-machine
  npm install
  npm start // starts node app serving the ticket machine and operator web app
  cd da
  npm start // starts electron DA
```

