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


var socket;

var app = new Vue({
    el: '#app',
    vuetify: new Vuetify(),
    data: {
        id: null,
        alertText: '',
        showInfo: false,
        origin: window.location.origin,
        machines: [100, 101, 110, 111, 120],
        showMachineSelection: false
    },
    mounted: function () {
        const params = getParams(window.location.search);
        if (!params || !params.machine) {
            this.showMachineSelection = true;
            console.log('Define "machine" query param for machine. E.g. http://127.0.0.1:3000/?machine=200');
            return;
        }
        this.id = params.machine;
        this.connect();
    },
    methods: {
        help: function () {
            if (this.state === 'Waiting') {
                return;
            }
            console.log('Customer is requesting help');
            socket.emit('request-help', this.id);
            this.updateAlert('Waiting');
        },
        updateAlert: function (status) {
            this.status = status;
            switch (this.status) {
                case 'Waiting':
                    this.alertText = 'Waiting for customer service...';
                    break;
                case 'Connecting':
                    this.alertText = 'Connecting...';
                    break;
                case 'Connecting':
                    this.alertText = 'Connected to operator';
                    break;
                default:
                    this.alertText = '';
            }
            this.showInfo = !!this.alertText;
        },
        connect: function () {
            socket = io({ query: `machine=${this.id}` });

            socket.on('update', machine => {
                this.updateAlert(machine.status);
            });

            socket.on('connect', _ => {
                console.log(`Connected`);
            });

            socket.on('disconnect', function () {
                console.log('You have been disconnected');
            });

            socket.on('reconnect', function () {
                console.log('You have been reconnected');
            });

            socket.on('reconnect_error', function () {
                console.log('Attempt to reconnect has failed');
            });
        }
    }
});