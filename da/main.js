const Circuit = require('circuit-sdk');

const getParams = query => {
    if (!query) {
        return {};
    }
    return (/^[?#]/.test(query) ? query.slice(1) : query)
        .split('&')
        .reduce((params, param) => {
            let [key, value] = param.split('=');
            params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
            return params;
        }, {});
};

// Define getDisplayMedia function to be used by the JS SDK to capture the screen
Circuit.electron = Circuit.electron || {};
Circuit.electron.getDisplayMedia = async () => {
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sources[0].id,
                minWidth: 1280,
                maxWidth: 1280,
                minHeight: 720,
                maxHeight: 720
            }
        }
    });
}

// app
let socket;
let client;
let config;
Circuit.logger.setLevel(1);

new Vue({
    el: '#app',
    data: {
        id: null,
        call: null,
        origin: window.location.origin,
        machines: [100, 101, 110, 111, 120],
        showMachineSelection: false
    },
    mounted: function () {
        const params = { id: "110" };//getParams(window.location.search);
        if (!params || !params.id) {
            this.showMachineSelection = true;
            console.log('Define "id" query param for machine. E.g. http://127.0.0.1:3000/da/?id=200');
            return;
        }
        this.id = params.id;
        this.connect();
    },
    methods: {
        connect: function () {
            socket = io('https://localhost:8443', { query: `da=${this.id}` });

            socket.on('config', async cfg => {
                // Logon to Circuit
                config = cfg;
                client = new Circuit.GuestClient(config.oauth);

                client.addEventListener('connectionStateChanged', e => {
                    console.log('Received connectionStateChanged with state = ', e.state)
                });

                client.addEventListener('callStatus', e => {
                    console.log(`Received callStatus for ${e.call.callId} with status ${e.call.state}`);
                    socket.emit('call-state-change', {
                        callId: e.call.callId,
                        callState: e.call.state
                    });
                });

                client.addEventListener('callEnded', e => {
                    console.log(`Received callEnded for ${e.call.callId}`);
                    socket.emit('call-state-change', {
                        callId: e.call.callId,
                        callState: 'Idle'
                    });
                });
            });

            socket.on('update', machine => {
                this.state = machine.state;
            });

            socket.on('session-started', async data => {
                try {
                    // Join conference and start sharing screen
                    this.call = await client.joinConference({
                        token: data.guestToken,
                        firstName: 'Ticket Machine',
                        lastName: data.machineId
                    }, { audio: true, desktop: true });
                    console.log(`Joined conference for machine ${data.machineId}. callId: ${this.call.callId}`);
                } catch (err) {
                    console.log(err);
                }
            });

            socket.on('connect', () => {
                console.log(`Connected`);
            });

            socket.on('disconnect', () => {
                console.log('You have been disconnected');
            });

            socket.on('reconnect', () => {
                console.log('You have been reconnected');
            });

            socket.on('reconnect_error', () => {
                console.log('Attempt to reconnect has failed');
            });
        }
    }
});