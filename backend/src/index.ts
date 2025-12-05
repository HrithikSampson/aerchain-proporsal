import AppDataSource from "./data-source";
import express, { Response , Request } from "express";
import * as _ from "lodash";
import config from "./config/config";
import http from "http";
import { Server } from "socket.io";
import { setupProposalHandlers, getActiveRooms } from "./ai-interaction/handleProporsalRequest";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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


export const io = new Server(server, {
  path: "/proposal-socket",
  cors: {
    origin: config.FRONTEND_URL,
    credentials: true,
  },
});

setupProposalHandlers(io);

AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
    }).catch((err) => {
        console.error("Error during Data Source initialization:", err);
    });

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Socket.IO server ready on path: /proposal-socket`);
});



