const Websocket = require('ws');

const P2P_PORT = process.env.P2P_PORT || 5001;

/**
 * Example:
 * $ HTTP_PORT=3002 P2P_PORT=5003 PEERS=ws://localhost:5001,ws://localhost:5002 npm run dev
 */
const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];
const MESSAGE_TYPES = {
    CHAIN: 'CHAIN',
    TRANSACTION: 'TRANSACTION',
    CLEAR_TRANSACTIONS: 'CLEAR_TRANSACTIONS'
};

class P2pServer {
    constructor(blockchain, transactionPool) {
        this.blockchain = blockchain;
        this.transactionPool = transactionPool;
        this.sockets = [];
    }

    listen() {
        const server = new Websocket.Server({ port: P2P_PORT });
        server.on('connection', (socket) => this.connectSocket(socket));
        
        this.connectToPeers();

        console.log(`Listening for peer-to-peer connections on: ${P2P_PORT}`);
    }

    connectToPeers() {
        peers.forEach((peer) => {
            // peer will be like ws://localhost:5001
            const socket = new Websocket(peer);

            socket.on('open', () => this.connectSocket(socket));
        });
    }

    connectSocket(socket) {
        this.sockets.push(socket);
        console.log('Socket connected');

        this.messageHandler(socket);

        this.sendChain(socket);
    }

    messageHandler(socket) {
        socket.on('message', (message) => {
            const data = JSON.parse(message);

            switch(data.type) {
                case MESSAGE_TYPES.CHAIN:
                    this.blockchain.replaceChain(data.chain);
                    break;
                case MESSAGE_TYPES.TRANSACTION:
                    this.transactionPool.updateOrAddTransaction(data.transaction);
                    break;
                case MESSAGE_TYPES.CLEAR_TRANSACTIONS:
                    this.transactionPool.clear();
                    break;
            }
        });
    }

    sendChain(socket) {
        socket.send(JSON.stringify({
            type: MESSAGE_TYPES.CHAIN,
            chain: this.blockchain.chain
        }));
    }

    sendTransaction(socket, transaction) {
        socket.send(JSON.stringify({
            type: MESSAGE_TYPES.TRANSACTION,
            transaction
        }));
    }

    syncChains() {
        this.sockets.forEach((socket) => this.sendChain(socket));
    }

    broadcastTransaction(transaction) {
        this.sockets.forEach((socket) => this.sendTransaction(socket, transaction));
    }

    broadcastClearTransactions() {
        this.sockets.forEach((socket) => socket.send(JSON.stringify({
            type: MESSAGE_TYPES.CLEAR_TRANSACTIONS
        })));
    }
}

module.exports = P2pServer;