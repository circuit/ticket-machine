let client;
let socket;

document.addEventListener('DOMContentLoaded', () => {
    new Vue({
        el: '#app',
        vuetify: new Vuetify(),
        data: {
            loading: true,
            localUser: null,
            config: null,
            machines: [],
            activeMachine: null,
            activeCall: null
        },
        created: function () {
            setInterval(() => {
                this.machines.forEach(m => {
                    if (m.status === 'Waiting' || m.status === 'Connected') {
                        const delta = Math.round((Date.now() - m.timestamp) / 1000);
                        this.$set(m, 'wait', delta);
                    }
                })
            }, 1000);
        },
        mounted: function () {
            // Connect to server and get configuration
            socket = io({ query: `operator` });
            socket.on('config', config => {
                this.config = config

                // Create circuit instance
                client = new Circuit.Client(config.oauth);

                client.addEventListener('callStatus', e => {
                    console.log(`Received callStatus for ${e.call.callId} with status ${e.call.state}`);
                    this.activeCall = e.call;
                    this.$refs.callState.call = e.call;
                });

                client.addEventListener('callEnded', e => {
                    console.log(`Received callEnded for ${e.call.callId}`);
                    this.activeCall = null;
                });

                client.logonCheck()
                    .then(this.login)
                    .catch(() => {
                        console.log('No token available. Ask operator to login.');
                        this.loading = false;
                    });
            });
        },
        methods: {
            statusText(machine) {
                if (machine.connection['APP'] !== 'Online' || machine.connection['DA'] !== 'Online') {
                    return 'Offline';
                }
                return machine.status;
            },
            login: async function () {
                this.localUser = await client.logon();
                this.loading = false;
                socket.emit('register', this.localUser.emailAddress);

                // Update UI on changes
                socket.on('machines', machines => {
                    this.machines = machines;
                });
            },
            logout: async function () {
                await client.logout(true);
                this.localUser = null;
            },
            connect: async function (machine) {
                this.activeMachine = machine;

                // Create new conversation, start session and let server know the guest token
                const conv = await client.createGroupConversation([this.config.supervisor], 'Ticket machine session');
                this.activeCall = await client.startConference(conv.convId, { audio: true, video: false });
                const details = await client.getConversationDetails(conv.convId);

                console.log(`Connecting to machine ${machine.id}`);

                socket.emit('session-started', {
                    machineId: machine.id,
                    convId: conv.convId,
                    callId: this.activeCall.callId,
                    guestToken: details.link.split('=')[1]
                });
            },
            hangup: async function () {
                if (this.activeCall) {
                    console.log(`End conference to machine ${this.activeMachine.id}`);
                    await client.endConference(this.activeCall.callId);
                    socket.emit('session-ended', {
                        machineId: this.activeMachine.id
                    });
                    this.activeCall = null;
                    this.activeMachine = null;
                }
            },
            requestControl: async function () {
                console.log(`Request control of machine ${this.activeMachine.id}`);
            }
        }
    });
});
