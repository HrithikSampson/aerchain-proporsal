
import { WebSocket } from 'ws';

export default async function handleProporsalRequestWS(
    ws: WebSocket,
    proposalId?: number,
) {

    const data = {
        event: 'RFP_STARTED',
        data: 'Request For Proporsal creation started.',
        proposalId,
    };
    ws.send(JSON.stringify(data));

    ws.close();
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
}