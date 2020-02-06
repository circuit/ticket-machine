/*
    Copyright (c) 2020 Unify Inc.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the Software
    is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
    OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* jslint node: true */
'use strict';

const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const server = https.createServer({
        key: fs.readFileSync('./cert/server.key'),
        cert: fs.readFileSync('./cert/server.cert')
    }, app);
const io = require('socket.io')(server);
const config = require('./config.json');
const port = process.env.PORT || 8443;

class Machine {
    constructor(config) {
        this.id = config.id;
        this.location = config.location;
        this.connection = {
            APP: 'Offline',
            DA: 'Offline'
        }
        this.sockets = {
            APP: null,
            DA: null
        }
        this.status = '';
    }

    requestAssistance() {
        this.timestamp = Date.now();
        this.status = 'Waiting';
    }

    connected(component, socket) {
        if (component !== 'APP' && component !== 'DA') {
            return;
        }

        this.connection[component] = 'Online';
        this.sockets[component] = socket;
        this.timestamp = null;
        this.status = '';
    }

    disconnected(component) {
        if (component !== 'APP' && component !== 'DA') {
            return;
        }

        this.connection[component] = 'Offline';
        this.sockets[component] = null;
        this.timestamp = null;
        this.status = '';
    }

    callEstablished() {
        this.status = 'Connected';
        this.timestamp = Date.now();
    }

    callEnded() {
        this.status = '';
        this.timestamp = null;
    }

    toJson() {
        return {
            id: this.id,
            location: this.location,
            connection: this.connection,
            timestamp: this.timestamp || undefined,
            status: this.status
        }
    }
}

class Machines {
    constructor(config) {
        this.machines = config.map(m => new Machine(m));
    }

    getById(id) {
        return this.machines.find(m => m.id === id);
    }

    toJson() {
        return this.machines.map(m => m.toJson());
    }
}

const _machines = new Machines(config.machines);
const _sockets = {
    app: {}, // native ticketing app
    da: {} // Hidden desktop app for calls
};

app.use(express.static(__dirname + '/public'));



/**
 * Client socket.io connections
 */
io.on('connection', socket => {
    let query = socket.handshake.query;
    if (query.machine) {
        // Ticket machine app connected
        const id = query.machine;
        
        const machine = _machines.getById(id);
        if (!machine) {
            console.error(`Machine ${id} not found`);
            return;
        }

        console.log(`Machine ${id} connected`);
        machine.connected('APP', socket);
        io.in('operator').emit('machines', _machines.toJson());

        // Customer is asking for assistance
        socket.on('request-help', () => {
            console.log(`Customer on machine ${id} is requesting assistance`);
            machine.requestAssistance();
            io.in('operator').emit('machines', _machines.toJson());
        });

        // Ticket machine is offline
        socket.on('disconnect', () => {
            console.log(`Machine disconnected: ${machine.id}`);
            machine.disconnected('APP');
            io.in('operator').emit('machines', _machines.toJson());
        });

    } else if (query.da) {
        // Custom Circuit ticket machine DA connected
        const id = query.da;
        const machine = _machines.getById(id);
        if (!machine) {
            console.error(`Machine ${id} not found`);
            return;
        }

        // Send config to DA
        socket.emit('config', config.da);

        // DA connected
        console.log(`DA for machine ${id} connected`);
        machine.connected('DA', socket);
        io.in('operator').emit('machines', _machines.toJson());

        // Listen for call status changes
        socket.on('call-state-change', data => {
            console.log(`Call status changed to ${data.callState} for callId ${data.callId} on machine ${id}`);
            if (data.callState === 'Active') {
                machine.callEstablished();
            } else if (data.callState === 'Idle') {
                machine.callEnded();
            } else {
                return;
            }
            machine.sockets['APP'].emit('update', machine.toJson());
            io.in('operator').emit('machines', _machines.toJson());
        });

        socket.on('disconnect', () => {
            console.log(`DA for machine ${id} disconnected`);
            machine.disconnected('DA');
            io.in('operator').emit('machines', _machines.toJson());
        });

    } else if (query.operator) {
        // Operator connected
        socket.emit('config', config.operator);
        socket.join('operator');
        let operator;

        socket.on('register', async email => {
            console.log(`Operator ${email} logged in`);
            operator = email;
            socket.emit('machines', _machines.toJson());
        });

        socket.on('session-started', async data => {
            const machine = _machines.getById(data.machineId);
            if (machine) {
                if (!machine.sockets['APP']) {
                    console.log(`Customer on machine ${machine.id} is not requesting assistance anymore`);
                    return;
                }
                console.log(`Operator ${operator} connecting with machine ${machine.id}`);
                machine.status = 'Connecting';
                machine.sockets['APP'].emit('update', machine.toJson());
                io.in('operator').emit('machines', _machines.toJson());

                if (!machine.sockets['DA']) {
                    console.log(`DA on machine ${machine.id} is not online`);
                    return;
                }
                machine.sockets['DA'].emit('session-started', data);
            }
        });

        socket.on('session-ended', async data => {
            const machine = _machines.getById(data.machineId);
            if (machine) {
                if (!machine.sockets['APP']) {
                    console.log(`Customer on machine ${machine.id} is not requesting assistance anymore`);
                    return;
                }
                console.log(`Operator ${operator} connecting with machine ${machine.id}`);
                machine.status = '';
                machine.sockets['APP'].emit('update', machine.toJson());
                io.in('operator').emit('machines', _machines.toJson());

                machine.sockets['DA'].emit('session-ended');
            }
        });

        socket.on('disconnect', _ => console.log(`Operator disconnected`));
    }
});

server.listen(port, _ => console.log(`Server listening at port ${port}`));
