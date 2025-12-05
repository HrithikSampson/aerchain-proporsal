import { Router, Request, Response } from "express";
const ProporserRouter = Router();

ProporserRouter.post("/chat", (req: Request, res: Response) => {
    const body = req.body as { rfpId: number; proposalId: number; message: string };
    const rfpId: number = body.rfpId;
    const proposalId: number = body.proposalId;

    handleProporsalRequest(rfpId, proposalId, body.message, res);
});

export default ProporserRouter;