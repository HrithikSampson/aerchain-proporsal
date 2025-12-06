import AppDataSource from "./data-source";
import express, { Response , Request } from "express";
import * as _ from "lodash";
import config from "./config/config";
import http from "http";
import { Server } from "socket.io";
import { setupProposalHandlers, getActiveRooms } from "./ai-interaction/handleProporsalRequest";
import cors from "cors";
import rfpRouter from "./router/Rfp";
import vendorRouter from "./router/Vendor";
import vendorProposalRouter from "./router/VendorProposal";
import { emailMonitor } from "./email-interaction/email-monitor";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: config.FRONTEND_URL,
}));

app.use("/api/rfp", rfpRouter);
app.use("/api/vendor", vendorRouter);
app.use("/api/proposal", vendorProposalRouter);

const server = http.createServer(app);

const port = config.PORT;


app.get("/", (_req: Request, res: Response) => {
    console.log("..........................server working ........................");
    res.send("ok");
});

app.get("/proposal/rooms", (_req: Request, res: Response) => {
    const rooms = getActiveRooms();
    res.json({ rooms, count: rooms.length });
});

app.post("/proposal/start", (_req: Request, res: Response) => {
    const { v4: uuidv4 } = require('uuid');
    const roomId = uuidv4();
    res.json({ roomId, message: "Session created successfully" });
});


export const io = new Server(server, {
  path: "/proposal-socket",
  cors: {
    origin: config.FRONTEND_URL,
  },
});

setupProposalHandlers(io);

AppDataSource.initialize()
    .then(async () => {
        console.log("Data Source has been initialized!");

        try {
            await emailMonitor.start();
            console.log("Email monitor started successfully");
        } catch (error) {
            console.error("Failed to start email monitor:", error);
            console.log("Server will continue without email monitoring");
        }
    }).catch((err) => {
        console.error("Error during Data Source initialization:", err);
    });

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Socket.IO server ready on path: /proposal-socket`);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await emailMonitor.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await emailMonitor.stop();
    process.exit(0);
});



